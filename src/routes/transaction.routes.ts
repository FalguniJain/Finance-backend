import { Router } from "express";
import { TransactionController } from "../controllers/transaction.controller";
import {
  authenticate,
  requireAdmin,
  requireAnalyst,
  requireViewer,
} from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionFilterSchema,
} from "../validations/schemas";

const router = Router();

// All transaction routes require authentication at minimum
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Financial record management
 */

/**
 * @swagger
 * /transactions:
 *   get:
 *     summary: List transactions with filtering and pagination
 *     tags: [Transactions]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: minAmount
 *         schema: { type: number }
 *       - in: query
 *         name: maxAmount
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search in description, category, or notes
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *         description: Comma-separated tags to filter by
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [date, amount, createdAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated list of transactions
 */
router.get(
  "/",
  requireViewer,
  validate(transactionFilterSchema, "query"),
  TransactionController.list
);

/**
 * @swagger
 * /transactions/categories:
 *   get:
 *     summary: Get all unique categories grouped by type
 *     tags: [Transactions]
 *     responses:
 *       200:
 *         description: Categories grouped by INCOME and EXPENSE
 */
router.get("/categories", requireViewer, TransactionController.getCategories);

/**
 * @swagger
 * /transactions/{id}:
 *   get:
 *     summary: Get a single transaction by ID
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Transaction details
 *       404:
 *         description: Transaction not found
 */
router.get("/:id", requireViewer, TransactionController.getById);

/**
 * @swagger
 * /transactions:
 *   post:
 *     summary: Create a new transaction (Admin only)
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount: { type: number, example: 1500.00 }
 *               type: { type: string, enum: [INCOME, EXPENSE] }
 *               category: { type: string, example: "Salary" }
 *               date: { type: string, format: date-time, example: "2024-03-01T00:00:00Z" }
 *               description: { type: string }
 *               notes: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Transaction created
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin only
 */
router.post(
  "/",
  requireAdmin,
  validate(createTransactionSchema),
  TransactionController.create
);

/**
 * @swagger
 * /transactions/{id}:
 *   patch:
 *     summary: Update a transaction (Admin only)
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount: { type: number }
 *               type: { type: string, enum: [INCOME, EXPENSE] }
 *               category: { type: string }
 *               date: { type: string, format: date-time }
 *               description: { type: string }
 *               notes: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Transaction updated
 *       404:
 *         description: Transaction not found
 */
router.patch(
  "/:id",
  requireAdmin,
  validate(updateTransactionSchema),
  TransactionController.update
);

/**
 * @swagger
 * /transactions/{id}:
 *   delete:
 *     summary: Soft-delete a transaction (Admin only)
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Transaction deleted (soft delete)
 *       404:
 *         description: Transaction not found
 */
router.delete("/:id", requireAdmin, TransactionController.remove);

export default router;
