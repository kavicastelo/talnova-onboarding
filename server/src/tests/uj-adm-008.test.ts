import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { Journey } from "../modules/journeys/models/journey.model.js";
import { AICourseDraft } from "../modules/ai/models/ai-course-draft.model.js";

describe("Journey Test UJ-ADM-008: AI Course Builder Generation", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;
  let createdCourseId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Acme AI Academy ${ts}`,
      slug: `acme-ai-academy-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
      departments: [
        { _id: new mongoose.Types.ObjectId(), name: "Engineering", active: true },
        { _id: new mongoose.Types.ObjectId(), name: "Compliance", active: true },
      ],
    });

    // 2. Create Admin user
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-ai-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "AI",
        lastName: "Admin",
        fullName: "AI Admin",
      },
      permissions: {
        role: "admin",
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create regular Employee user
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `employee-ai-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Normal",
        lastName: "Learner",
        fullName: "Normal Learner",
      },
      permissions: {
        role: "employee",
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await Journey.deleteMany({ organizationId: testOrg._id });
      await AICourseDraft.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  it("Step 4 & 5: POST /api/v1/ai/generate-course synthesizes 3 modules with lessons and quiz questions", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        prompt: "Enterprise Data Privacy & GDPR Guidelines for 2026",
        level: "Intermediate",
        moduleCount: 3,
        targetRole: "Compliance Officer",
        department: "Compliance",
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data).toBeDefined();

    const draft = json.data;
    expect(draft.modules).toHaveLength(3);

    // Module 1 check
    expect(draft.modules[0].title).toContain("Introduction to Data Privacy");
    expect(draft.modules[0].lessons.length).toBeGreaterThanOrEqual(1);

    // Module 2 check
    expect(draft.modules[1].title).toContain("Identifying PII & Security Practices");
    expect(draft.modules[1].lessons.length).toBeGreaterThanOrEqual(1);

    // Module 3 check (Quiz Assessment)
    expect(draft.modules[2].title).toContain("Quiz Assessment");
    const quizLesson = draft.modules[2].lessons[0];
    expect(quizLesson.quizQuestions).toBeDefined();
    expect(quizLesson.quizQuestions.length).toBeGreaterThanOrEqual(2);

    // Validate quiz structure
    quizLesson.quizQuestions.forEach((q: any) => {
      expect(q.questionText).toBeTruthy();
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(typeof q.correctOptionIndex).toBe("number");
      expect(q.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctOptionIndex).toBeLessThan(q.options.length);
    });
  });

  it("Step 6, 7 & 8: Edit Module 1 title to add '(Mandatory)' and Save Course to LMS (POST /api/v1/courses)", async () => {
    // 1. Generate course draft
    const genRes = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        prompt: "Enterprise Data Privacy & GDPR Guidelines for 2026",
        level: "Intermediate",
        moduleCount: 3,
      },
    });
    expect(genRes.statusCode).toBe(200);
    const draft = JSON.parse(genRes.body).data;

    // 2. Edit Module 1 title to add "(Mandatory)"
    draft.modules[0].title = `${draft.modules[0].title} (Mandatory)`;
    expect(draft.modules[0].title).toBe("Introduction to Data Privacy (Mandatory)");

    // 3. Prepare LMS Course payload
    const coursePayload = {
      title: draft.title,
      description: draft.description || "Synthesized course generated via AI Course Builder",
      category: "Compliance",
      tags: ["AI-Generated", "GDPR", "Privacy"],
      modules: draft.modules.map((mod: any, mIdx: number) => ({
        title: mod.title,
        description: mod.description || "",
        order: mIdx + 1,
        estimatedDurationMinutes: 15,
        lessons: mod.lessons.map((lesson: any, lIdx: number) => {
          const hasQuiz = lesson.quizQuestions && lesson.quizQuestions.length > 0;
          return {
            title: lesson.title,
            description: lesson.content || lesson.title,
            order: lIdx + 1,
            estimatedDurationMinutes: lesson.durationMinutes || 10,
            contentBlocks: [
              {
                type: "text",
                title: lesson.title,
                content: lesson.content || "Lesson content",
                order: 1,
              },
            ],
            completionRules: {
              requireContentCompletion: true,
              requireQuizCompletion: hasQuiz,
            },
            quiz: hasQuiz
              ? {
                  title: `${lesson.title} Assessment`,
                  passingScore: 80,
                  questions: lesson.quizQuestions.map((q: any) => ({
                    type: "single_choice",
                    question: q.questionText,
                    points: 1,
                    options: q.options.map((opt: string, optIdx: number) => ({
                      text: opt,
                      isCorrect: optIdx === q.correctOptionIndex,
                    })),
                    explanation: q.explanation || "",
                  })),
                }
              : undefined,
          };
        }),
      })),
    };

    // 4. POST /api/v1/courses creates LMS course
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/courses",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: coursePayload,
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body);
    expect(created.success).toBe(true);
    expect(created.data).toBeDefined();
    createdCourseId = created.data._id;
    expect(createdCourseId).toBeTruthy();

    // Verify Data Integrity in MongoDB
    const persistedJourney = await Journey.findById(createdCourseId);
    expect(persistedJourney).not.toBeNull();
    expect(persistedJourney?.title).toBe(draft.title);
    expect(persistedJourney?.modules).toHaveLength(3);
    expect(persistedJourney?.modules[0].title).toBe("Introduction to Data Privacy (Mandatory)");

    // Verify persisted Quiz in Module 3
    const persistedQuizLesson = persistedJourney?.modules[2].lessons[0];
    expect(persistedQuizLesson?.quiz).toBeDefined();
    expect(persistedQuizLesson?.quiz?.questions.length).toBeGreaterThanOrEqual(2);
    expect(persistedQuizLesson?.quiz?.questions[0].options.length).toBeGreaterThanOrEqual(2);
    expect(
      persistedQuizLesson?.quiz?.questions[0].options.some((o: any) => o.isCorrect === true)
    ).toBe(true);
  });

  it("Negative Test: Empty prompt is rejected with HTTP 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        prompt: "   ",
        level: "Intermediate",
      },
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(false);
  });

  it("Authorization Test: Regular employees are rejected with HTTP 403", async () => {
    // Generate course rejected
    const genRes = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        prompt: "Enterprise Data Privacy & GDPR Guidelines for 2026",
      },
    });
    expect(genRes.statusCode).toBe(403);

    // Save course rejected
    const saveRes = await app.inject({
      method: "POST",
      url: "/api/v1/courses",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        title: "Unauthorized Course",
        description: "Trying to create course without admin role",
      },
    });
    expect(saveRes.statusCode).toBe(403);
  });

  it("Integration Check: Created course is listed in Journeys / Course Library", async () => {
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/courses",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(listRes.statusCode).toBe(200);
    const json = JSON.parse(listRes.body);
    const list = Array.isArray(json.data) ? json.data : json.data?.items || [];
    const found = list.find((c: any) => c._id === createdCourseId);
    expect(found).toBeDefined();
    expect(found.title).toContain("Enterprise Data Privacy & GDPR");
  });
});
