import WebSocket from 'ws';
import { MessageModel } from '../models/message';
import { RoomModel } from '../models/room';
import { UserModel } from '../models/user';
import { db } from '../config/database';
import { logger } from '../utils/logger';

interface Client {
  ws: WebSocket;
  username: string;
  userId: string;
}

export class ChatService {
  private messageModel: MessageModel;
  private roomModel: RoomModel;
  private userModel: UserModel;
  private rooms: Map<string, Map<string, Client>> = new Map();

  constructor() {
    this.messageModel = new MessageModel(db.getDb());
    this.roomModel = new RoomModel(db.getDb());
    this.userModel = new UserModel(db.getDb());
  }

  async joinRoom(ws: WebSocket, roomId: string, userId: string, username: string) {
    const room = await this.roomModel.getById(roomId);
    if (!room) {
      ws.send(JSON.stringify({ error: 'Room does not exist' }));
      return;
    }
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    this.rooms.get(roomId)!.set(userId, { ws, username, userId });
    logger.info(`Client ${userId} (${username}) joined room: ${roomId}`);
    this.broadcastActiveUsers(roomId);
  }

  leaveRoom(ws: WebSocket, roomId: string, userId: string) {
    const roomClients = this.rooms.get(roomId);
    if (roomClients) {
      roomClients.delete(userId);
      if (roomClients.size === 0) {
        this.rooms.delete(roomId);
      }
      this.broadcastActiveUsers(roomId);
    }
    logger.info(`Client ${userId} left room: ${roomId}`);
  }

  leaveAllRooms(ws: WebSocket, userId: string) {
    this.rooms.forEach((clients, roomId) => {
      if (clients.has(userId)) {
        clients.delete(userId);
        if (clients.size === 0) {
          this.rooms.delete(roomId);
        }
        this.broadcastActiveUsers(roomId);
      }
    });
    logger.info(`Client ${userId} left all rooms`);
  }

  async broadcastMessage(roomId: string, message: any) {
    if (!roomId) {
      logger.error('Cannot broadcast message: roomId is missing');
      return;
    }
    const client = this.rooms.get(roomId)?.get(message.userId);
    const savedMessage = await this.messageModel.create({
      roomId,
      userId: message.userId,
      username: client?.username || 'Unknown',
      content: message.content,
      timestamp: Date.now()
    });

    const clients = this.rooms.get(roomId);
    if (clients) {
      const messagePayload = {
        userId: message.userId,
        username: client?.username || 'Unknown',
        content: message.content,
        id: savedMessage,
        roomId
      };
      const messageStr = JSON.stringify(messagePayload);
      clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
        }
      });
    }
  }

  async getRoomHistory(roomId: string) {
    return this.messageModel.getByRoom(roomId);
  }

  getActiveUsers(roomId: string): string[] {
    const clients = this.rooms.get(roomId);
    return clients ? Array.from(clients.values()).map(client => client.username) : [];
  }

  getRoomUserCount(roomId: string): number {
    const clients = this.rooms.get(roomId);
    return clients ? clients.size : 0;
  }

  getRoomClients(roomId: string): Map<string, Client> {
    return this.rooms.get(roomId) || new Map();
  }

  async getTalkTimeLimit(roomId: string): Promise<number> {
    const room = await this.roomModel.getById(roomId);
    return room?.talkTimeLimit || 30000; // Default 30s
  }

  async broadcastTalkState(roomId: string, userId: string, isTalking: boolean) {
    const clients = this.getRoomClients(roomId);
    const messageStr = JSON.stringify({ type: 'webrtc-talk-update', userId, isTalking }); 
    clients.forEach((client, peerId) => {
      if (peerId !== userId && client.ws.readyState === WebSocket.OPEN) {
        logger.info(`Sending talk update to ${peerId}: ${userId} isTalking: ${isTalking}`); 
        client.ws.send(messageStr); 
      }
    });
    logger.info(`Broadcast talk state: ${userId} in room ${roomId} isTalking: ${isTalking}`); 
  } 

  private broadcastActiveUsers(roomId: string) {
    const clients = this.rooms.get(roomId);
    if (clients) {
      const activeUsers = this.getActiveUsers(roomId);
      const messageStr = JSON.stringify({ type: 'activeUsers', users: activeUsers });
      clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
        }
      });
    }
  }
}