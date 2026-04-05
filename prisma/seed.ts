import { PrismaClient, Role, TransactionType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log("🌱 Seeding database...\n");

  // ─── Clear existing data ─────────────────────────────────────────────────────
  await prisma.refreshToken.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.user.deleteMany();
  console.log("✅ Cleared existing data");

  // ─── Create Users ─────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin@123", SALT_ROUNDS);
  const analystHash = await bcrypt.hash("Analyst@123", SALT_ROUNDS);
  const viewerHash = await bcrypt.hash("Viewer@123", SALT_ROUNDS);

  const [admin, analyst, viewer] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Alice Admin",
        email: "admin@finance.com",
        passwordHash: adminHash,
        role: Role.ADMIN,
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Bob Analyst",
        email: "analyst@finance.com",
        passwordHash: analystHash,
        role: Role.ANALYST,
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        name: "Carol Viewer",
        email: "viewer@finance.com",
        passwordHash: viewerHash,
        role: Role.VIEWER,
        status: "ACTIVE",
      },
    }),
  ]);

  console.log("✅ Created users:", [admin.email, analyst.email, viewer.email].join(", "));

  // ─── Create Transactions ──────────────────────────────────────────────────────
  const now = new Date();

  const transactions = [
    // Income
    { amount: 85000, type: TransactionType.INCOME, category: "Salary", date: new Date(now.getFullYear(), now.getMonth(), 1), description: "Monthly salary - March", tags: ["recurring", "salary"] },
    { amount: 12000, type: TransactionType.INCOME, category: "Freelance", date: new Date(now.getFullYear(), now.getMonth(), 5), description: "Web design project", tags: ["freelance"] },
    { amount: 3500, type: TransactionType.INCOME, category: "Investments", date: new Date(now.getFullYear(), now.getMonth(), 10), description: "Dividend income", tags: ["passive"] },
    { amount: 85000, type: TransactionType.INCOME, category: "Salary", date: new Date(now.getFullYear(), now.getMonth() - 1, 1), description: "Monthly salary - February", tags: ["recurring", "salary"] },
    { amount: 8000, type: TransactionType.INCOME, category: "Freelance", date: new Date(now.getFullYear(), now.getMonth() - 1, 15), description: "Mobile app project", tags: ["freelance"] },
    { amount: 85000, type: TransactionType.INCOME, category: "Salary", date: new Date(now.getFullYear(), now.getMonth() - 2, 1), description: "Monthly salary - January", tags: ["recurring", "salary"] },
    { amount: 15000, type: TransactionType.INCOME, category: "Bonus", date: new Date(now.getFullYear(), now.getMonth() - 2, 20), description: "Year-end performance bonus", tags: ["bonus"] },

    // Expenses
    { amount: 22000, type: TransactionType.EXPENSE, category: "Rent", date: new Date(now.getFullYear(), now.getMonth(), 2), description: "Monthly rent", tags: ["recurring", "housing"] },
    { amount: 4500, type: TransactionType.EXPENSE, category: "Groceries", date: new Date(now.getFullYear(), now.getMonth(), 8), description: "Monthly groceries", tags: ["food"] },
    { amount: 1200, type: TransactionType.EXPENSE, category: "Utilities", date: new Date(now.getFullYear(), now.getMonth(), 10), description: "Electricity + internet", tags: ["recurring", "utilities"] },
    { amount: 800, type: TransactionType.EXPENSE, category: "Transport", date: new Date(now.getFullYear(), now.getMonth(), 12), description: "Monthly commute pass", tags: ["recurring"] },
    { amount: 3200, type: TransactionType.EXPENSE, category: "Dining", date: new Date(now.getFullYear(), now.getMonth(), 14), description: "Restaurant + food delivery", tags: ["food", "leisure"] },
    { amount: 2500, type: TransactionType.EXPENSE, category: "Entertainment", date: new Date(now.getFullYear(), now.getMonth(), 16), description: "OTT subscriptions + movies", tags: ["leisure"] },
    { amount: 5000, type: TransactionType.EXPENSE, category: "Healthcare", date: new Date(now.getFullYear(), now.getMonth(), 18), description: "Health insurance premium", tags: ["recurring", "health"] },
    { amount: 8000, type: TransactionType.EXPENSE, category: "Shopping", date: new Date(now.getFullYear(), now.getMonth(), 20), description: "Clothes and accessories", tags: ["shopping"] },
    { amount: 3000, type: TransactionType.EXPENSE, category: "Education", date: new Date(now.getFullYear(), now.getMonth(), 22), description: "Online course subscription", tags: ["learning"] },
    { amount: 22000, type: TransactionType.EXPENSE, category: "Rent", date: new Date(now.getFullYear(), now.getMonth() - 1, 2), description: "Monthly rent - Feb", tags: ["recurring", "housing"] },
    { amount: 3800, type: TransactionType.EXPENSE, category: "Groceries", date: new Date(now.getFullYear(), now.getMonth() - 1, 9), description: "February groceries", tags: ["food"] },
    { amount: 1100, type: TransactionType.EXPENSE, category: "Utilities", date: new Date(now.getFullYear(), now.getMonth() - 1, 11), description: "Electricity bill", tags: ["recurring"] },
    { amount: 12000, type: TransactionType.EXPENSE, category: "Travel", date: new Date(now.getFullYear(), now.getMonth() - 1, 20), description: "Weekend trip to Goa", tags: ["travel", "leisure"] },
    { amount: 22000, type: TransactionType.EXPENSE, category: "Rent", date: new Date(now.getFullYear(), now.getMonth() - 2, 2), description: "Monthly rent - Jan", tags: ["recurring", "housing"] },
    { amount: 4200, type: TransactionType.EXPENSE, category: "Groceries", date: new Date(now.getFullYear(), now.getMonth() - 2, 8), description: "January groceries", tags: ["food"] },
    { amount: 6500, type: TransactionType.EXPENSE, category: "Shopping", date: new Date(now.getFullYear(), now.getMonth() - 2, 25), description: "New year shopping", tags: ["shopping"] },
  ];

  await prisma.transaction.createMany({
    data: transactions.map((tx) => ({
      ...tx,
      createdById: admin.id,
    })),
  });

  console.log(`✅ Created ${transactions.length} transactions`);

  // ─── Summary ───────────────────────────────────────────────────────────────────
  console.log("\n📊 Seed Summary:");
  console.log("─────────────────────────────────────────");
  console.log("👤 Users Created:");
  console.log(`   Admin    → admin@finance.com    / Admin@123`);
  console.log(`   Analyst  → analyst@finance.com  / Analyst@123`);
  console.log(`   Viewer   → viewer@finance.com   / Viewer@123`);
  console.log(`\n💳 Transactions: ${transactions.length} records seeded`);
  console.log("\n🌐 API Docs available at: http://localhost:3000/api/docs");
  console.log("─────────────────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
