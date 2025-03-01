import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

export const securityMiddleware = [
  helmet(),
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:"]
    }
  })
];

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authService = new AuthService();
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const userId = await authService.verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  (req as any).userId = userId;
  next();
};