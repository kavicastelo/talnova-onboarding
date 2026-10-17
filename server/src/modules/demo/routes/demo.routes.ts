import { FastifyInstance } from "fastify";
import { demoAppController } from "../controllers/demo-app.controller.js";
import { demoAuthenticate } from "../middleware/demo-auth.middleware.js";
import { requireDemoFeature, guardDemoHighRisk, verifyDemoTenant } from "../middleware/demo-guard.middleware.js";
import { attachDemoHeaders } from "../middleware/demo-watermark.middleware.js";
import { demoRateLimiter } from "../middleware/demo-ratelimit.middleware.js";
import { demoHoneypotHandler, checkDemoIpBlacklist } from "../middleware/demo-honeypot.middleware.js";

export async function demoRoutes(app: FastifyInstance) {
  // Global Demo Security Hooks
  app.addHook("onRequest", checkDemoIpBlacklist);
  app.addHook("onRequest", demoRateLimiter);

  // Decoy Honeypot Routes (Public Entrypoints for Probers & Crawlers)
  app.get("/export-all-data", demoHoneypotHandler);
  app.get("/internal/raw-curriculum", demoHoneypotHandler);
  app.get("/secret-dump", demoHoneypotHandler);

  // Public Demo Auth & Invite Endpoints
  app.post("/auth/login", demoAppController.login);
  app.post("/auth/invite/redeem", demoAppController.redeemInvite);
  app.get("/auth/invite/verify", demoAppController.verifyInvite);

  // Authenticated Demo Scope
  app.register(async (authedScope) => {
    authedScope.addHook("onRequest", demoAuthenticate);
    authedScope.addHook("onSend", attachDemoHeaders);
    authedScope.addHook("preHandler", verifyDemoTenant);

    // Profile & Session
    authedScope.post("/auth/logout", demoAppController.logout);
    authedScope.post("/auth/heartbeat", demoAppController.heartbeat);
    authedScope.get("/auth/me", demoAppController.getMe);
    authedScope.get("/dashboard", demoAppController.getDashboard);
    authedScope.get("/dashboard/summary", demoAppController.getDashboardSummary);

    // Telemetry & Usage Monitoring
    authedScope.post("/telemetry", demoAppController.recordTelemetry);

    // Onboarding Features with Entitlement Guards
    // Onboarding Journeys & LMS Routes
    authedScope.get(
      "/journeys",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.getJourneys
    );
    authedScope.get(
      "/journeys/:id",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.getJourneyById
    );
    authedScope.post(
      "/journeys",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.createJourney
    );
    authedScope.patch(
      "/journeys/:id",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.updateJourney
    );
    authedScope.delete(
      "/journeys/:id",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.deleteJourney
    );
    authedScope.post(
      "/journeys/:id/duplicate",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.duplicateJourney
    );
    authedScope.post(
      "/journeys/:id/publish",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.publishJourney
    );
    authedScope.post(
      "/journeys/:id/archive",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.archiveJourney
    );
    authedScope.post(
      "/journeys/:id/modules",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.addJourneyModule
    );
    authedScope.post(
      "/journeys/:id/assign",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.assignJourney
    );
    authedScope.post(
      "/journeys/:id/bulk-assign",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.bulkAssignJourneys
    );
    authedScope.get(
      "/journeys/:id/assignments",
      { preHandler: [requireDemoFeature("journey_templates")] },
      demoAppController.getJourneyAssignments
    );

    // Checklist Tasks & Hardware Routes
    authedScope.get(
      "/tasks",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.getTasks
    );
    authedScope.get(
      "/tasks/:id",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.getTaskById
    );
    authedScope.post(
      "/tasks",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.createTask
    );
    authedScope.patch(
      "/tasks/:id",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.updateTaskStatus
    );
    authedScope.patch(
      "/tasks/:id/status",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.updateTaskStatus
    );
    authedScope.post(
      "/tasks/:id/comments",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.addTaskComment
    );
    authedScope.delete(
      "/tasks/:id",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.deleteTask
    );
    authedScope.patch(
      "/tasks/:id/hardware",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.updateTaskHardware
    );
    authedScope.post(
      "/tasks/:id/hardware/receipt",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.attachHardwareReceipt
    );
    authedScope.post(
      "/tasks/:id/hardware/confirm-receipt",
      { preHandler: [requireDemoFeature("checklist_tasks")] },
      demoAppController.confirmHardwareReceipt
    );

    // Employee Directory & Profiles
    authedScope.get(
      "/directory",
      { preHandler: [requireDemoFeature("employee_directory")] },
      demoAppController.getDirectory
    );
    authedScope.get(
      "/employees",
      { preHandler: [requireDemoFeature("employee_directory")] },
      demoAppController.getDirectory
    );

    // Documents & Digital Signatures
    authedScope.get(
      "/documents",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.getDocuments
    );
    authedScope.get(
      "/documents/templates",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.getDocumentTemplates
    );
    authedScope.post(
      "/documents",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.createDocumentTemplate
    );
    authedScope.get(
      "/documents/:id",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.getDocumentById
    );
    authedScope.patch(
      "/documents/:id",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.updateDocumentTemplate
    );
    authedScope.delete(
      "/documents/:id",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.deleteDocumentTemplate
    );
    authedScope.delete(
      "/documents/templates/:id",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.deleteDocumentTemplate
    );
    authedScope.post(
      "/documents/assign",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.assignDocument
    );
    authedScope.get(
      "/documents/:templateId/signatures",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.getDocumentSignatures
    );
    authedScope.post(
      "/documents/:id/sign",
      { preHandler: [requireDemoFeature("digital_signatures")] },
      demoAppController.signDocument
    );

    // Knowledge Base Articles & Management
    authedScope.get(
      "/kb",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.getKBArticles
    );
    authedScope.get(
      "/knowledge-base",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.getKBArticles
    );
    authedScope.get(
      "/kb/articles",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.getKBArticles
    );
    authedScope.get(
      "/kb/articles/:id",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.getKBArticleById
    );
    authedScope.post(
      "/kb/articles",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.createKBArticle
    );
    authedScope.patch(
      "/kb/articles/:id",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.updateKBArticle
    );
    authedScope.delete(
      "/kb/articles/:id",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.deleteKBArticle
    );
    authedScope.post(
      "/kb/articles/:id/publish",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.publishKBArticle
    );
    authedScope.post(
      "/kb/articles/:id/archive",
      { preHandler: [requireDemoFeature("knowledge_base")] },
      demoAppController.archiveKBArticle
    );

    // Knowledge Base Quick Links & Gaps
    authedScope.get("/knowledge-base/quick-links", demoAppController.getQuickLinks);
    authedScope.post("/knowledge-base/quick-links", demoAppController.createQuickLink);
    authedScope.patch("/knowledge-base/quick-links/:id", demoAppController.updateQuickLink);
    authedScope.delete("/knowledge-base/quick-links/:id", demoAppController.deleteQuickLink);
    authedScope.get("/kb/gaps", demoAppController.getKnowledgeGaps);
    authedScope.post("/kb/gaps/:id/quick-answer", demoAppController.resolveKnowledgeGapWithQuickAnswer);
    authedScope.post("/kb/gaps/:id/link-article", demoAppController.resolveKnowledgeGapWithArticle);
    authedScope.post("/kb/gaps/:id/dismiss", demoAppController.dismissKnowledgeGap);
    authedScope.post("/kb/reindex", demoAppController.triggerReindex);

    authedScope.get(
      "/analytics/summary",
      { preHandler: [requireDemoFeature("analytics_dashboard")] },
      demoAppController.getAnalyticsSummary
    );

    authedScope.get(
      "/leaderboard",
      { preHandler: [requireDemoFeature("gamified_milestones")] },
      demoAppController.getLeaderboard
    );

    // Organization & Settings Endpoints
    authedScope.get("/organizations/current", demoAppController.getCurrentOrganization);
    authedScope.patch("/organizations/current", demoAppController.updateCurrentOrganization);
    authedScope.patch("/organizations/branding", demoAppController.updateBranding);
    authedScope.patch("/organizations/security", demoAppController.updateSecurity);
    authedScope.get("/organizations/departments", demoAppController.getDepartments);
    authedScope.post("/organizations/departments", demoAppController.createDepartment);
    authedScope.delete("/organizations/departments/:id", demoAppController.deleteDepartment);
    authedScope.get("/organizations/integrations/capabilities", demoAppController.getIntegrationCapabilities);

    // Notifications & Preferences
    authedScope.get("/notifications", demoAppController.getNotifications);
    authedScope.get("/notifications/preferences", demoAppController.getNotificationPreferences);
    authedScope.patch("/notifications/preferences", demoAppController.updateNotificationPreferences);

    // Employee & Journey Assignments
    authedScope.get("/employees/me", demoAppController.getEmployeeMe);
    authedScope.get("/employees/:id", demoAppController.getEmployeeById);
    authedScope.get("/assignments/me", demoAppController.getAssignmentsMe);
    authedScope.get("/assignments", demoAppController.getAssignments);
    authedScope.get("/assignments/:id", demoAppController.getAssignmentById);
    authedScope.post("/assignments", demoAppController.createAssignment);
    authedScope.patch("/assignments/:assignmentId/lessons/:lessonId", demoAppController.updateLessonProgress);
    authedScope.post("/assignments/:assignmentId/modules/:moduleId/lessons/:lessonId/quiz", demoAppController.submitQuiz);

    // Manager Portal Endpoints
    authedScope.get("/manager/dashboard", demoAppController.getManagerDashboard);
    authedScope.get("/manager/team", demoAppController.getManagerTeam);
    authedScope.get("/manager/team-overview", demoAppController.getManagerTeamOverview);
    authedScope.get("/manager/team/:employeeId", demoAppController.getManagerDirectReportDetails);
    authedScope.post("/manager/team/:employeeId/nudge", demoAppController.nudgeDirectReport);
    authedScope.post("/manager/team/:employeeId/sign-off", demoAppController.signOffDirectReport);

    // Buddy Program Endpoints
    authedScope.get("/buddy/my-profile", demoAppController.getMyBuddyProfile);
    authedScope.post("/buddy/profiles", demoAppController.saveBuddyProfile);
    authedScope.get("/buddy/my-buddy", demoAppController.getMyBuddy);
    authedScope.get("/buddy/my-mentees", demoAppController.getMyMentees);
    authedScope.get("/buddy/assignments", demoAppController.getBuddyAssignments);
    authedScope.get("/buddy/available", demoAppController.getAvailableBuddies);
    authedScope.post("/buddy/assign", demoAppController.assignBuddy);
    authedScope.put("/buddy/assignment/:assignmentId/checklist", demoAppController.updateBuddyChecklist);
    authedScope.post("/buddy/assignment/:assignmentId/checkin", demoAppController.logBuddyCheckin);
    authedScope.post("/buddy/assignment/:assignmentId/checklist/task", demoAppController.addBuddyChecklistTask);

    // Milestones & Documents Inbox
    authedScope.get(
      "/milestones",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.getMilestones
    );
    authedScope.get(
      "/milestones/templates",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.getMilestoneTemplates
    );
    authedScope.post(
      "/milestones/templates",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.createMilestoneTemplate
    );
    authedScope.put(
      "/milestones/templates/:id",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.updateMilestoneTemplate
    );
    authedScope.delete(
      "/milestones/templates/:id",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.deleteMilestoneTemplate
    );
    authedScope.post(
      "/milestones/assign",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.assignMilestone
    );
    authedScope.get(
      "/milestones/me",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.getMyMilestones
    );
    authedScope.get(
      "/milestones/my-milestones",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.getMyMilestones
    );
    authedScope.get(
      "/milestones/team",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.getTeamMilestones
    );
    authedScope.get(
      "/milestones/team-milestones",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.getTeamMilestones
    );
    authedScope.post(
      "/milestones/:id/self-evaluation",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.submitMilestoneSelfEvaluation
    );
    authedScope.post(
      "/milestones/:id/manager-review",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.submitMilestoneManagerReview
    );
    authedScope.post(
      "/milestones/:id/request-revision",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.requestMilestoneRevision
    );
    authedScope.post(
      "/milestones/:id/escalate",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.escalateMilestone
    );
    authedScope.patch(
      "/milestones/:id/goals",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.updateMilestoneGoals
    );
    authedScope.patch(
      "/milestones/:id/status",
      { preHandler: [requireDemoFeature("milestone_ratings")] },
      demoAppController.updateMilestoneStatus
    );
    authedScope.get("/documents/inbox", demoAppController.getDocumentsInbox);

    // Audit Logs
    authedScope.get("/audit-logs", demoAppController.getAuditLogs);

    // AI Assistant Endpoints
    authedScope.get("/ai/conversations", demoAppController.getAIConversations);
    authedScope.get("/ai/conversations/:id", demoAppController.getAIConversationById);
    authedScope.post("/ai/chat", demoAppController.postAIChat);

    // Controlled Demo Email Inbox Sink
    authedScope.get("/inbox", demoAppController.getEmailInbox);
    authedScope.post("/inbox/simulate", demoAppController.simulateEmail);

    // Controlled Export with synthetic limits and watermarking
    authedScope.get("/export", demoAppController.exportControlledData);

    // ==================== FULL PRODUCT DEMO ROUTES ====================
    // Calendar Integration
    authedScope.get("/calendar/connection", demoAppController.getCalendarConnection);
    authedScope.post("/calendar/connection", demoAppController.connectCalendarProvider);
    authedScope.get("/calendar/events", demoAppController.getCalendarEvents);
    authedScope.post("/calendar/events", demoAppController.createCalendarEvent);
    authedScope.patch("/calendar/events/:id", demoAppController.patchCalendarEvent);
    authedScope.put("/calendar/events/:id", demoAppController.patchCalendarEvent);
    authedScope.delete("/calendar/events/:id", demoAppController.deleteCalendarEvent);
    authedScope.get("/calendar/availability", demoAppController.getCalendarAvailability);
    authedScope.get("/calendar/pack/export", demoAppController.exportCalendarPack);
    authedScope.post("/calendar/milestones/:id/schedule-review", demoAppController.scheduleMilestoneReview);

    // HR Operations & Lifecycle Management
    authedScope.get("/hr/dashboard-metrics", demoAppController.getHRDashboardMetrics);
    authedScope.get("/hr/exceptions", demoAppController.getHRExceptions);
    authedScope.get("/hr/compliance-report", demoAppController.getHRComplianceReport);
    authedScope.put("/hr/lifecycle/:userId/state", demoAppController.updateHRLifecycleState);
    authedScope.post("/hr/handover/:userId", demoAppController.completeHRHandover);
    authedScope.post("/hr/bulk-action", demoAppController.executeHRBulkAction);

    // AI Course Builder
    authedScope.post("/ai/course-builder/generate", demoAppController.generateAICourse);
    authedScope.post("/ai/generate-course", demoAppController.generateAICourse);

    // Frontline Kiosk Operations
    authedScope.get("/kiosk/status", demoAppController.getKioskStatus);
    authedScope.get("/kiosk/devices", demoAppController.getKioskDevices);
    authedScope.get("/kiosk/compliance", demoAppController.getKioskCompliance);
    authedScope.get("/kiosk/manifest", demoAppController.getKioskManifest);
    authedScope.post("/kiosk/pair", demoAppController.pairKioskDevice);

    // HRIS Integrations & Enterprise SSO
    authedScope.get("/integrations", demoAppController.getHRISIntegrations);
    authedScope.get("/organizations/integrations", demoAppController.getHRISIntegrations);
    authedScope.post("/organizations/integrations/:id/sync", demoAppController.syncHRISIntegration);
    authedScope.post("/integrations/:id/sync", demoAppController.syncHRISIntegration);
    authedScope.get("/organizations/security/sso", demoAppController.getSSOSettings);
    authedScope.patch("/organizations/security/sso", demoAppController.updateSSOSettings);
    authedScope.get("/sso", demoAppController.getSSOSettings);
    authedScope.patch("/sso", demoAppController.updateSSOSettings);

    // Super Admin / Platform Overview in Demo Mode
    authedScope.get("/super-admin/overview", async (_req, reply) => {
      return reply.status(200).send({
        success: true,
        data: {
          totalOrganizations: 6,
          activeUsers: 34,
          totalJourneys: 18,
          activeSessions: 3,
          systemStatus: "operational",
          retentionRate: "98.4%",
        },
      });
    });

    // Guarded High-Risk / Danger-Zone Routes (Security Boundary Testing)
    authedScope.all("/admin/*", { preHandler: [guardDemoHighRisk] }, async () => {});
    authedScope.all("/admin/danger-zone", { preHandler: [guardDemoHighRisk] }, async () => {});
    authedScope.all("/api-keys/*", { preHandler: [guardDemoHighRisk] }, async () => {});
  });
}


export default demoRoutes;
