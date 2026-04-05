const fs = require('fs');
fs.mkdirSync('src/services', { recursive: true });

// ── auth.service.ts ──────────────────────────────────────────
fs.writeFileSync('src/services/auth.service.ts', `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middlewares/error.middleware';

export class AuthService {
  static generateAccessToken(payload: object): string {
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as string });
  }

  static generateRefreshToken(payload: object): string {
    return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn as string });
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await bcrypt.compare(password, '$2a$12$invalidhashfortimingattackprevention');
      throw new AppError('Invalid email or password.', 401);
    }
    if (user.status === 'INACTIVE') throw new AppError('Account is deactivated.', 401);

    const valid = await this.comparePassword(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid email or password.', 401);

    const tokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(tokenPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  static async refreshToken(token: string) {
    let payload: any;
    try {
      payload = jwt.verify(token, config.jwt.refreshSecret);
    } catch {
      throw new AppError('Invalid or expired refresh token.', 401);
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      if (stored) await prisma.refreshToken.delete({ where: { token } });
      throw new AppError('Refresh token expired.', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.status === 'INACTIVE') throw new AppError('User not found.', 401);

    await prisma.refreshToken.delete({ where: { token } });
    const newPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = this.generateAccessToken(newPayload);
    const refreshToken2 = this.generateRefreshToken(newPayload);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshToken2, userId: user.id, expiresAt } });

    return { accessToken, refreshToken: refreshToken2 };
  }

  static async logout(token: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
    });
    if (!user) throw new AppError('User not found.', 404);
    return user;
  }
}
`);

// ── user.service.ts ──────────────────────────────────────────
fs.writeFileSync('src/services/user.service.ts', `import prisma from '../config/database';
import { AuthService } from './auth.service';
import { AppError } from '../middlewares/error.middleware';
import { buildPaginationMeta, getPaginationOffset } from '../utils/helpers';

const USER_SELECT = { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true } as const;

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
    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {};
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
    const [total, byRole, byStatus] = await prisma.$transaction([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.groupBy({ by: ['status'], _count: true }),
    ]);
    return {
      total,
      byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count])),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    };
  }
}
`);

// ── transaction.service.ts ───────────────────────────────────
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
  static async create(dto: any, userId: string) {
    const tx = await prisma.transaction.create({
      data: {
        amount: new Prisma.Decimal(dto.amount),
        type: dto.type, category: dto.category.trim(),
        date: new Date(dto.date), description: dto.description,
        notes: dto.notes, tags: dto.tags || [], createdById: userId,
      },
      select: TX_SELECT,
    });
    return serialize(tx);
  }

  static async list(filters: any) {
    const { type, category, startDate, endDate, minAmount, maxAmount, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
    const where: any = { isDeleted: false };
    if (type) where.type = type;
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (startDate || endDate) where.date = { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) };
    if (minAmount !== undefined || maxAmount !== undefined) where.amount = { ...(minAmount !== undefined && { gte: new Prisma.Decimal(minAmount) }), ...(maxAmount !== undefined && { lte: new Prisma.Decimal(maxAmount) }) };
    if (search) where.OR = [{ description: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }, { notes: { contains: search, mode: 'insensitive' } }];

    const offset = getPaginationOffset(page, limit);
    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({ where, select: TX_SELECT, skip: offset, take: limit, orderBy: { [sortBy]: sortOrder } }),
      prisma.transaction.count({ where }),
    ]);
    return { transactions: transactions.map(serialize), meta: buildPaginationMeta(total, page, limit) };
  }

  static async getById(id: string) {
    const tx = await prisma.transaction.findFirst({ where: { id, isDeleted: false }, select: TX_SELECT });
    if (!tx) throw new AppError('Transaction not found.', 404);
    return serialize(tx);
  }

  static async update(id: string, dto: any) {
    await this.getById(id);
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

  static async softDelete(id: string) {
    await this.getById(id);
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

// ── dashboard.service.ts ─────────────────────────────────────
fs.writeFileSync('src/services/dashboard.service.ts', `import { Prisma } from '@prisma/client';
import prisma from '../config/database';

export class DashboardService {
  static async getSummary(startDate?: string, endDate?: string) {
    const dateFilter = startDate || endDate ? { date: { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) } } : {};
    const base = { isDeleted: false, ...dateFilter };
    const [income, expense, count] = await prisma.$transaction([
      prisma.transaction.aggregate({ where: { ...base, type: 'INCOME' }, _sum: { amount: true }, _count: true }),
      prisma.transaction.aggregate({ where: { ...base, type: 'EXPENSE' }, _sum: { amount: true }, _count: true }),
      prisma.transaction.count({ where: base }),
    ]);
    const totalIncome = parseFloat(income._sum.amount?.toString() || '0');
    const totalExpenses = parseFloat(expense._sum.amount?.toString() || '0');
    return { totalIncome, totalExpenses, netBalance: totalIncome - totalExpenses, transactionCount: count, incomeTransactions: income._count, expenseTransactions: expense._count, period: { startDate: startDate || null, endDate: endDate || null } };
  }

  static async getCategoryBreakdown(startDate?: string, endDate?: string) {
    const dateFilter = startDate || endDate ? { date: { ...(startDate && { gte: new Date(startDate) }), ...(endDate && { lte: new Date(endDate) }) } } : {};
    const grouped = await prisma.transaction.groupBy({
      by: ['category', 'type'],
      where: { isDeleted: false, ...dateFilter },
      _sum: { amount: true }, _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });
    const totals: Record<string, number> = { INCOME: 0, EXPENSE: 0 };
    for (const row of grouped) totals[row.type] = (totals[row.type] || 0) + parseFloat(row._sum.amount?.toString() || '0');
    return grouped.map((row) => {
      const total = parseFloat(row._sum.amount?.toString() || '0');
      return { category: row.category, type: row.type, total, count: row._count, percentage: totals[row.type] > 0 ? parseFloat(((total / totals[row.type]) * 100).toFixed(2)) : 0 };
    });
  }

  static async getTrends(period: 'monthly' | 'weekly' = 'monthly', months = 6) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);
    const transactions = await prisma.transaction.findMany({
      where: { isDeleted: false, date: { gte: startDate } },
      select: { amount: true, type: true, date: true },
      orderBy: { date: 'asc' },
    });
    const buckets = new Map<string, { income: number; expenses: number }>();
    for (const tx of transactions) {
      const key = period === 'monthly'
        ? tx.date.getFullYear() + '-' + String(tx.date.getMonth() + 1).padStart(2, '0')
        : tx.date.getFullYear() + '-W' + String(Math.ceil(tx.date.getDate() / 7)).padStart(2, '0');
      if (!buckets.has(key)) buckets.set(key, { income: 0, expenses: 0 });
      const b = buckets.get(key)!;
      const amount = parseFloat(tx.amount.toString());
      if (tx.type === 'INCOME') b.income += amount;
      else b.expenses += amount;
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([p, d]) => ({ period: p, income: parseFloat(d.income.toFixed(2)), expenses: parseFloat(d.expenses.toFixed(2)), net: parseFloat((d.income - d.expenses).toFixed(2)) }));
  }

  static async getRecentActivity(limit = 10) {
    const txs = await prisma.transaction.findMany({
      where: { isDeleted: false },
      select: { id: true, amount: true, type: true, category: true, date: true, description: true, createdAt: true, createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
    return txs.map((tx) => ({ ...tx, amount: parseFloat(tx.amount.toString()) }));
  }

  static async getTopCategories(type: 'INCOME' | 'EXPENSE' = 'EXPENSE', limit = 5) {
    const grouped = await prisma.transaction.groupBy({
      by: ['category'],
      where: { isDeleted: false, type },
      _sum: { amount: true }, _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });
    return grouped.map((r) => ({ category: r.category, total: parseFloat(r._sum.amount?.toString() || '0'), count: r._count }));
  }
}
`);

console.log('All service files created!');
console.log('Run: npm run dev');