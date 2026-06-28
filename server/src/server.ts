import { buildApp } from "./app.js";
import { appConfig } from "./config/index.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";

async function start() {
  const app = await buildApp();

  try {
    // 1. Connect to Database
    await connectDatabase(app.log);

    // 2. Start Listening
    await app.listen({
      port: appConfig.port,
      host: appConfig.host,
    });

    app.log.info(`🚀 Server running on http://${appConfig.host}:${appConfig.port} in ${appConfig.env} mode`);
  } catch (error) {
    app.log.fatal(error, "💥 Failed to start server");
    process.exit(1);
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    app.log.warn(`⚠️ Received ${signal}. Initiating graceful shutdown...`);

    // Set a timeout to force shutdown if it hangs
    const forceExitTimeout = setTimeout(() => {
      app.log.error("💥 Force shutdown triggered after timeout.");
      process.exit(1);
    }, 10000);

    try {
      await app.close();
      app.log.info("✅ Fastify server closed.");

      await disconnectDatabase(app.log);
      
      clearTimeout(forceExitTimeout);
      app.log.info("👋 Shutdown sequence complete. Exiting.");
      process.exit(0);
    } catch (error) {
      app.log.error(error, "💥 Error occurred during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason, promise) => {
    app.log.fatal({ promise, reason }, "💥 Unhandled Promise Rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    app.log.fatal(error, "💥 Uncaught Exception");
    process.exit(1);
  });
}

start();
