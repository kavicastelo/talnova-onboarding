import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { KioskService } from "../modules/kiosk/services/kiosk.service.js";

async function main() {
  console.log("Starting cleanup of orphaned kiosk test artifacts...");
  try {
    await connectDatabase(console);
    const result = await KioskService.cleanOrphanedTestArtifacts(console);
    console.log("Cleanup completed successfully:", result);
  } catch (err) {
    console.error("Cleanup failed with error:", err);
    process.exit(1);
  } finally {
    await disconnectDatabase(console);
    process.exit(0);
  }
}

main();
