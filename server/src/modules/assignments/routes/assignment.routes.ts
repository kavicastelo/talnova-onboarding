import { FastifyInstance } from "fastify";
import { EmployeeAssignmentController } from "../controllers/assignment.controller.js";
import { EmployeeAssignmentService } from "../services/assignment.service.js";
import { EmployeeAssignmentRepository } from "../repositories/assignment.repository.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  assignJourneySchema,
  completeLessonSchema,
  submitQuizSchema,
} from "../schemas/assignment.schema.js";

export async function assignmentRoutes(app: FastifyInstance) {
  const repository = new EmployeeAssignmentRepository();
  const service = new EmployeeAssignmentService(repository);
  const controller = new EmployeeAssignmentController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/assignments/me
  app.get("/me", controller.getMyAssignments as any);

  // GET /api/v1/assignments/me/active
  app.get("/me/active", controller.getMyActiveAssignments as any);

  // GET /api/v1/assignments/me/completed
  app.get("/me/completed", controller.getMyCompletedAssignments as any);

  // GET /api/v1/assignments
  app.get("/", controller.listAssignments as any);

  // GET /api/v1/assignments/:id
  app.get("/:id", controller.getAssignment as any);

  // POST /api/v1/assignments (assign journey)
  app.post(
    "/",
    {
      preHandler: [requireRole(["owner", "admin", "manager"])],
      schema: { body: assignJourneySchema },
    },
    controller.assignJourney as any
  );

  // POST /api/v1/assignments/:id/start
  app.post("/:id/start", controller.startAssignment as any);

  // POST /api/v1/assignments/:id/complete-lesson
  app.post(
    "/:id/complete-lesson",
    { schema: { body: completeLessonSchema } },
    controller.completeLesson as any
  );

  // POST /api/v1/assignments/:id/submit-quiz
  app.post(
    "/:id/submit-quiz",
    { schema: { body: submitQuizSchema } },
    controller.submitQuiz as any
  );
}

export default assignmentRoutes;
