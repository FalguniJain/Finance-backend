import { Request, Response, NextFunction } from "express";
import { TransactionService } from "../services/transaction.service";
import { AuthenticatedRequest, TransactionFilters } from "../types";
import { sendSuccess, sendCreated } from "../utils/helpers";

export class TransactionController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as AuthenticatedRequest).user.userId;
      const tx = await TransactionService.createTransaction(req.body, userId);
      return sendCreated(res, tx, "Transaction created successfully");
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = req.query as unknown as TransactionFilters;

      // Parse comma-separated tags from query string
      if (typeof filters.tags === "string") {
        (filters as unknown as Record<string, unknown>).tags = filters.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }

      const result = await TransactionService.listTransactions(filters);
      return sendSuccess(res, result.transactions, "Transactions retrieved", 200, result.meta);
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const tx = await TransactionService.getTransactionById(req.params.id);
      return sendSuccess(res, tx, "Transaction retrieved");
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const tx = await TransactionService.updateTransaction(req.params.id, req.body);
      return sendSuccess(res, tx, "Transaction updated successfully");
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await TransactionService.deleteTransaction(req.params.id);
      return sendSuccess(res, null, "Transaction deleted successfully");
    } catch (err) {
      next(err);
    }
  }

  static async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await TransactionService.getCategories();
      return sendSuccess(res, categories, "Categories retrieved");
    } catch (err) {
      next(err);
    }
  }
}
