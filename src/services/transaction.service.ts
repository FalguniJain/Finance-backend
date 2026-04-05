import { Prisma } from '@prisma/client';
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
