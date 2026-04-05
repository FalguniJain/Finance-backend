import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboard.service";
import { sendSuccess } from "../utils/helpers";

export class DashboardController {
  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };
      const summary = await DashboardService.getSummary(startDate, endDate);
      return sendSuccess(res, summary, "Dashboard summary retrieved");
    } catch (err) {
      next(err);
    }
  }

  static async getCategoryBreakdown(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };
      const breakdown = await DashboardService.getCategoryBreakdown(startDate, endDate);
      return sendSuccess(res, breakdown, "Category breakdown retrieved");
    } catch (err) {
      next(err);
    }
  }

  static async getTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const { period, months } = req.query as {
        period?: "monthly" | "weekly";
        months?: string;
      };
      const trends = await DashboardService.getTrends(
        period ?? "monthly",
        months ? parseInt(months) : 6
      );
      return sendSuccess(res, trends, "Trends retrieved");
    } catch (err) {
      next(err);
    }
  }

  static async getRecentActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit } = req.query as { limit?: string };
      const activity = await DashboardService.getRecentActivity(
        limit ? parseInt(limit) : 10
      );
      return sendSuccess(res, activity, "Recent activity retrieved");
    } catch (err) {
      next(err);
    }
  }

  static async getTopCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { type, limit } = req.query as {
        type?: "INCOME" | "EXPENSE";
        limit?: string;
      };
      const top = await DashboardService.getTopCategories(
        type ?? "EXPENSE",
        limit ? parseInt(limit) : 5
      );
      return sendSuccess(res, top, "Top categories retrieved");
    } catch (err) {
      next(err);
    }
  }
}
