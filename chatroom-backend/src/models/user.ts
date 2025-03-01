import { DatabaseClient } from '../types';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  isGuest: boolean;
  role: 'admin' | 'moderator' | 'user';
  createdAt: number;
}

export class UserModel {
  constructor(private db: DatabaseClient) {}

  async create(user: User): Promise<string> {
    const { id, username, passwordHash, isGuest, role, createdAt } = user;
    await this.db.run(
      'INSERT INTO users (id, username, passwordHash, isGuest, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [id, username, passwordHash, isGuest ? 1 : 0, role, createdAt]
    );
    return id;
  }

  async findByUsername(username: string): Promise<User | undefined> {
    // Define the raw row type from the database
    const row: { id: string; username: string; passwordHash: string; isGuest: number; role: string; createdAt: number } | undefined =
      await this.db.get('SELECT * FROM users WHERE username = ?', [username]);
    return row ? {
      id: row.id,
      username: row.username,
      passwordHash: row.passwordHash,
      isGuest: !!row.isGuest,
      role: row.role as 'admin' | 'moderator' | 'user',
      createdAt: row.createdAt
    } : undefined;
  }

  async findById(id: string): Promise<User | undefined> {
    // Define the raw row type from the database
    const row: { id: string; username: string; passwordHash: string; isGuest: number; role: string; createdAt: number } | undefined =
      await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
    return row ? {
      id: row.id,
      username: row.username,
      passwordHash: row.passwordHash,
      isGuest: !!row.isGuest,
      role: row.role as 'admin' | 'moderator' | 'user',
      createdAt: row.createdAt
    } : undefined;
  }

  async getAll(): Promise<User[]> {
    // Define the raw row type from the database
    const rows: { id: string; username: string; passwordHash: string; isGuest: number; role: string; createdAt: number }[] =
      await this.db.all('SELECT * FROM users', []); // Add empty params array
    return rows.map(row => ({
      id: row.id,
      username: row.username,
      passwordHash: row.passwordHash,
      isGuest: !!row.isGuest,
      role: row.role as 'admin' | 'moderator' | 'user',
      createdAt: row.createdAt
    }));
  }
}