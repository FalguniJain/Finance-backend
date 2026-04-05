import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/env';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: Role };
}

const ROLE_LEVEL: Record<Role, number> = {
  VIEWER: 1,
  ANALYST: 2,
  ADMIN: 3,
};

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401);
    }
    const token = auth.slice(7);
    const payload = jwt.verify(token, config.jwt.secret) as AuthenticatedRequest['user'];
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) return next(new AppError('Token expired', 401));
    if (e instanceof jwt.JsonWebTokenError) return next(new AppError('Invalid token', 401));
    next(e);
  }
};

export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;
    if (!user) return next(new AppError('Authentication required', 401));
    const hasAccess = roles.some((r) => ROLE_LEVEL[user.role] >= ROLE_LEVEL[r]);
    if (!hasAccess) {
      return next(
        new AppError(
          'Permission denied. Required: ' + roles.join(' or ') + ', your role: ' + user.role,
          403
        )
      );
    }
    next();
  };
};

export const requireAdmin = requireRole(Role.ADMIN);
export const requireAnalyst = requireRole(Role.ANALYST);
export const requireViewer = requireRole(Role.VIEWER);
