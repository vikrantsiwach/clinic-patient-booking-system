import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import env from '../config/env';
import { AuthUser } from '../types';

export const verifyToken: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or malformed token' });
    return;
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles: string[]): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'UNAUTHORIZED' }); return; }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'FORBIDDEN', message: `Required role: ${roles.join(' or ')}` });
      return;
    }
    next();
  };

export const requirePatient: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'patient') {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  next();
};

export const requireStaff: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !['receptionist', 'doctor', 'admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  next();
};

export const requireDoctorOrAdmin: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user || !['doctor', 'admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'FORBIDDEN' });
    return;
  }
  next();
};
