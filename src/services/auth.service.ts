import bcrypt from 'bcryptjs';
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
