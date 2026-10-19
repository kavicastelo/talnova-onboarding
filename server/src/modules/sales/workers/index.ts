import { QueueService } from "../../../infrastructure/queue/queue.service.js";
import { processCampaignBatchJob } from "./campaign.worker.js";
import { processAutomationJob } from "./automation.worker.js";
import { processLeadImportJob } from "./import.worker.js";

export function registerSalesWorkers(): void {
  const queue = QueueService.getInstance();

  queue.registerWorker("sales:campaign:dispatch_batch", processCampaignBatchJob);
  queue.registerWorker("sales:workflow:trigger", processAutomationJob);
  queue.registerWorker("sales:lead:import_csv", processLeadImportJob);
}

export default registerSalesWorkers;
