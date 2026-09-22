import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import ScheduledReport from "../modules/analytics/models/scheduled-report.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import OnboardingHealth from "../modules/analytics/models/onboarding-health.model.js";

describe("Analytics Engine Production-Ready Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let learnerUser: any;
  let scheduledReport: any;
  let testJourney: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^analytics-prod-" } });

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Analytics Production Org",
      slug: `analytics-prod-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `analytics-prod-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Analytics",
        lastName: "Admin",
      },
      employment: {
        department: "Engineering",
        employmentType: "full_time",
        status: "active",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create Learner User
    learnerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `analytics-prod-learner-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Stalled",
        lastName: "Learner",
      },
      employment: {
        department: "Engineering",
        employmentType: "full_time",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // 4. Create Journey with Quiz Questions
    const questionId1 = new mongoose.Types.ObjectId();
    testJourney = await Journey.create({
      organizationId: testOrg._id,
      title: "Production Engineering Onboarding",
      slug: `prod-eng-onboarding-${ts}`,
      description: "Comprehensive engineering curriculum",
      tags: ["engineering"],
      modules: [
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Architecture & Standards",
          description: "System design patterns",
          order: 1,
          estimatedDurationMinutes: 60,
          lessons: [
            {
              _id: new mongoose.Types.ObjectId(),
              title: "Security & Auth",
              order: 1,
              estimatedDurationMinutes: 30,
              contentBlocks: [],
              attachments: [],
              completionRules: {
                requireContentCompletion: false,
                requireQuizCompletion: true,
              },
              quiz: {
                _id: new mongoose.Types.ObjectId(),
                title: "Security & Standards Check",
                passingScore: 70,
                questions: [
                  {
                    _id: questionId1,
                    type: "single_choice",
                    question: "What cryptographic algorithm is used for signing tenant session JWTs?",
                    points: 10,
                    options: [
                      { _id: new mongoose.Types.ObjectId(), text: "HS256", isCorrect: false },
                      { _id: new mongoose.Types.ObjectId(), text: "RS256", isCorrect: true },
                      { _id: new mongoose.Types.ObjectId(), text: "MD5", isCorrect: false },
                      { _id: new mongoose.Types.ObjectId(), text: "Plaintext", isCorrect: false },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
      createdBy: adminUser._id,
    });

    // 5. Create Learner Assignment with Quiz Result
    await EmployeeAssignment.create({
      organizationId: testOrg._id,
      employeeId: learnerUser._id,
      journeyId: testJourney._id,
      journey: {
        journeyId: testJourney._id,
        title: testJourney.title,
        version: 1,
      },
      assignedBy: adminUser._id,
      assignment: {
        assignedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      },
      status: "in_progress",
      progress: {
        totalModules: 1,
        completedModules: 0,
        totalLessons: 1,
        completedLessons: 0,
        completionPercentage: 30,
        totalTimeSpentSeconds: 400,
      },
      modules: [
        {
          moduleId: testJourney.modules[0]._id,
          title: "Architecture & Standards",
          completed: false,
          lessons: [
            {
              lessonId: testJourney.modules[0].lessons[0]._id,
              title: "Security & Auth",
              completed: false,
              contentBlocks: [],
              quizAttempt: {
                attemptNumber: 1,
                startedAt: new Date(),
                score: 40,
                passed: false,
                answers: [
                  {
                    questionId: questionId1,
                    selectedOptions: [],
                    correct: false,
                    pointsEarned: 0,
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    // 6. Create Onboarding Health record for learner (at risk)
    await OnboardingHealth.create({
      organizationId: testOrg._id,
      employeeId: learnerUser._id,
      dropOffRiskScore: 0.78,
      riskLevel: "at_risk",
      daysInactive: 4,
      itemsOverdue: 2,
      velocity: 15,
      predictedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    });

    // 7. Create Scheduled Report
    scheduledReport = await ScheduledReport.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      title: "Executive Weekly Onboarding Summary",
      frequency: "weekly",
      recipients: ["compliance-officer@test.com"],
      format: "csv",
      status: "active",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. Dynamic Overview: returns computed funnel, productivity curve, and retention delta", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview?range=30d&department=All",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("activeOnboarding");
    expect(body.data).toHaveProperty("retentionRate");
    expect(body.data).toHaveProperty("retentionDelta");
    expect(typeof body.data.retentionDelta).toBe("string");
    expect(body.data.funnelStages).toBeInstanceOf(Array);
    expect(body.data.funnelStages.length).toBeGreaterThan(0);
    expect(body.data.productivityCurve).toBeInstanceOf(Array);
    expect(body.data.productivityCurve.length).toBeGreaterThanOrEqual(4);
  });

  it("2. Range & Department Filtering: correctly scopes metrics", async () => {
    const resAll = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview?range=all&department=Engineering",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(resAll.statusCode).toBe(200);
    const body = resAll.json();
    expect(body.success).toBe(true);
    expect(body.data.department).toBe("Engineering");
    expect(body.data.range).toBe("all");
  });

  it("3. Bottleneck Analysis: resolves real question text from Journey definitions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/bottlenecks?department=Engineering",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("moduleBottlenecks");
    expect(body.data).toHaveProperty("difficultQuestions");
    expect(body.data.difficultQuestions.length).toBeGreaterThan(0);

    const questionItem = body.data.difficultQuestions[0];
    expect(questionItem.questionText).toContain("cryptographic algorithm");
    expect(questionItem.incorrectRate).toBe(100);
  });

  it("4. Cohort Health & Velocity Sentinel: GET /cohort-health aggregates risk metrics", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/cohort-health?department=Engineering",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.totalEvaluated).toBeGreaterThanOrEqual(1);
    expect(body.data.atRiskCount).toBeGreaterThanOrEqual(1);
    expect(body.data.avgDropOffRisk).toBeGreaterThan(0);
    expect(body.data.atRiskEmployees.length).toBeGreaterThanOrEqual(1);
    expect(body.data.atRiskEmployees[0].employeeId).toBe(learnerUser._id.toString());
    expect(body.data.atRiskEmployees[0].riskLevel).toBe("at_risk");
  });

  it("5. Omnichannel Intervention: POST /nudge/:employeeId triggers intervention", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/analytics/nudge/${learnerUser._id.toString()}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("Intervention nudge dispatched");
  });

  it("6. Scheduled Report Immediate Execution: POST /scheduled-reports/:id/run executes and updates timestamp", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/analytics/scheduled-reports/${scheduledReport._id.toString()}/run`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain("Scheduled report executed and dispatched");

    // Verify lastSentAt is updated in database
    const updated = await ScheduledReport.findById(scheduledReport._id);
    expect(updated?.lastSentAt).toBeDefined();
  });
});
