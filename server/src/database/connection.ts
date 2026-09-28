import mongoose from "mongoose";
import dbConfig from "../config/database.config.js";
import TenantStatusCache from "../infrastructure/cache/tenant-status.cache.js";
import SystemLogBuffer from "../infrastructure/telemetry/system-log-buffer.js";

export async function connectDatabase(log: any = console) {
  mongoose.connection.on("connecting", () => {
    log.info("🔌 Connecting to MongoDB Atlas...");
    SystemLogBuffer.record({
      level: "info",
      source: "database",
      eventType: "DB_CONNECTING",
      description: "Initiating connection to MongoDB Atlas cluster",
    });
  });

  mongoose.connection.on("connected", () => {
    log.info("✅ MongoDB Atlas connected successfully.");
    SystemLogBuffer.record({
      level: "info",
      source: "database",
      eventType: "DB_CONNECTED",
      description: `MongoDB Atlas connected successfully to database "${mongoose.connection.name}"`,
    });
  });

  mongoose.connection.on("error", (error) => {
    log.error(`❌ MongoDB Atlas connection error: ${error.message}`);
    SystemLogBuffer.record({
      level: "critical",
      source: "database",
      eventType: "DB_ERROR",
      description: `MongoDB Atlas connection error: ${error.message}`,
    });
  });

  mongoose.connection.on("disconnected", () => {
    log.warn("⚠️ MongoDB Atlas disconnected.");
    SystemLogBuffer.record({
      level: "warning",
      source: "database",
      eventType: "DB_DISCONNECTED",
      description: "MongoDB Atlas cluster connection severed or closed",
    });
  });

  mongoose.connection.on("reconnected", () => {
    log.info("🔌 MongoDB Atlas reconnected.");
    SystemLogBuffer.record({
      level: "info",
      source: "database",
      eventType: "DB_RECONNECTED",
      description: "MongoDB Atlas cluster automatically reconnected",
    });
  });

  try {
    await mongoose.connect(dbConfig.uri, {
      autoIndex: true, // Auto-build indexes in development; might disable in production later if needed
    });
    // Hydrate TenantStatusCache with currently suspended organizations
    await TenantStatusCache.init();
  } catch (error: any) {
    log.error(`❌ Failed to connect to MongoDB Atlas: ${error.message}`);
    throw error;
  }
}

export async function disconnectDatabase(log: any = console) {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  log.info("🔌 Closing MongoDB Atlas connection...");
  await mongoose.disconnect();
  log.info("✅ MongoDB Atlas disconnected.");
}
