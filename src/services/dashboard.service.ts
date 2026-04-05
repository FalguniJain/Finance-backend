import { Prisma } from '@prisma/client';
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
