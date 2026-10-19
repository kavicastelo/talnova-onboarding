import { FastifyInstance, FastifyPluginAsync } from "fastify";
import SalesAnalyticsController from "../controllers/sales-analytics.controller.js";

export const analyticsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new SalesAnalyticsController();

  // Authoritative Sales Overview KPIs and period comparisons
  app.get("/overview", controller.getOverviewMetrics);

  // Aggregated Action Center items requiring immediate operational attention
  app.get("/action-center", controller.getActionCenter);

  // Multi-stage conversion funnel and velocity metrics
  app.get("/funnel", controller.getFunnelMetrics);

  // Time-series revenue forecasting scenarios and quota tracking
  app.get("/forecast", controller.getRevenueForecast);

  // Sales rep leaderboard and performance analytics
  app.get("/rep-performance", controller.getRepPerformance);
};

export default analyticsRoutes;

