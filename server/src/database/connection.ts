import mongoose from "mongoose";
import dbConfig from "../config/database.config.js";

export async function connectDatabase(log: any) {
  mongoose.connection.on("connecting", () => {
    log.info("🔌 Connecting to MongoDB Atlas...");
  });

  mongoose.connection.on("connected", () => {
    log.info("✅ MongoDB Atlas connected successfully.");
  });

  mongoose.connection.on("error", (error) => {
    log.error(`❌ MongoDB Atlas connection error: ${error.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    log.warn("⚠️ MongoDB Atlas disconnected.");
  });

  mongoose.connection.on("reconnected", () => {
    log.info("🔌 MongoDB Atlas reconnected.");
  });

  try {
    await mongoose.connect(dbConfig.uri, {
      autoIndex: true, // Auto-build indexes in development; might disable in production later if needed
    });
  } catch (error: any) {
    log.error(`❌ Failed to connect to MongoDB Atlas: ${error.message}`);
    throw error;
  }
}

export async function disconnectDatabase(log: any) {
  if (mongoose.connection.readyState === 0) {
    return;
  }
  log.info("🔌 Closing MongoDB Atlas connection...");
  await mongoose.disconnect();
  log.info("✅ MongoDB Atlas disconnected.");
}
