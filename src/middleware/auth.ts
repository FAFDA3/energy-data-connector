import type { Request, Response, NextFunction } from 'express';
import { validateToken } from '../services/sessionManager.js';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const token = authHeader.substring('Bearer '.length).trim();
  const session = validateToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  (req as any).session = session;
  return next();
}
