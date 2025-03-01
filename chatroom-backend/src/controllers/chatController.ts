import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '../services/authService';
import { ChatService } from '../services/chatService';
import { RoomModel } from '../models/room';
import { UserModel } from '../models/user';
import { db } from '../config/database';
import { authMiddleware } from '../middleware/security';
import { adminMiddleware } from '../middleware/admin';
import { ApiResponse, TokenResponse, Room, Message, User } from '../types';

export class ChatController {
  private authService: AuthService;
  private chatService: ChatService;
  private roomModel: RoomModel;
  private userModel: UserModel;

  constructor() {
    this.authService = new AuthService();
    this.chatService = new ChatService();
    this.roomModel = new RoomModel(db.getDb());
    this.userModel = new UserModel(db.getDb());
  }

  public getRouter(): Router {
    const router = Router();

    router.post('/register', this.register.bind(this));
    router.post('/login', this.login.bind(this));
    router.post('/guest', this.guest.bind(this));
    router.post('/rooms', authMiddleware, this.createRoom.bind(this));
    router.get('/rooms', this.getRooms.bind(this));
    router.get('/rooms/:roomId/history', authMiddleware, this.getRoomHistory.bind(this));
    router.get('/admin/users', authMiddleware, adminMiddleware, this.getUsers.bind(this));
    router.delete('/admin/rooms/:roomId', authMiddleware, adminMiddleware, this.deleteRoom.bind(this));
    router.put('/admin/rooms/:roomId/talk-time', authMiddleware, adminMiddleware, this.setTalkTime.bind(this));

    return router;
  }

  async register(req: Request, res: Response<ApiResponse<TokenResponse>>) {
    const { username, password } = req.body;
    try {
      const token = await this.authService.register(username, password);
      const user = await this.userModel.findByUsername(username);
      res.json({ data: { token, userId: user!.id } }); // Return userId
    } catch (error) {
      res.status(400).json({ error: 'Username taken or invalid input' });
    }
  }

  async login(req: Request, res: Response<ApiResponse<TokenResponse>>) {
    const { username, password } = req.body;
    const token = await this.authService.login(username, password);
    if (!token) return res.status(401).json({ error: 'Invalid credentials' });
    const user = await this.userModel.findByUsername(username);
    res.json({ data: { token, userId: user!.id } }); // Return userId
  }

  async guest(req: Request, res: Response<ApiResponse<TokenResponse>>) {
    const { preferredName } = req.body || {};
    const token = await this.authService.createGuest(preferredName);
    const decoded = require('jsonwebtoken').decode(token); // Use backend jwt
    res.json({ data: { token, userId: decoded.userId } }); // Return userId
  }

  async createRoom(req: Request, res: Response<ApiResponse<Room>>) {
    const { name, isPublic } = req.body;
    const room: Room = {
      id: uuidv4(),
      name,
      creatorId: (req as any).userId,
      isPublic: isPublic ?? true,
      createdAt: Date.now()
    };
    await this.roomModel.create(room);
    res.json({ data: room });
  }

  async getRooms(req: Request, res: Response<ApiResponse<(Room & { userCount: number })[]>>) {
    const rooms = await this.roomModel.getAllPublic();
    const roomsWithCounts = rooms.map(room => ({
      ...room,
      userCount: this.chatService.getRoomUserCount(room.id)
    }));
    res.json({ data: roomsWithCounts });
  }

  async getRoomHistory(req: Request, res: Response<ApiResponse<Message[]>>) {
    const history = await this.chatService.getRoomHistory(req.params.roomId);
    res.json({ data: history });
  }

  async getUsers(req: Request, res: Response<ApiResponse<User[]>>) {
    const users = await this.userModel.getAll();
    res.json({ data: users });
  }

  async deleteRoom(req: Request, res: Response<ApiResponse<{ success: boolean }>>) {
    await this.roomModel.delete(req.params.roomId);
    res.json({ data: { success: true } });
  }

  async setTalkTime(req: Request, res: Response<ApiResponse<{ success: boolean }>>) {
    const { talkTimeLimit } = req.body;
    if (typeof talkTimeLimit !== 'number' || talkTimeLimit < 0) {
      return res.status(400).json({ error: 'Invalid talk time limit' });
    }
    await this.roomModel.updateTalkTime(req.params.roomId, talkTimeLimit);
    res.json({ data: { success: true } });
  }
}