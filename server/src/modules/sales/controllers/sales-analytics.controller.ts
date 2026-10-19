import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import SalesAnalyticsService from "../services/sales-analytics.service.js";
import AppError from "../../../common/errors/app-error.js";

const OverviewQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  pipelineId: z.string().optional(),
});

const ActionCenterQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
});

const FunnelQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  pipelineId: z.string().optional(),
});

const ForecastQuerySchema = z.object({
  period: z.enum(["month", "quarter", "year"]).default("quarter"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  pipelineId: z.string().optional(),
  quotaTarget: z.coerce.number().min(0).optional(),
});

const RepPerformanceQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  pipelineId: z.string().optional(),
});

export class SalesAnalyticsController {
  private analyticsService: SalesAnalyticsService;

  constructor(analyticsService?: SalesAnalyticsService) {
    this.analyticsService = analyticsService || new SalesAnalyticsService();
  }

  /**
   * GET /api/v1/sales/analytics/overview
   */
  public getOverviewMetrics = async (
    request: FastifyRequest<{
      Querystring: {
        startDate?: string;
        endDate?: string;
        pipelineId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const queryParsed = OverviewQuerySchema.safeParse(request.query || {});
    if (!queryParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters for sales overview metrics",
        errors: queryParsed.error.errors,
      });
    }

    try {
      const { startDate, endDate, pipelineId } = queryParsed.data;
      const parsedStart = startDate ? new Date(startDate) : undefined;
      const parsedEnd = endDate ? new Date(endDate) : undefined;

      if (parsedStart && isNaN(parsedStart.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid startDate format",
        });
      }

      if (parsedEnd && isNaN(parsedEnd.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid endDate format",
        });
      }

      const metrics = await this.analyticsService.getOverviewMetrics({
        startDate: parsedStart,
        endDate: parsedEnd,
        pipelineId,
      });

      return reply.status(200).send({
        success: true,
        data: metrics,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error(err, "Error calculating sales overview analytics");
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred while computing sales overview metrics.",
      });
    }
  };

  /**
   * GET /api/v1/sales/analytics/action-center
   */
  public getActionCenter = async (
    request: FastifyRequest<{
      Querystring: {
        limit?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const queryParsed = ActionCenterQuerySchema.safeParse(request.query || {});
    if (!queryParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid limit query parameter",
        errors: queryParsed.error.errors,
      });
    }

    try {
      const summary = await this.analyticsService.getActionCenterItems(queryParsed.data.limit);

      return reply.status(200).send({
        success: true,
        data: summary,
      });
    } catch (err: any) {
      request.log.error(err, "Error fetching Action Center items");
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: "Failed to aggregate Action Center actionable items.",
      });
    }
  };

  /**
   * GET /api/v1/sales/analytics/funnel
   */
  public getFunnelMetrics = async (
    request: FastifyRequest<{
      Querystring: {
        startDate?: string;
        endDate?: string;
        pipelineId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const queryParsed = FunnelQuerySchema.safeParse(request.query || {});
    if (!queryParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters for funnel metrics",
        errors: queryParsed.error.errors,
      });
    }

    try {
      const { startDate, endDate, pipelineId } = queryParsed.data;
      const parsedStart = startDate ? new Date(startDate) : undefined;
      const parsedEnd = endDate ? new Date(endDate) : undefined;

      if (parsedStart && isNaN(parsedStart.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid startDate format",
        });
      }

      if (parsedEnd && isNaN(parsedEnd.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid endDate format",
        });
      }

      const funnelData = await this.analyticsService.getFunnelMetrics({
        startDate: parsedStart,
        endDate: parsedEnd,
        pipelineId,
      });

      return reply.status(200).send({
        success: true,
        data: funnelData,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error(err, "Error calculating conversion funnel metrics");
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred while computing conversion funnel metrics.",
      });
    }
  };

  /**
   * GET /api/v1/sales/analytics/forecast
   */
  public getRevenueForecast = async (
    request: FastifyRequest<{
      Querystring: {
        period?: "month" | "quarter" | "year";
        startDate?: string;
        endDate?: string;
        pipelineId?: string;
        quotaTarget?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    const queryParsed = ForecastQuerySchema.safeParse(request.query || {});
    if (!queryParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters for revenue forecast",
        errors: queryParsed.error.errors,
      });
    }

    try {
      const { period, startDate, endDate, pipelineId, quotaTarget } = queryParsed.data;
      const parsedStart = startDate ? new Date(startDate) : undefined;
      const parsedEnd = endDate ? new Date(endDate) : undefined;

      if (parsedStart && isNaN(parsedStart.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid startDate format",
        });
      }

      if (parsedEnd && isNaN(parsedEnd.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid endDate format",
        });
      }

      const forecastData = await this.analyticsService.getRevenueForecast({
        period,
        startDate: parsedStart,
        endDate: parsedEnd,
        pipelineId,
        quotaTarget,
      });

      return reply.status(200).send({
        success: true,
        data: forecastData,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error(err, "Error calculating revenue forecast");
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred while computing revenue forecast.",
      });
    }
  };

  /**
   * GET /api/v1/sales/analytics/rep-performance
   */
  public getRepPerformance = async (
    request: FastifyRequest<{
      Querystring: {
        startDate?: string;
        endDate?: string;
        pipelineId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const queryParsed = RepPerformanceQuerySchema.safeParse(request.query || {});
    if (!queryParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid query parameters for sales rep performance",
        errors: queryParsed.error.errors,
      });
    }

    try {
      const { startDate, endDate, pipelineId } = queryParsed.data;
      const parsedStart = startDate ? new Date(startDate) : undefined;
      const parsedEnd = endDate ? new Date(endDate) : undefined;

      if (parsedStart && isNaN(parsedStart.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid startDate format",
        });
      }

      if (parsedEnd && isNaN(parsedEnd.getTime())) {
        return reply.status(400).send({
          success: false,
          code: "VALIDATION_ERROR",
          message: "Invalid endDate format",
        });
      }

      const repData = await this.analyticsService.getRepPerformance({
        startDate: parsedStart,
        endDate: parsedEnd,
        pipelineId,
      });

      return reply.status(200).send({
        success: true,
        data: repData,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error(err, "Error calculating rep performance leaderboard");
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: "An internal error occurred while computing sales rep performance.",
      });
    }
  };
}

export default SalesAnalyticsController;
