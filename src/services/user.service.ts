import prisma from '../config/database';
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
