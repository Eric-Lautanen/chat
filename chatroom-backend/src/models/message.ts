import { DatabaseClient } from '../types';
import { logger } from '../utils/logger';

export interface Message {
  id?: number;
  roomId: string;
  userId: string;
  username?: string;
  content: string;
  timestamp: number;
}

export class MessageModel {
  constructor(private db: DatabaseClient) {}

  async create(message: Message): Promise<number> {
    const { roomId, userId, username, content, timestamp } = message;
    try {
      const result = await this.db.run(
        'INSERT INTO messages (roomId, userId, username, content, timestamp) VALUES (?, ?, ?, ?, ?)',
        [roomId, userId, username || 'Unknown', content, timestamp]
      );
      return result.lastID!;
    } catch (error: any) {
      logger.error(`Failed to create message: ${error.message}`);
      throw error;
    }
  }

  async getByRoom(roomId: string, limit = 50): Promise<Message[]> {
    try {
      const rows: { id: number; roomId: string; userId: string; username?: string; content: string; timestamp: number }[] = await this.db.all(
        'SELECT id, roomId, userId, COALESCE(username, \'Unknown\') as username, content, timestamp FROM messages WHERE roomId = ? ORDER BY timestamp ASC LIMIT ?',
        [roomId, limit]
      );
      return rows.map(row => ({
        id: row.id,
        roomId: row.roomId,
        userId: row.userId,
        username: row.username,
        content: row.content,
        timestamp: row.timestamp
      }));
    } catch (error: any) {
      logger.error(`Failed to get room history: ${error.message}`);
      return [];
    }
  }
}