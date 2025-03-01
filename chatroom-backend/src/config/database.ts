import sqlite3 from 'sqlite3';
import { DatabaseClient } from '../types';

export class Database {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3.Database('./chatroom.db', (err) => {
      if (err) console.error('Database connection error:', err);
    });
    this.initialize();
  }

  private async initialize() {
    const run = this.promisifyRun(this.db.run.bind(this.db));

    await run(
      `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        roomId TEXT NOT NULL,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        messageType TEXT DEFAULT 'text',
        timestamp INTEGER NOT NULL
      )
    `,
      []
    );

    await run(
      `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        expires INTEGER NOT NULL
      )
    `,
      []
    );

    await run(
      `
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        creatorId TEXT NOT NULL,
        isPublic INTEGER NOT NULL DEFAULT 1,
        talkTimeLimit INTEGER DEFAULT 30000, -- 30s default in ms
        createdAt INTEGER NOT NULL
      )
    `,
      []
    );

    await run(
      `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT,
        isGuest INTEGER NOT NULL DEFAULT 0,
        role TEXT NOT NULL DEFAULT 'user',
        createdAt INTEGER NOT NULL
      )
    `,
      []
    );
  }

  private promisifyRun(
    run: (sql: string, params: any[], callback: (this: sqlite3.RunResult, err: Error | null) => void) => void
  ): (sql: string, params: any[]) => Promise<{ lastID?: number; changes?: number }> {
    return (sql: string, params: any[]) => {
      return new Promise((resolve, reject) => {
        run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      });
    };
  }

  public getDb(): DatabaseClient {
    return {
      run: this.promisifyRun(this.db.run.bind(this.db)),
      get: <T>(sql: string, params: any[]): Promise<T | undefined> => {
        return new Promise((resolve, reject) => {
          this.db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row as T | undefined);
          });
        });
      },
      all: <T>(sql: string, params: any[]): Promise<T[]> => {
        return new Promise((resolve, reject) => {
          this.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows as T[]);
          });
        });
      }
    };
  }

  public close() {
    this.db.close();
  }
}

export const db = new Database();