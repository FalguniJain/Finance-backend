import { Router } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import {
  authenticate,
  requireAnalyst,
  requireViewer,
} from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { dashboardQuerySchema, trendsQuerySchema } from "../validations/schemas";

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Aggregated analytics and summary endpoints
 */

/**
 * @swagger
 * /dashboard/summary:
 *   get:
 *     summary: Get financial summary (total income, expenses, net balance)
 *     tags: [Dashboard]
 *     description: Available to all authenticated users (VIEWER, ANALYST, ADMIN)
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *         description: Filter from date (ISO 8601)
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Financial summary
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Dashboard summary retrieved"
 *               data:
 *                 totalIncome: 50000
 *                 totalExpenses: 32000
 *                 netBalance: 18000
 *                 transactionCount: 48
 *                 incomeTransactions: 15
 *                 expenseTransactions: 33
 */
router.get(
  "/summary",
  requireViewer,
  validate(dashboardQuerySchema, "query"),
  DashboardController.getSummary
);

/**
 * @swagger
 * /dashboard/categories:
 *   get:
 *     summary: Get category-wise income and expense breakdown
 *     tags: [Dashboard]
 *     description: Requires ANALYST or ADMIN role
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Category breakdown with totals and percentages
 *       403:
 *         description: Insufficient role
 */
router.get(
  "/categories",
  requireAnalyst,
  validate(dashboardQuerySchema, "query"),
  DashboardController.getCategoryBreakdown
);

/**
 * @swagger
 * /dashboard/trends:
 *   get:
 *     summary: Get income vs expense trends over time
 *     tags: [Dashboard]
 *     description: Requires ANALYST or ADMIN role
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [monthly, weekly], default: monthly }
 *       - in: query
 *         name: months
 *         schema: { type: integer, default: 6, minimum: 1, maximum: 24 }
 *         description: How many months of history to return
 *     responses:
 *       200:
 *         description: Time-series trend data
 */
router.get(
  "/trends",
  requireAnalyst,
  validate(trendsQuerySchema, "query"),
  DashboardController.getTrends
);

/**
 * @swagger
 * /dashboard/recent:
 *   get:
 *     summary: Get recent transaction activity
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Most recent transactions
 */
router.get("/recent", requireViewer, DashboardController.getRecentActivity);

/**
 * @swagger
 * /dashboard/top-categories:
 *   get:
 *     summary: Get top spending or earning categories
 *     tags: [Dashboard]
 *     description: Requires ANALYST or ADMIN role
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE], default: EXPENSE }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5 }
 *     responses:
 *       200:
 *         description: Top categories by total amount
 */
router.get("/top-categories", requireAnalyst, DashboardController.getTopCategories);

export default router;
