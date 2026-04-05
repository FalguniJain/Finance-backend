
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err.message);
  console.error(err.stack);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});
import app from "./app";
import { config } from "./config/env";
import { logger } from "./config/logger";
import prisma from "./config/database";

const server = app.listen(config.port, () => {
  logger.info(`🚀 Server running on http://localhost:${config.port}`);
  logger.info(`📄 API Docs: http://localhost:${config.port}/api/docs`);
  logger.info(`🌍 Environment: ${config.env}`);
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────

const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  server.close(async () => {
    logger.info("HTTP server closed.");
    await prisma.$disconnect();
    logger.info("Database connection closed.");
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error("Forced shutdown due to timeout.");
    process.exit(1);
  }, 10_000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason: unknown) => {
  logger.error("Unhandled promise rejection:", { reason });
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error: Error) => {
  logger.error("Uncaught exception:", { error });
  shutdown("uncaughtException");
});

export default server;
