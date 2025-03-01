import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { UserModel } from '../models/user';
import { DatabaseClient, Session } from '../types';

export class AuthService {
  private secret = process.env.JWT_SECRET || 'your-secure-secret';
  private db: DatabaseClient = db.getDb();
  private userModel = new UserModel(this.db);

  async generateToken(userId: string, username?: string): Promise<string> {
    const payload = username ? { userId, username } : { userId };
    const token = jwt.sign(payload, this.secret, { expiresIn: '24h' });
    await this.db.run(
      'INSERT OR REPLACE INTO sessions (id, userId, expires) VALUES (?, ?, ?)',
      [token, userId, Date.now() + 24 * 60 * 60 * 1000]
    );
    return token;
  }

  async verifyToken(token: string): Promise<string | null> {
    try {
      const session: Session | undefined = await this.db.get('SELECT * FROM sessions WHERE id = ?', [token]);
      if (!session || session.expires < Date.now()) return null;

      const decoded = jwt.verify(token, this.secret) as { userId: string; username?: string };
      return decoded.userId;
    } catch (error) {
      return null;
    }
  }

  async register(username: string, password: string): Promise<string> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      username,
      passwordHash,
      isGuest: false,
      role: 'user' as const,
      createdAt: Date.now()
    };
    await this.userModel.create(user);
    return this.generateToken(user.id, username);
  }

  async login(username: string, password: string): Promise<string | null> {
    const user = await this.userModel.findByUsername(username);
    if (!user || user.isGuest || !(await bcrypt.compare(password, user.passwordHash))) {
      return null;
    }
    return this.generateToken(user.id, username);
  }

  async createGuest(preferredName: string = 'Guest'): Promise<string> {
    let username = preferredName;
    let suffix = 0;
    while (await this.userModel.findByUsername(username)) {
      suffix++;
      username = `${preferredName}${suffix}`;
    }
    const userId = uuidv4();
    return this.generateToken(userId, username);
  }
}