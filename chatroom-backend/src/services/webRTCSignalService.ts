import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { ChatService } from './chatService';

export class WebRTCService {
  private peers: Map<string, { ws: WebSocket; roomId?: string; hasVideo: boolean; isTalking: boolean; talkTimeout?: NodeJS.Timeout }> = new Map();
  private chatService: ChatService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
  }

  registerPeer(userId: string, ws: WebSocket, roomId?: string, hasVideo: boolean = false) {
    this.peers.set(userId, { ws, roomId, hasVideo, isTalking: false });
    logger.info(`Peer registered: ${userId} in room ${roomId || 'none'} with video: ${hasVideo}`);
    if (roomId) {
      this.broadcastPeers(roomId, userId, hasVideo);
    }
  }

  unregisterPeer(userId: string) {
    const peer = this.peers.get(userId);
    if (peer?.talkTimeout) clearTimeout(peer.talkTimeout);
    if (peer && peer.roomId) {
      this.broadcastPeers(peer.roomId, userId, false, true); // Notify disconnect
      this.chatService.broadcastTalkState(peer.roomId, userId, false); // Ensure talk off
    } 
    this.peers.delete(userId);
    logger.info(`Peer unregistered: ${userId}`);
  }

  async signal(fromUserId: string, toUserId: string, signal: any, roomId?: string) {
    const fromPeer = this.peers.get(fromUserId);
    if (!fromPeer) {
      logger.warn(`Signal failed: from ${fromUserId} not found`);
      return;
    }

    // Handle talk toggle
    if (signal.type === 'talk-on' || signal.type === 'talk-off') {
      await this.chatService.broadcastTalkState(roomId || '', fromUserId, signal.type === 'talk-on'); // Use chatService broadcast
      return;
    }

    const toPeer = this.peers.get(toUserId);
    if (toPeer && toPeer.ws.readyState === WebSocket.OPEN) {
      toPeer.ws.send(JSON.stringify({ type: 'webrtc-signal', fromUserId, signal }));
      logger.info(`Signal from ${fromUserId} to ${toUserId} in room ${roomId || 'none'}`);
    } else {
      logger.warn(`Peer ${toUserId} not found or not open for signal`);
    }
  }

  setVideoStatus(userId: string, hasVideo: boolean) {
    const peer = this.peers.get(userId);
    if (peer && peer.roomId) {
      peer.hasVideo = hasVideo;
      this.broadcastPeers(peer.roomId, userId, hasVideo);
    }
  }

  private broadcastPeers(roomId: string, userId: string, hasVideo: boolean, isDisconnect: boolean = false) {
    const clients = this.chatService.getRoomClients(roomId);
    clients.forEach((client, peerId) => {
      if (peerId !== userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'webrtc-peer-update',
          userId,
          connect: !isDisconnect,
          hasVideo
        }));
      }
    });
  }
}