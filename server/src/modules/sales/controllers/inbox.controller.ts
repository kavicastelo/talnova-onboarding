import { FastifyRequest, FastifyReply } from "fastify";
import AppError from "../../../common/errors/app-error.js";
import InboxService from "../services/inbox.service.js";
import {
  inboxQuerySchema,
  sendReplySchema,
  updateThreadSchema,
  createThreadSchema,
} from "../schemas/inbox.schemas.js";

export class InboxController {
  private service: InboxService;

  constructor() {
    this.service = new InboxService();
  }

  /**
   * List communication threads with filters, pagination, and counter aggregates
   * GET /api/v1/sales/inbox
   */
  listThreads = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = inboxQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const result = await this.service.listThreads(parseResult.data);
    return reply.status(200).send({
      success: true,
      data: result.items,
      pagination: result.pagination,
      counters: result.counters,
    });
  };

  /**
   * Retrieve single thread by ID with complete chronological history
   * GET /api/v1/sales/inbox/:id
   */
  getThreadById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { markAsRead?: string };
    const markAsRead = query.markAsRead === "true" || query.markAsRead === "1";

    const thread = await this.service.getThreadById(id, { markAsRead });
    return reply.status(200).send({
      success: true,
      data: thread,
    });
  };

  /**
   * Send outbound reply message on existing thread
   * POST /api/v1/sales/inbox/:id/reply
   */
  sendReply = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = sendReplySchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const authorUser = (request as any).user;
    const updatedThread = await this.service.sendReply(id, parseResult.data, authorUser);

    return reply.status(200).send({
      success: true,
      message: "Reply sent successfully",
      data: updatedThread,
    });
  };

  /**
   * Update thread status, owner assignment, or entity linkages
   * PATCH /api/v1/sales/inbox/:id
   */
  updateThread = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateThreadSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const updatedThread = await this.service.updateThread(id, parseResult.data);
    return reply.status(200).send({
      success: true,
      message: "Thread updated successfully",
      data: updatedThread,
    });
  };

  /**
   * Mark all unread messages in thread as read
   * POST /api/v1/sales/inbox/:id/read
   */
  markThreadRead = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const thread = await this.service.markThreadRead(id);

    return reply.status(200).send({
      success: true,
      message: "Thread marked as read",
      data: thread,
    });
  };

  /**
   * Create new outbound communication thread
   * POST /api/v1/sales/inbox
   */
  createThread = async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createThreadSchema.safeParse(request.body);
    if (!parseResult.success) {
      const details = parseResult.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      throw new AppError(400, "VALIDATION_ERROR", "Validation failed", details);
    }

    const authorUser = (request as any).user;
    const thread = await this.service.createThread(parseResult.data, authorUser);

    return reply.status(201).send({
      success: true,
      message: "Communication thread initialized",
      data: thread,
    });
  };
}

export default InboxController;
