import mongoose from "mongoose";
import { config, demoConfig } from "../../../config/index.js";

let demoConnectionInstance: mongoose.Connection | null = null;

/**
 * Returns the isolated Demo Database Connection.
 * Guarantees that demo models are registered and executed ONLY on this connection,
 * completely segregated from the default production mongoose.connection.
 */
export function getDemoConnection(log: any = console): mongoose.Connection {
  if (demoConnectionInstance && demoConnectionInstance.readyState !== 0) {
    return demoConnectionInstance;
  }

  const demoUri = demoConfig.databaseUrl;

  if (!demoUri) {
    const errorMsg = "FATAL: DEMO_DATABASE_URL is not configured. Demo operations cannot connect to an unspecified database.";
    log.error?.(errorMsg) || console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Strict physical isolation check in production
  if (config.app.isProduction && demoUri === config.db.uri) {
    const errorMsg = "CRITICAL SECURITY VIOLATION: DEMO_DATABASE_URL must never be identical to production MONGODB_URI.";
    log.fatal?.(errorMsg) || console.error(errorMsg);
    throw new Error(errorMsg);
  }

  log.info?.("🔌 Initializing isolated Demo Database connection...") || console.log("🔌 Initializing isolated Demo Database connection...");

  demoConnectionInstance = mongoose.createConnection(demoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 15000,
  });

  demoConnectionInstance.on("connected", () => {
    log.info?.("✅ Demo Database connected successfully.") || console.log("✅ Demo Database connected successfully.");
  });

  demoConnectionInstance.on("error", (err) => {
    log.error?.(`❌ Demo Database connection error: ${err.message}`) || console.error(`❌ Demo Database connection error: ${err.message}`);
  });

  demoConnectionInstance.on("disconnected", () => {
    log.warn?.("⚠️ Demo Database disconnected.") || console.warn("⚠️ Demo Database disconnected.");
  });

  return demoConnectionInstance;
}

/**
 * Closes the isolated Demo Database connection.
 */
export async function closeDemoConnection(log: any = console): Promise<void> {
  if (demoConnectionInstance && demoConnectionInstance.readyState !== 0) {
    log.info?.("🔌 Closing Demo Database connection...") || console.log("🔌 Closing Demo Database connection...");
    await demoConnectionInstance.close();
    demoConnectionInstance = null;
    log.info?.("✅ Demo Database disconnected.") || console.log("✅ Demo Database disconnected.");
  }
}
