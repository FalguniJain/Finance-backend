import { Request, Response, NextFunction } from "express";
import { UserService } from "../services/user.service";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendCreated } from "../utils/helpers";

export class UserController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.createUser(req.body);
      return sendCreated(res, user, "User created successfully");
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search } = req.query as {
        page?: string;
        limit?: string;
        search?: string;
      };
      const result = await UserService.listUsers(
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20,
        search
      );
      return sendSuccess(res, result.users, "Users retrieved", 200, result.meta);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.getUserById(req.params.id);
      return sendSuccess(res, user, "User retrieved");
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.updateUser(req.params.id, req.body);
      return sendSuccess(res, user, "User updated successfully");
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const requestingUserId = (req as AuthenticatedRequest).user.userId;
      await UserService.deleteUser(req.params.id, requestingUserId);
      return sendSuccess(res, null, "User deleted successfully");
    } catch (err) {
      next(err);
    }
  }

  static async stats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await UserService.getUserStats();
      return sendSuccess(res, stats, "User stats retrieved");
    } catch (err) {
      next(err);
    }
  }
}
