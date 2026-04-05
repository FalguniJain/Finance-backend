import prisma from '../config/database';
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
