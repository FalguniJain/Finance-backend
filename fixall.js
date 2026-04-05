const fs = require('fs');

// ── Fix 1: types/index.ts - add TransactionFilters ──────────
fs.writeFileSync('src/types/index.ts', `import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export interface TransactionFilters {
  type?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  tags?: string | string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
`);
console.log('✅ types/index.ts fixed');

// ── Fix 2: validate.middleware.ts ────────────────────────────
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
      for (const issue of (result as any).error.issues) {
        const path = issue.path.join('.') || '_root';
        if (!errors[path]) errors[path] = [];
        errors[path].push(issue.message);
      }
      res.status(400).json({ success: false, message: 'Validation failed', errors });
      return;
    }
    (req as any)[part] = result.data;
    next();
  };
};
`);
console.log('✅ validate.middleware.ts fixed');

// ── Fix 3: transaction.service.ts - fix method names ─────────
fs.writeFileSync('src/services/transaction.service.ts', `import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { AppError } from '../middlewares/error.middleware';
import { buildPaginationMeta, getPaginationOffset } from '../utils/helpers';

const TX_SELECT = {
  id: true, amount: true, type: true, category: true, date: true,
  description: true, notes: true, tags: true, createdAt: true, updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

const serialize = (tx: any) => ({ ...tx, amount: parseFloat(tx.amount.toString()) });

export class TransactionService {
  static async createTransaction(dto: any, userId: string) {
    const tx = await prisma.transaction.create({
      data: {
        amount: new Prisma.Decimal(dto.amount),
        type: dto.type,
        category: dto.category.trim(),
        date: new Date(dto.date),
        description: dto.description,
        notes: dto.notes,
        tags: dto.tags || [],
        createdById: userId,
      },
      select: TX_SELECT,
    });
    return serialize(tx);
  }

  static async listTransactions(filters: any) {
    const {
      type, category, startDate, endDate, minAmount, maxAmount,
      search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc'
    } = filters;

    const where: any = { isDeleted: false };
    if (type) where.type = type;
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (startDate || endDate) where.date = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
    if (minAmount !== undefined || maxAmount !== undefined) where.amount = {
      ...(minAmount !== undefined && { gte: new Prisma.Decimal(minAmount) }),
      ...(maxAmount !== undefined && { lte: new Prisma.Decimal(maxAmount) }),
    };
    if (search) where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];

    const offset = getPaginationOffset(Number(page), Number(limit));
    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where, select: TX_SELECT, skip: offset,
        take: Number(limit), orderBy: { [sortBy]: sortOrder },
      }),
      prisma.transaction.count({ where }),
    ]);
    return { transactions: transactions.map(serialize), meta: buildPaginationMeta(total, Number(page), Number(limit)) };
  }

  static async getTransactionById(id: string) {
    const tx = await prisma.transaction.findFirst({ where: { id, isDeleted: false }, select: TX_SELECT });
    if (!tx) throw new AppError('Transaction not found.', 404);
    return serialize(tx);
  }

  static async updateTransaction(id: string, dto: any) {
    await this.getTransactionById(id);
    const tx = await prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: new Prisma.Decimal(dto.amount) }),
        ...(dto.type && { type: dto.type }),
        ...(dto.category && { category: dto.category.trim() }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
      select: TX_SELECT,
    });
    return serialize(tx);
  }

  static async deleteTransaction(id: string) {
    await this.getTransactionById(id);
    await prisma.transaction.update({ where: { id }, data: { isDeleted: true } });
  }

  static async getCategories() {
    const result = await prisma.transaction.findMany({
      where: { isDeleted: false },
      select: { category: true, type: true },
      distinct: ['category', 'type'],
      orderBy: { category: 'asc' },
    });
    return result.reduce((acc: any, { category, type }) => {
      if (!acc[type]) acc[type] = [];
      if (!acc[type].includes(category)) acc[type].push(category);
      return acc;
    }, {});
  }
}
`);
console.log('✅ transaction.service.ts fixed');

// ── Fix 4: user.service.ts - fix groupBy orderBy ─────────────
fs.writeFileSync('src/services/user.service.ts', `import prisma from '../config/database';
import { AuthService } from './auth.service';
import { AppError } from '../middlewares/error.middleware';
import { buildPaginationMeta, getPaginationOffset } from '../utils/helpers';

const USER_SELECT = {
  id: true, name: true, email: true, role: true,
  status: true, createdAt: true, updatedAt: true,
} as const;

export class UserService {
  static async createUser(dto: { name: string; email: string; password: string; role?: any }) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new AppError('A user with this email already exists.', 409);
    const passwordHash = await AuthService.hashPassword(dto.password);
    return prisma.user.create({
      data: { name: dto.name, email: dto.email, passwordHash, role: dto.role || 'VIEWER' },
      select: USER_SELECT,
    });
  }

  static async listUsers(page = 1, limit = 20, search?: string) {
    const offset = getPaginationOffset(page, limit);
    const where: any = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    } : {};
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({ where, select: USER_SELECT, skip: offset, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);
    return { users, meta: buildPaginationMeta(total, page, limit) };
  }

  static async getUserById(id: string) {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new AppError('User not found.', 404);
    return user;
  }

  static async updateUser(id: string, dto: any) {
    await this.getUserById(id);
    if (dto.email) {
      const conflict = await prisma.user.findFirst({ where: { email: dto.email, id: { not: id } } });
      if (conflict) throw new AppError('Email already taken.', 409);
    }
    return prisma.user.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  static async deleteUser(id: string, requestingUserId: string) {
    if (id === requestingUserId) throw new AppError('Cannot delete your own account.', 400);
    await this.getUserById(id);
    await prisma.refreshToken.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
  }

  static async getUserStats() {
    const [total, allUsers] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.findMany({ select: { role: true, status: true } }),
    ]);

    const byRole: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const user of allUsers) {
      byRole[user.role] = (byRole[user.role] || 0) + 1;
      byStatus[user.status] = (byStatus[user.status] || 0) + 1;
    }

    return { total, byRole, byStatus };
  }
}
`);
console.log('✅ user.service.ts fixed');

// ── Fix 5: Update Render build command in package.json ────────
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts.build = 'prisma generate && tsc --skipLibCheck';
pkg.scripts.start = 'node dist/server.js';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('✅ package.json updated');

console.log('\n🎉 All fixes applied!');
console.log('Now run: git add . && git commit -m "Fix all TypeScript errors" && git push');