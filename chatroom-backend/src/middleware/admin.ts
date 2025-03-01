import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/user';
import { db } from '../config/database';

export const adminMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).userId;
  const userModel = new UserModel(db.getDb());
  const user = await userModel.findById(userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};