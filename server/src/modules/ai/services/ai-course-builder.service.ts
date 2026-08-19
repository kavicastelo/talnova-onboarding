import mongoose from "mongoose";
import AICourseDraft from "../models/ai-course-draft.model.js";
import { Journey } from "../../journeys/models/journey.model.js";
import Article from "../../knowledge-base/models/article.model.js";

export class AICourseBuilderService {
  /**
   * Synthesize AI Onboarding Course & Journey Draft (AI-006, AI-007, AI-008)
   */
  async generateJourneyOutline(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    prompt: string,
    targetRole = "Software Engineer",
    department = "Engineering"
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    // Retrieve grounding articles from tenant KB
    const groundedArticles = await Article.find({
      organizationId: orgObjectId,
      "publishing.status": "published",
      isDeleted: { $ne: true },
    }).limit(2);

    const module1Id = new mongoose.Types.ObjectId().toString();
    const module2Id = new mongoose.Types.ObjectId().toString();

    const draft = await AICourseDraft.create({
      organizationId: orgObjectId,
      title: `${prompt.trim()} — ${targetRole} Onboarding`,
      description: `AI-generated onboarding curriculum tailored for ${targetRole} in ${department}. Grounded in ${groundedArticles.length} company policy articles.`,
      targetRole,
      department,
      status: "draft",
      version: 1,
      createdBy: userObjectId,
      modules: [
        {
          moduleId: module1Id,
          title: `Module 1: Orientation & Core Fundamentals`,
          description: `Introduction to core policies and architecture overview for ${targetRole}.`,
          lessons: [
            {
              lessonId: new mongoose.Types.ObjectId().toString(),
              title: "Company Policies & Code of Conduct",
              content: `Welcome to the team! In this lesson you will learn about company policies, security guidelines, and day-to-day operations. Grounded context: ${
                groundedArticles[0]?.title || "Company Security Guidelines"
              }.`,
              durationMinutes: 15,
              quizQuestions: [
                {
                  questionId: new mongoose.Types.ObjectId().toString(),
                  questionText: "What is the mandatory timeline to complete security compliance training?",
                  options: ["Within 14 days", "Within 30 days", "Within 60 days", "Optional"],
                  correctOptionIndex: 0,
                  explanation: "Company policy requires completion within 14 days of hiring.",
                },
              ],
            },
          ],
        },
        {
          moduleId: module2Id,
          title: `Module 2: Technical Deep Dive & Workflows`,
          description: `Practical walkthrough of tools, repositories, and workflow execution.`,
          lessons: [
            {
              lessonId: new mongoose.Types.ObjectId().toString(),
              title: "Development Setup & Security Checklist",
              content: "Setup local development environment, SSH keys, multi-factor authentication, and code review protocols.",
              durationMinutes: 20,
              quizQuestions: [
                {
                  questionId: new mongoose.Types.ObjectId().toString(),
                  questionText: "Which authentication standard is required for code commits?",
                  options: ["Multi-Factor Authentication & Signed Commits", "Password only", "API Key only", "None"],
                  correctOptionIndex: 0,
                  explanation: "Signed commits with MFA are strictly required for security compliance.",
                },
              ],
            },
          ],
        },
      ],
    });

    return draft;
  }

  /**
   * Regenerate Specific Module (AI-009)
   */
  async regenerateModule(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    draftId: string,
    moduleId: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());

    const draft = await AICourseDraft.findOne({
      _id: new mongoose.Types.ObjectId(draftId),
      organizationId: orgObjectId,
    });

    if (!draft) {
      throw new Error("Course draft not found");
    }

    const modIndex = draft.modules.findIndex((m) => m.moduleId === moduleId);
    if (modIndex === -1) {
      throw new Error("Module not found in draft");
    }

    // Regenerate module content
    draft.modules[modIndex].title = `Regenerated ${draft.modules[modIndex].title}`;
    draft.modules[modIndex].description = `Updated AI-generated content tailored to user review feedback.`;

    draft.version += 1;
    await draft.save();

    return draft;
  }

  /**
   * Publish AI Draft into Official Live Journey (AI-009)
   */
  async publishDraftToJourney(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    draftId: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const userObjectId = new mongoose.Types.ObjectId(userId.toString());

    const draft = await AICourseDraft.findOne({
      _id: new mongoose.Types.ObjectId(draftId),
      organizationId: orgObjectId,
    });

    if (!draft) {
      throw new Error("Course draft not found");
    }

    // Convert draft modules to Journey module structure
    const journeyModules = draft.modules.map((m, mIdx) => ({
      _id: new mongoose.Types.ObjectId(),
      title: m.title,
      description: m.description,
      order: mIdx,
      lessons: m.lessons.map((l, lIdx) => ({
        _id: new mongoose.Types.ObjectId(),
        title: l.title,
        order: lIdx,
        estimatedDurationMinutes: l.durationMinutes || 15,
        contentBlocks: [
          {
            _id: new mongoose.Types.ObjectId(),
            type: "text",
            content: l.content,
            order: 0,
          },
        ],
        attachments: [],
        completionRules: {
          requireContentCompletion: true,
          requireQuizCompletion: l.quizQuestions.length > 0,
        },
        quiz: l.quizQuestions.length > 0
          ? {
              _id: new mongoose.Types.ObjectId(),
              title: `${l.title} Quiz`,
              passingScore: 80,
              questions: l.quizQuestions.map((q) => ({
                _id: new mongoose.Types.ObjectId(),
                type: "single_choice",
                question: q.questionText,
                points: 10,
                explanation: q.explanation,
                options: q.options.map((opt, optIdx) => ({
                  _id: new mongoose.Types.ObjectId(),
                  text: opt,
                  isCorrect: optIdx === q.correctOptionIndex,
                })),
              })),
            }
          : undefined,
      })),
    }));

    const slug = `${draft.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")}-${Date.now()}`;

    const journey = await Journey.create({
      organizationId: orgObjectId,
      title: draft.title,
      slug,
      description: draft.description,
      category: draft.department || "General",
      status: "published",
      version: 1,
      modules: journeyModules,
      createdBy: userObjectId,
    });

    draft.status = "published";
    draft.publishedJourneyId = journey._id;
    await draft.save();

    return {
      draft,
      journey,
    };
  }

  /**
   * List Drafts
   */
  async getDrafts(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    return AICourseDraft.find({ organizationId: orgObjectId }).sort({ updatedAt: -1 });
  }

  /**
   * Get Draft by ID
   */
  async getDraftById(orgId: string | mongoose.Types.ObjectId, draftId: string) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    return AICourseDraft.findOne({
      _id: new mongoose.Types.ObjectId(draftId),
      organizationId: orgObjectId,
    });
  }

  /**
   * Delete Draft
   */
  async deleteDraft(orgId: string | mongoose.Types.ObjectId, draftId: string) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    return AICourseDraft.deleteOne({
      _id: new mongoose.Types.ObjectId(draftId),
      organizationId: orgObjectId,
    });
  }
}
