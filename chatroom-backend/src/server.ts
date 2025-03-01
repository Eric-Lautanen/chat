import express from 'express';
import WebSocket from 'ws';
import path from 'path';
import jwt from 'jsonwebtoken';
import { ChatService } from './services/chatService';
import { WebRTCService } from './services/webRTCSignalService';
import { AuthService } from './services/authService';
import { ChatController } from './controllers/chatController';
import { securityMiddleware } from './middleware/security';
import { logger } from './utils/logger';
import { WebSocketMessage } from './types';

const app = express();
const server = app.listen(3000, () => logger.info('Server running on port 3000'));
const wss = new WebSocket.Server({ server });

const chatService = new ChatService();
const webRTCService = new WebRTCService(chatService);
const authService = new AuthService();
const chatController = new ChatController();

app.use(securityMiddleware);
app.use(express.json());
app.use('/api', chatController.getRouter());
app.use(express.static(path.join(__dirname, '../../public')));

wss.on('connection', async (ws: WebSocket, req) => {
  const token = new URLSearchParams(req.url?.split('?')[1]).get('token');
  if (!token) {
    ws.close(4001, 'Authentication required');
    return;
  }

  const userId = await authService.verifyToken(token);
  if (!userId) {
    ws.close(4002, 'Invalid token');
    return;
  }

  const decoded = jwt.decode(token) as { userId: string; username?: string };
  const username = decoded.username || 'Unknown';

  ws.on('message', async (data: string) => {
    try {
      const message = JSON.parse(data) as WebSocketMessage;

      switch (message.type) {
        case 'join':
          await chatService.joinRoom(ws, message.roomId, userId, username);
          break;

        case 'message':
          await chatService.broadcastMessage(message.roomId, {
            userId,
            content: message.content
          });
          break;

        case 'webrtc-signal':
          await webRTCService.signal(userId, message.toUserId, message.signal, message.roomId);
          break;

        case 'webrtc-register':
          webRTCService.registerPeer(userId, ws, message.roomId);
          break;
      }
    } catch (error) {
      logger.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    chatService.leaveAllRooms(ws, userId);
    webRTCService.unregisterPeer(userId);
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});