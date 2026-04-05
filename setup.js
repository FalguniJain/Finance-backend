const fs = require('fs');
fs.mkdirSync('src/middlewares', { recursive: true });
fs.mkdirSync('src/validations', { recursive: true });
fs.mkdirSync('src/utils', { recursive: true });

// ── error.middleware.ts ──────────────────────────────────────
fs.writeFileSync('src/middlewares/error.middleware.ts', `import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { config } from '../config/env';

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'A record with this value already exists.' });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, message: 'Record not found.' });
      return;
    }
  }
  const err = error as Error;
  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
    ...(config.isDev && { stack: err.stack }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: 'Route ' + req.method + ' ' + req.path + ' not found.',
  });
};
`);

// ── auth.middleware.ts ───────────────────────────────────────
fs.writeFileSync('src/middlewares/auth.middleware.ts', `import { Request, Response, NextFunction } from 'express';
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
`);

// ── validate.middleware.ts ───────────────────────────────────
fs.writeFileSync('src/middlewares/validate.middleware.ts', `import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (
  schema: ZodSchema,
  part: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      res.status(400).json({ success: false, message: 'Validation failed', errors });
      return;
    }
    (req as Record<string, unknown>)[part] = result.data;
    next();
  };
};
`);

// ── helpers.ts ───────────────────────────────────────────────
fs.writeFileSync('src/utils/helpers.ts', `import { Response } from 'express';

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = 'Success',
  statusCode = 200,
  meta?: unknown
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    ...(meta && { meta }),
  });
};

export const sendCreated = (res: Response, data: unknown, message = 'Created successfully') =>
  sendSuccess(res, data, message, 201);

export const buildPaginationMeta = (total: number, page: number, limit: number) => {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
};

export const getPaginationOffset = (page: number, limit: number) => (page - 1) * limit;
`);

// ── validations/schemas.ts ───────────────────────────────────
fs.writeFileSync('src/validations/schemas.ts', `import { z } from 'zod';
import { Role, UserStatus, TransactionType } from '@prisma/client';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createUserSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.nativeEnum(Role).optional().default(Role.VIEWER),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const createTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.nativeEnum(TransactionType),
  category: z.string().min(1).max(100).trim(),
  date: z.string().datetime({ message: 'Date must be ISO 8601 format e.g. 2024-01-01T00:00:00Z' }),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).max(10).optional().default([]),
});

export const updateTransactionSchema = z.object({
  amount: z.number().positive().optional(),
  type: z.nativeEnum(TransactionType).optional(),
  category: z.string().min(1).max(100).trim().optional(),
  date: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string()).max(10).optional(),
});

export const transactionFilterSchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  category: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['date', 'amount', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const dashboardQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const trendsQuerySchema = z.object({
  period: z.enum(['weekly', 'monthly']).optional().default('monthly'),
  months: z.coerce.number().int().min(1).max(24).optional().default(6),
});
`);

console.log('All files created successfully!');
console.log('Now run: npm run dev');