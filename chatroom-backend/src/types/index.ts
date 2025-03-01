export type WebSocketMessage =
  | { type: 'join'; roomId: string }
  | { type: 'message'; roomId: string; content: string }
  | { type: 'webrtc-signal'; toUserId: string; signal: any; roomId: string }
  | { type: 'webrtc-register'; roomId: string }
  | { type: 'activeUsers'; users: string[] }
  | { type: 'webrtc-peer-update'; userId: string; connect: boolean; hasVideo?: boolean };

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface TokenResponse {
  token: string;
  userId: string; // Added
}

export interface User {
  id: string;
  username: string;
  passwordHash?: string;
  isGuest: boolean;
  role: 'admin' | 'moderator' | 'user';
  createdAt: number;
}

export interface Room {
  id: string;
  name: string;
  creatorId: string;
  isPublic: boolean;
  talkTimeLimit?: number;
  createdAt: number;
  userCount?: number;
}

export interface Message {
  id?: number;
  roomId: string;
  userId: string;
  username?: string;
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  userId: string;
  expires: number;
}

export interface DatabaseClient {
  run(sql: string, params: any[]): Promise<{ lastID?: number; changes?: number }>;
  get<T>(sql: string, params: any[]): Promise<T | undefined>;
  all<T>(sql: string, params: any[]): Promise<T[]>;
}