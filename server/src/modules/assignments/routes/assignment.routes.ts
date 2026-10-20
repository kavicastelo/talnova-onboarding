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

  // Explicit unauthenticated public certificate verification route
  app.get("/public/verify/:id", controller.verifyCertificatePublic as any);

  // Protected assignment routes requiring authentication
  await app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", authenticate);

    // GET /api/v1/assignments/me
    protectedApp.get("/me", controller.getMyAssignments as any);

    // GET /api/v1/assignments/me/active
    protectedApp.get("/me/active", controller.getMyActiveAssignments as any);

    // GET /api/v1/assignments/me/completed
    protectedApp.get("/me/completed", controller.getMyCompletedAssignments as any);

    // GET /api/v1/assignments
    protectedApp.get("/", controller.listAssignments as any);

    // GET /api/v1/assignments/:id
    protectedApp.get("/:id", controller.getAssignment as any);

    // POST /api/v1/assignments (assign journey)
    protectedApp.post(
      "/",
      {
        preHandler: [requireRole(["owner", "admin", "manager", "employee"])],
        schema: { body: assignJourneySchema },
      },
      controller.assignJourney as any
    );

    // POST /api/v1/assignments/bulk (bulk assign journeys)
    protectedApp.post(
      "/bulk",
      {
        preHandler: [requireRole(["owner", "admin", "manager"])],
      },
      controller.bulkAssignJourneys as any
    );

    // POST /api/v1/assignments/:id/start
    protectedApp.post("/:id/start", controller.startAssignment as any);

    // POST /api/v1/assignments/:id/complete-lesson
    protectedApp.post(
      "/:id/complete-lesson",
      { schema: { body: completeLessonSchema } },
      controller.completeLesson as any
    );

    // POST /api/v1/assignments/:id/progress (PWA progress sync alias)
    protectedApp.post("/:id/progress", controller.updateProgress as any);

    // POST /api/v1/assignments/:id/submit-quiz
    protectedApp.post(
      "/:id/submit-quiz",
      { schema: { body: submitQuizSchema } },
      controller.submitQuiz as any
    );

    // POST /api/v1/assignments/:id/issue-certificate
    protectedApp.post(
      "/:id/issue-certificate",
      { preHandler: [requireRole(["owner", "admin", "manager"])] },
      controller.issueCertificate as any
    );
  });
}

export default assignmentRoutes;
