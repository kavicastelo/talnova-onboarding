import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { demoAuthService } from "../services/demo-auth.service.js";
import { demoEmailSinkService } from "../services/demo-email-sink.service.js";
import {
  getDemoJourneyModel,
  getDemoTaskModel,
  getDemoDocumentModel,
  getDemoUserModel,
  getDemoTenantModel,
  getDemoActivityLogModel,
  getDemoKBArticleModel,
  getDemoMilestoneModel,
  getDemoFeatureUsageModel,
} from "../models/index.js";
import AppError from "../../../common/errors/app-error.js";

// Knowledge Base Category ID Mapping matching client CATEGORY_MAP
const KB_CATEGORY_ID_MAP: Record<string, string> = {
  "Company Policies": "658c1f000000000000000001",
  "IT & Security": "658c1f000000000000000001",
  "Security": "658c1f000000000000000001",
  "Employee Handbook": "658c1f000000000000000002",
  "Culture & Values": "658c1f000000000000000002",
  "Engineering Guidelines": "658c1f000000000000000003",
  "Engineering": "658c1f000000000000000003",
  "HR & People": "658c1f000000000000000004",
  "Sales": "658c1f000000000000000004",
  "General": "658c1f000000000000000001",
};

const formatKBArticle = (a: any) => {
  const catId = a.categoryId || KB_CATEGORY_ID_MAP[a.category] || "658c1f000000000000000001";
  let contentBlocks = a.content?.blocks;
  if (!contentBlocks || !Array.isArray(contentBlocks)) {
    const textContent = typeof a.content === "string" ? a.content : a.summary || "";
    contentBlocks = [{ type: "paragraph", content: textContent, order: 0 }];
  }

  return {
    _id: a._id?.toString() || `kb-${Date.now()}`,
    id: a._id?.toString() || `kb-${Date.now()}`,
    title: a.title || "Untitled Article",
    summary: a.summary || "",
    category: a.category || "Company Policies",
    categoryId: catId,
    content: { blocks: contentBlocks },
    publishing: { status: a.status || a.publishing?.status || "published" },
    analytics: { views: a.analytics?.views ?? 42, averageReadTimeSeconds: (a.readTimeMinutes || 3) * 60 },
    tags: a.tags && a.tags.length ? a.tags : [a.category || "Company Policies", "Onboarding", "Playbook"],
    createdAt: a.createdAt || new Date().toISOString(),
    updatedAt: a.updatedAt || new Date().toISOString(),
  };
};

// In-memory tenant stores for demo quick links and knowledge gaps
const quickLinksStore = new Map<string, Array<{ _id: string; title: string; url: string; icon: string; order: number }>>();

const getTenantQuickLinks = (tenantId: string) => {
  if (!quickLinksStore.has(tenantId)) {
    quickLinksStore.set(tenantId, [
      {
        _id: "ql-1",
        title: "IT Helpdesk & Equipment Portal",
        url: "https://helpdesk.acme-demo.internal",
        icon: "HelpCircle",
        order: 1,
      },
      {
        _id: "ql-2",
        title: "Corporate GitHub Enterprise",
        url: "https://github.com/acme-corp-demo",
        icon: "Book",
        order: 2,
      },
      {
        _id: "ql-3",
        title: "Benefits & Insurance Portal",
        url: "https://benefits.acme-demo.internal",
        icon: "Shield",
        order: 3,
      },
      {
        _id: "ql-4",
        title: "Company Slack Community",
        url: "https://slack.com",
        icon: "Globe",
        order: 4,
      },
    ]);
  }
  return quickLinksStore.get(tenantId)!;
};

const knowledgeGapsStore = new Map<string, Array<any>>();

const getTenantKnowledgeGaps = (tenantId: string) => {
  if (!knowledgeGapsStore.has(tenantId)) {
    knowledgeGapsStore.set(tenantId, [
      {
        _id: "gap-1",
        organizationId: tenantId,
        question: "What is the policy for expensing second monitors and ergonomic standing desks?",
        category: "Company Policies",
        occurrenceCount: 5,
        requestedBy: [
          {
            _id: "u-req-1",
            profile: { firstName: "Sarah", lastName: "Connor" },
            auth: { email: "sarah.connor@acme-demo.com" },
          },
        ],
        status: "unresolved",
        priority: "medium",
        lastAskedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: "gap-2",
        organizationId: tenantId,
        question: "Where can I find the staging deployment access keys and AWS IAM credentials?",
        category: "Engineering Guidelines",
        occurrenceCount: 3,
        requestedBy: [
          {
            _id: "u-req-2",
            profile: { firstName: "John", lastName: "Doe" },
            auth: { email: "john.doe@acme-demo.com" },
          },
        ],
        status: "unresolved",
        priority: "high",
        lastAskedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  }
  return knowledgeGapsStore.get(tenantId)!;
};

// In-memory tenant store for buddy profiles and assignments
interface DemoBuddyState {
  profiles: Map<string, any>;
  assignments: any[];
}

const buddyStore = new Map<string, DemoBuddyState>();

const getTenantBuddyState = (tenantId: string, currentUserId: string): DemoBuddyState => {
  if (!buddyStore.has(tenantId)) {
    const initialProfiles = new Map<string, any>();

    // Current user's buddy profile
    initialProfiles.set(currentUserId, {
      _id: `bp-${currentUserId}`,
      userId: currentUserId,
      isAvailable: true,
      maxMentees: 2,
      currentMenteeCount: 1,
      skills: ["TypeScript", "React", "System Architecture", "Node.js"],
      languages: ["English", "Spanish"],
      department: "Engineering",
      jobTitle: "Staff Software Engineer",
      bio: "Senior engineer passionate about onboarding, team tooling, and making everyone feel welcome!",
    });

    // Seeded available mentors in company directory
    const availableList = [
      {
        _id: "bp-alice",
        userId: {
          _id: "usr-buddy-alice",
          profile: {
            firstName: "Alice",
            lastName: "Smith",
            location: "San Francisco, CA",
            avatar: { publicUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=AliceSmith" },
          },
          employment: {
            jobTitle: "Senior Staff Engineer",
            department: "Engineering",
          },
        },
        department: "Engineering",
        jobTitle: "Senior Staff Engineer",
        isAvailable: true,
        maxMentees: 3,
        currentMenteeCount: 1,
        skills: ["React", "TypeScript", "Node.js", "System Design"],
        languages: ["English", "Spanish"],
        bio: "Passionate about helping new engineers ramp up quickly and effectively.",
      },
      {
        _id: "bp-michael",
        userId: {
          _id: "usr-buddy-michael",
          profile: {
            firstName: "Michael",
            lastName: "Scott",
            location: "Scranton, PA",
            avatar: { publicUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=MichaelScott" },
          },
          employment: {
            jobTitle: "Regional Director",
            department: "Sales",
          },
        },
        department: "Sales",
        jobTitle: "Regional Director",
        isAvailable: true,
        maxMentees: 2,
        currentMenteeCount: 0,
        skills: ["Client Relations", "Negotiation", "Sales Strategy"],
        languages: ["English"],
        bio: "Always ready to share cultural wisdom and help newcomers find their footing.",
      },
      {
        _id: "bp-elena",
        userId: {
          _id: "usr-buddy-elena",
          profile: {
            firstName: "Elena",
            lastName: "Rostova",
            location: "New York, NY",
            avatar: { publicUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=ElenaRostova" },
          },
          employment: {
            jobTitle: "Principal Product Designer",
            department: "Product & Design",
          },
        },
        department: "Product & Design",
        jobTitle: "Principal Product Designer",
        isAvailable: true,
        maxMentees: 2,
        currentMenteeCount: 1,
        skills: ["Figma", "Design Systems", "User Research", "Prototyping"],
        languages: ["English", "Russian", "French"],
        bio: "Here to guide you through our design culture and cross-team collaboration.",
      },
    ];

    for (const b of availableList) {
      initialProfiles.set(b.userId._id, b);
    }

    const initialAssignments = [
      {
        _id: "asg-my-buddy",
        assignedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
        status: "active",
        buddyUserId: {
          _id: "usr-buddy-alice",
          profile: {
            firstName: "Alice",
            lastName: "Smith",
            avatar: { publicUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=AliceSmith" },
          },
          employment: {
            jobTitle: "Senior Staff Engineer",
            department: "Engineering",
          },
        },
        newHireUserId: {
          _id: currentUserId,
          profile: {
            firstName: "Sarah",
            lastName: "Connor",
          },
          employment: {
            jobTitle: "Software Engineer",
            department: "Engineering",
          },
        },
        communicationLinks: {
          email: "alice.smith@acme-demo.com",
          slackChannelUrl: "https://slack.com",
          teamsUrl: "https://teams.microsoft.com",
        },
        checklist: [
          {
            _id: "chk-1",
            title: "First Day Virtual Welcome & Tech Setup Check",
            stage: "day_1",
            completed: true,
            completedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
          },
          {
            _id: "chk-2",
            title: "Codebase & Local Dev Architecture Walkthrough",
            stage: "week_1",
            completed: true,
            completedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          },
          {
            _id: "chk-3",
            title: "Introduce to Cross-Functional Partners (Product & Design)",
            stage: "week_1",
            completed: false,
          },
          {
            _id: "chk-4",
            title: "First Month Mentorship Review & Growth Goals",
            stage: "month_1",
            completed: false,
          },
        ],
        checkins: [
          {
            _id: "chk-in-1",
            completedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
            notes: "Had a great 30-min coffee chat. Everything is going great!",
            rating: 5,
            sentiment: "positive",
          },
        ],
      },
      {
        _id: "asg-mentee-1",
        assignedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        status: "active",
        buddyUserId: {
          _id: currentUserId,
          profile: {
            firstName: "Sarah",
            lastName: "Connor",
          },
          employment: {
            jobTitle: "Staff Software Engineer",
            department: "Engineering",
          },
        },
        newHireUserId: {
          _id: "usr-mentee-david",
          profile: {
            firstName: "David",
            lastName: "Kim",
          },
          employment: {
            jobTitle: "Junior Frontend Engineer",
            department: "Engineering",
          },
        },
        communicationLinks: {
          email: "david.kim@acme-demo.com",
        },
        checklist: [
          {
            _id: "m-chk-1",
            title: "Welcome lunch and team Slack introductions",
            stage: "day_1",
            completed: true,
            completedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
          },
          {
            _id: "m-chk-2",
            title: "Review PR submission and CI/CD pipelines",
            stage: "week_1",
            completed: true,
            completedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          },
          {
            _id: "m-chk-3",
            title: "Deploy first feature flag in staging",
            stage: "week_1",
            completed: false,
          },
        ],
        checkins: [
          {
            _id: "m-chk-in-1",
            completedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
            notes: "David completed his first PR review on time. Great engagement and curiosity.",
            rating: 5,
            sentiment: "positive",
          },
        ],
      },
    ];

    buddyStore.set(tenantId, { profiles: initialProfiles, assignments: initialAssignments });
  }

  return buddyStore.get(tenantId)!;
};

export class DemoAppController {
  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password, deviceInfo } = request.body as any;
    if (!email || !password) {
      throw new AppError(400, "VALIDATION_ERROR", "Email and password are required.");
    }

    const userAgent = (request.headers["user-agent"] as string) || "unknown";
    const ip = (request.headers["x-forwarded-for"] as string) || request.ip;

    const result = await demoAuthService.login(
      email,
      password,
      request.server.jwt.sign,
      ip,
      userAgent,
      deviceInfo
    );

    return reply.status(200).send({
      success: true,
      message: "Demo login successful.",
      data: result,
    });
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.demoUser) {
      await demoAuthService.logout(
        request.demoUser.sessionId,
        request.demoUser.id,
        request.demoUser.tenantId
      );
    }
    return reply.status(200).send({
      success: true,
      message: "Demo session ended successfully.",
    });
  };

  getMe = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.demoUser) {
      throw new AppError(401, "UNAUTHORIZED", "Not authenticated.");
    }

    const DemoUser = getDemoUserModel();
    const DemoTenant = getDemoTenantModel();

    const [user, tenant] = await Promise.all([
      DemoUser.findById(request.demoUser.id).select("-passwordHash").lean(),
      DemoTenant.findById(request.demoUser.tenantId).lean(),
    ]);

    if (!user || !tenant) {
      throw new AppError(404, "NOT_FOUND", "Demo identity not found.");
    }

    const shortSession = request.demoUser.sessionId.split("-")[0].toUpperCase();
    const dateFormatted = new Date().toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).toUpperCase();

    const roleMap: Record<string, string> = {
      demo_admin: "admin",
      demo_manager: "manager",
      demo_employee: "employee",
    };
    const mappedRole = roleMap[user.role] || "admin";

    const featuresObj: Record<string, boolean> = {};
    if (tenant.allowedFeatures && Array.isArray(tenant.allowedFeatures)) {
      for (const f of tenant.allowedFeatures) {
        featuresObj[f] = true;
      }
    }

    return reply.status(200).send({
      success: true,
      data: {
        user: {
          ...user,
          role: mappedRole,
          roles: [mappedRole],
        },
        tenant,
        features: featuresObj,
        session: {
          sessionId: request.demoUser.sessionId,
        },
        watermark: {
          text: `${tenant.name.toUpperCase()} | ${user.fullName.toUpperCase()} | DEMO | SESSION: ${tenant.slug.toUpperCase()}-${shortSession} | ${dateFormatted}`,
          companyName: tenant.name,
          userName: user.fullName,
          sessionId: shortSession,
          date: dateFormatted,
        },
      },
    });
  };

  getDashboard = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = new mongoose.Types.ObjectId(request.demoUser!.tenantId);

    const DemoJourney = getDemoJourneyModel();
    const DemoTask = getDemoTaskModel();
    const DemoDocument = getDemoDocumentModel();
    const DemoUser = getDemoUserModel();

    const [journeys, tasks, documents, colleagues] = await Promise.all([
      DemoJourney.find({ demoTenantId: tenantId }).limit(5).lean(),
      DemoTask.find({ demoTenantId: tenantId }).lean(),
      DemoDocument.find({ demoTenantId: tenantId }).lean(),
      DemoUser.find({ demoTenantId: tenantId }).select("fullName email role department jobTitle").lean(),
    ]);

    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const progressRate = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    return reply.status(200).send({
      success: true,
      data: {
        progressRate,
        totalTasks: tasks.length,
        completedTasks,
        pendingDocuments: documents.filter((d) => d.status === "pending_signature").length,
        journeys,
        tasks,
        documents,
        colleagues,
      },
    });
  };

  // ==================== JOURNEYS & LMS ====================

  getJourneys = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoJourney = getDemoJourneyModel();
    const journeys = await DemoJourney.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    const formatted = journeys.map((j: any) => ({
      ...j,
      _id: j._id.toString(),
      id: j._id.toString(),
      publishing: j.publishing || {
        status: j.status || "published",
        publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      analytics: j.analytics || {
        totalAssignments: 16,
        completionRate: 84,
      },
      modulesCount: j.modules?.length || j.modulesCount || 3,
      modules: j.modules || [],
      audience: j.audience || { isPublic: true },
      settings: j.settings || {
        allowSkipLessons: false,
        requireSequentialCompletion: true,
        allowRetakes: true,
        maxRetakes: 3,
      },
      certificate: j.certificate || {
        enabled: true,
        templateId: "classic",
        passingScore: 80,
      },
    }));

    return reply.status(200).send({ success: true, data: formatted });
  };

  getJourneyById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoJourney = getDemoJourneyModel();

    let journey: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      journey = await DemoJourney.findOne({
        _id: new mongoose.Types.ObjectId(id),
        demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      }).lean();
    }

    if (!journey) {
      journey = await DemoJourney.findOne({
        demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      }).lean();
    }

    if (!journey) {
      throw new AppError(404, "JOURNEY_NOT_FOUND", "Journey roadmap not found.");
    }

    const formatted = {
      ...journey,
      _id: journey._id.toString(),
      id: journey._id.toString(),
      publishing: journey.publishing || {
        status: journey.status || "published",
        publishedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      analytics: journey.analytics || {
        totalAssignments: 18,
        completionRate: 85,
      },
      modulesCount: journey.modules?.length || journey.modulesCount || 3,
      modules: journey.modules || [],
      audience: journey.audience || { isPublic: true },
      settings: journey.settings || {
        allowSkipLessons: false,
        requireSequentialCompletion: true,
        allowRetakes: true,
        maxRetakes: 3,
      },
      certificate: journey.certificate || {
        enabled: true,
        templateId: "classic",
        passingScore: 80,
      },
    };

    return reply.status(200).send({ success: true, data: formatted });
  };

  createJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const DemoJourney = getDemoJourneyModel();
    const DemoActivityLog = getDemoActivityLogModel();

    const created = await DemoJourney.create({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      title: body.title || "Custom Onboarding Journey",
      description: body.description || "Synthesized onboarding journey.",
      category: body.category || "General",
      durationDays: body.durationDays || 14,
      status: "published",
      modulesCount: body.modules?.length || 1,
      modules: body.modules || [
        {
          _id: `mod-${Date.now()}`,
          title: "Introduction & Team Orientation",
          lessons: [
            {
              _id: `les-${Date.now()}`,
              title: "Welcome Overview",
              description: "Getting started with your team and workspace.",
              type: "Article",
              estimatedDurationMinutes: 10,
              contentBlocks: [{ type: "paragraph", content: "Welcome to the team! Review this guide to get started." }],
            },
          ],
        },
      ],
      publishing: { status: "published", publishedAt: new Date().toISOString() },
      analytics: { totalAssignments: 1, completionRate: 0 },
      audience: body.audience || { isPublic: true },
      settings: body.settings || { allowSkipLessons: false, requireSequentialCompletion: true, allowRetakes: true, maxRetakes: 3 },
    });

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "JOURNEY_CREATED",
      category: "NAVIGATION",
      description: `Created new onboarding journey: ${created.title}`,
      severity: "info",
    });

    return reply.status(201).send({
      success: true,
      data: { ...created.toObject(), id: created._id.toString() },
    });
  };

  updateJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoJourney = getDemoJourneyModel();

    const updated = await DemoJourney.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      { $set: body },
      { new: true }
    ).lean();

    if (!updated) {
      throw new AppError(404, "JOURNEY_NOT_FOUND", "Journey not found.");
    }

    return reply.status(200).send({
      success: true,
      data: { ...updated, id: (updated as any)._id.toString() },
    });
  };

  deleteJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoJourney = getDemoJourneyModel();
    await DemoJourney.deleteOne({
      _id: id,
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    });
    return reply.status(200).send({ success: true, message: "Journey deleted." });
  };

  duplicateJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { title } = (request.body as any) || {};
    const DemoJourney = getDemoJourneyModel();

    const original = await DemoJourney.findOne({
      _id: id,
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    if (!original) throw new AppError(404, "NOT_FOUND", "Journey not found.");

    const duplicated = await DemoJourney.create({
      ...(original as any),
      _id: new mongoose.Types.ObjectId(),
      title: title || `${(original as any).title} (Copy)`,
      publishing: { status: "draft", publishedAt: undefined },
      createdAt: new Date(),
    });

    return reply.status(201).send({
      success: true,
      data: { ...duplicated.toObject(), id: duplicated._id.toString() },
    });
  };

  publishJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoJourney = getDemoJourneyModel();
    const updated = await DemoJourney.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      {
        $set: {
          status: "published",
          publishing: { status: "published", publishedAt: new Date().toISOString() },
        },
      },
      { new: true }
    ).lean();

    return reply.status(200).send({ success: true, data: updated });
  };

  archiveJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoJourney = getDemoJourneyModel();
    const updated = await DemoJourney.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      {
        $set: {
          status: "draft",
          publishing: { status: "archived", publishedAt: undefined },
        },
      },
      { new: true }
    ).lean();

    return reply.status(200).send({ success: true, data: updated });
  };

  addJourneyModule = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoJourney = getDemoJourneyModel();

    const newModule = {
      _id: `mod-${Date.now()}`,
      title: body.title || "New Module",
      description: body.description || "",
      lessons: body.lessons || [],
    };

    const updated = await DemoJourney.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      { $push: { modules: newModule } },
      { new: true }
    ).lean();

    return reply.status(201).send({ success: true, data: updated });
  };

  assignJourney = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoJourney = getDemoJourneyModel();
    const journey = await DemoJourney.findById(id).lean();

    return reply.status(201).send({
      success: true,
      message: "Journey successfully assigned to employee.",
      data: {
        _id: `assign-${Date.now()}`,
        journeyId: id,
        journeyTitle: (journey as any)?.title || "Onboarding Journey",
        employeeId: body.employeeId || request.demoUser!.id,
        assignedAt: new Date().toISOString(),
        progress: 0,
      },
    });
  };

  bulkAssignJourneys = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { employeeIds = [] } = (request.body as any) || {};
    return reply.status(201).send({
      success: true,
      message: `Journey assigned to ${employeeIds.length} employees.`,
      data: { count: employeeIds.length },
    });
  };

  getJourneyAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoUser = getDemoUserModel();
    const users = await DemoUser.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    const assignments = users.slice(0, 3).map((u, i) => ({
      _id: `assign-${id}-${u._id}`,
      employeeId: {
        _id: u._id.toString(),
        profile: {
          firstName: u.fullName.split(" ")[0] || "User",
          lastName: u.fullName.split(" ").slice(1).join(" ") || "",
        },
        auth: { email: u.email },
      },
      assignedAt: new Date(Date.now() - (i + 1) * 3 * 86400000).toISOString(),
      progress: {
        completionPercentage: i === 0 ? 100 : i === 1 ? 65 : 20,
        completedLessons: i === 0 ? 5 : i === 1 ? 3 : 1,
        totalLessons: 5,
      },
      status: i === 0 ? "completed" : "in_progress",
    }));

    return reply.status(200).send({ success: true, data: assignments });
  };

  // ==================== ASSIGNMENTS & COURSE VIEWER ====================

  getAssignmentById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoJourney = getDemoJourneyModel();

    // Check if ID matches a journey or strip prefix
    let targetJourneyId = id;
    if (typeof id === "string" && id.startsWith("assign-")) {
      targetJourneyId = id.replace("assign-", "");
    }

    let journey: any = null;
    if (mongoose.Types.ObjectId.isValid(targetJourneyId)) {
      journey = await DemoJourney.findOne({
        _id: new mongoose.Types.ObjectId(targetJourneyId),
        demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      }).lean();
    }

    if (!journey) {
      journey = await DemoJourney.findOne({
        demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      }).lean();
    }

    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Assigned course not found.");
    }

    return reply.status(200).send({
      success: true,
      data: {
        _id: id,
        id,
        journey: {
          journeyId: journey._id.toString(),
          title: journey.title,
          version: 1,
        },
        title: journey.title,
        modules: journey.modules || [],
        progress: {
          completionPercentage: 50,
          completedLessons: 1,
          totalLessons: 3,
        },
        status: "in_progress",
        assignedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
    });
  };

  createAssignment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { journeyId, employeeId } = (request.body as any) || {};
    const DemoJourney = getDemoJourneyModel();
    const journey = await DemoJourney.findById(journeyId).lean();

    return reply.status(201).send({
      success: true,
      data: {
        _id: `assign-${journeyId || Date.now()}`,
        id: `assign-${journeyId || Date.now()}`,
        journey: {
          journeyId: journeyId || "j-1",
          title: (journey as any)?.title || "Onboarding Course",
          version: 1,
        },
        title: (journey as any)?.title || "Onboarding Course",
        employeeId: employeeId || request.demoUser!.id,
        progress: { completionPercentage: 0, completedLessons: 0, totalLessons: 3 },
        status: "in_progress",
        assignedAt: new Date().toISOString(),
      },
    });
  };

  updateLessonProgress = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      message: "Lesson progress updated successfully.",
      data: { isCompleted: true },
    });
  };

  submitQuiz = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      message: "Quiz submitted and evaluated successfully.",
      data: { score: 100, passed: true },
    });
  };

  // ==================== TASKS & HARDWARE ====================

  getTasks = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = new mongoose.Types.ObjectId(request.demoUser!.tenantId);
    const DemoTask = getDemoTaskModel();
    const DemoUser = getDemoUserModel();

    const [tasks, users] = await Promise.all([
      DemoTask.find({ demoTenantId: tenantId }).lean(),
      DemoUser.find({ demoTenantId: tenantId }).lean(),
    ]);

    const userMap: Record<string, any> = {};
    for (const u of users) {
      const parts = (u.fullName || "Demo User").split(" ");
      userMap[u._id.toString()] = {
        _id: u._id.toString(),
        profile: {
          firstName: parts[0] || "Demo",
          lastName: parts.slice(1).join(" ") || "User",
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.fullName)}`,
        },
        auth: { email: u.email },
        permissions: { role: u.role === "demo_admin" ? "admin" : "employee" },
      };
    }

    const defaultAssignee = userMap[request.demoUser!.id] || Object.values(userMap)[0] || {
      _id: "demo-assignee",
      profile: { firstName: "John", lastName: "Doe" },
      auth: { email: "john.doe@acme-demo.com" },
    };

    const formattedTasks = tasks.map((t: any) => {
      const assignedIdStr = t.demoUserId?.toString() || "";
      const assignedUser = userMap[assignedIdStr] || defaultAssignee;

      return {
        ...t,
        _id: t._id.toString(),
        id: t._id.toString(),
        organizationId: tenantId.toString(),
        assignedToUserId: assignedUser,
        employeeId: assignedUser,
        createdBy: userMap[users[1]?._id?.toString() || ""] || defaultAssignee,
        stage: t.stage || "day_1",
        priority: t.priority || "normal",
        status: t.status || "pending",
        dueDate: t.dueDate || new Date(Date.now() + (t.dueDays || 3) * 86400000).toISOString(),
        comments: t.comments || [],
        statusHistory: t.statusHistory || [],
        hardwareMetadata: t.hardwareMetadata,
      };
    });

    return reply.status(200).send({
      success: true,
      data: formattedTasks,
      meta: { total: formattedTasks.length },
    });
  };

  getTaskById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoTask = getDemoTaskModel();
    const task = await DemoTask.findOne({
      _id: id,
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    if (!task) throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");

    return reply.status(200).send({
      success: true,
      data: {
        ...task,
        _id: (task as any)._id.toString(),
        id: (task as any)._id.toString(),
        assignedToUserId: {
          _id: request.demoUser!.id,
          profile: { firstName: "John", lastName: "Doe" },
          auth: { email: request.demoUser!.email },
        },
      },
    });
  };

  createTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const DemoTask = getDemoTaskModel();
    const DemoActivityLog = getDemoActivityLogModel();

    const created = await DemoTask.create({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      demoUserId: body.assignedToUserId ? new mongoose.Types.ObjectId(body.assignedToUserId) : undefined,
      title: body.title || "Custom Onboarding Task",
      description: body.description || "",
      category: body.category || "general",
      stage: body.stage || "day_1",
      priority: body.priority || "normal",
      status: "pending",
      dueDays: 5,
      dueDate: body.dueDate || new Date(Date.now() + 5 * 86400000).toISOString(),
      requiresVerification: !!body.requiresVerification,
      hardwareMetadata: body.hardwareMetadata,
      comments: [],
      statusHistory: [
        {
          status: "pending",
          changedBy: request.demoUser!.email,
          changedAt: new Date().toISOString(),
          note: "Task manually created in demo session",
        },
      ],
    });

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "TASK_CREATED",
      category: "NAVIGATION",
      description: `Created new checklist task: ${created.title}`,
      severity: "info",
    });

    return reply.status(201).send({
      success: true,
      data: {
        ...created.toObject(),
        _id: created._id.toString(),
        id: created._id.toString(),
        assignedToUserId: {
          _id: request.demoUser!.id,
          profile: { firstName: "John", lastName: "Doe" },
          auth: { email: request.demoUser!.email },
        },
      },
    });
  };

  updateTaskStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { status, note } = (request.body as any) || {};

    const DemoTask = getDemoTaskModel();
    const DemoActivityLog = getDemoActivityLogModel();

    const updateObj: any = { status };
    if (status === "completed") {
      updateObj.completedAt = new Date().toISOString();
      updateObj.completedBy = request.demoUser!.email;
    }

    const task = await DemoTask.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      {
        $set: updateObj,
        $push: {
          statusHistory: {
            status,
            changedBy: request.demoUser!.email,
            changedAt: new Date().toISOString(),
            note: note || `Status changed to ${status}`,
          },
        },
      },
      { new: true }
    ).lean();

    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Task not found.");
    }

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "TASK_STATUS_UPDATED",
      category: "NAVIGATION",
      description: `Task '${(task as any).title}' updated to '${status}'`,
      severity: "info",
    });

    return reply.status(200).send({
      success: true,
      data: {
        ...task,
        _id: (task as any)._id.toString(),
        id: (task as any)._id.toString(),
        assignedToUserId: {
          _id: request.demoUser!.id,
          profile: { firstName: "John", lastName: "Doe" },
          auth: { email: request.demoUser!.email },
        },
      },
    });
  };

  addTaskComment = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { comment } = (request.body as any) || {};
    const DemoTask = getDemoTaskModel();

    const newComment = {
      _id: `comment-${Date.now()}`,
      userId: {
        _id: request.demoUser!.id,
        profile: { firstName: "John", lastName: "Doe" },
        auth: { email: request.demoUser!.email },
      },
      comment: comment || "",
      createdAt: new Date().toISOString(),
    };

    const task = await DemoTask.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      { $push: { comments: newComment } },
      { new: true }
    ).lean();

    return reply.status(201).send({
      success: true,
      data: {
        ...task,
        _id: id,
        id,
        assignedToUserId: {
          _id: request.demoUser!.id,
          profile: { firstName: "John", lastName: "Doe" },
          auth: { email: request.demoUser!.email },
        },
      },
    });
  };

  deleteTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoTask = getDemoTaskModel();
    await DemoTask.deleteOne({
      _id: id,
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    });
    return reply.status(200).send({ success: true, message: "Task removed." });
  };

  updateTaskHardware = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoTask = getDemoTaskModel();

    const task = await DemoTask.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      { $set: { hardwareMetadata: body } },
      { new: true }
    ).lean();

    return reply.status(200).send({ success: true, data: task });
  };

  attachHardwareReceipt = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const receiptData = (request.body as any) || {};
    const DemoTask = getDemoTaskModel();

    const task = await DemoTask.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      {
        $set: {
          "hardwareMetadata.receiptAttachment": {
            ...receiptData,
            uploadedAt: new Date().toISOString(),
          },
        },
      },
      { new: true }
    ).lean();

    return reply.status(200).send({ success: true, data: task });
  };

  confirmHardwareReceipt = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { note } = (request.body as any) || {};
    const DemoTask = getDemoTaskModel();

    const task = await DemoTask.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      {
        $set: {
          status: "completed",
          "hardwareMetadata.receivedConfirmedAt": new Date().toISOString(),
          "hardwareMetadata.receivedConfirmedBy": request.demoUser!.email,
        },
        $push: {
          statusHistory: {
            status: "completed",
            changedBy: request.demoUser!.email,
            changedAt: new Date().toISOString(),
            note: note || "Employee confirmed physical equipment handover",
          },
        },
      },
      { new: true }
    ).lean();

    return reply.status(200).send({ success: true, data: task });
  };

  // ==================== DOCUMENTS & DIGITAL SIGNATURES ====================

  getDocuments = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoDocument = getDemoDocumentModel();
    const docs = await DemoDocument.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    return reply.status(200).send({ success: true, data: docs });
  };

  getDocumentTemplates = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoDocument = getDemoDocumentModel();
    const docs = await DemoDocument.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    const templates = docs.map((d: any) => ({
      _id: d._id.toString(),
      id: d._id.toString(),
      title: d.title,
      description: `Official corporate ${d.title} onboarding compliance agreement.`,
      category: d.category || d.documentType || "nda",
      content: d.content || d.renderedContent || "Standard company policy terms and agreement.",
      signatureRequired: true,
      isMandatory: true,
      version: 1,
      audience: {
        autoAssignNewHires: true,
      },
      createdAt: d.createdAt || new Date(Date.now() - 14 * 86400000).toISOString(),
    }));

    return reply.status(200).send({ success: true, data: templates });
  };

  createDocumentTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const DemoDocument = getDemoDocumentModel();
    const DemoActivityLog = getDemoActivityLogModel();

    const created = await DemoDocument.create({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      title: body.title || "Custom Agreement Template",
      documentType: body.category || "custom",
      category: body.category || "custom",
      status: "pending_signature",
      content: body.content || "Custom document template content.",
      renderedContent: body.content || "Custom document template content.",
    });

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "DOCUMENT_TEMPLATE_CREATED",
      category: "NAVIGATION",
      description: `Created document template: ${created.title}`,
      severity: "info",
    });

    return reply.status(201).send({
      success: true,
      data: {
        _id: created._id.toString(),
        id: created._id.toString(),
        title: created.title,
        category: (created as any).category || "custom",
        content: (created as any).content,
        signatureRequired: true,
        version: 1,
        createdAt: new Date().toISOString(),
      },
    });
  };

  getDocumentById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoDocument = getDemoDocumentModel();

    let doc: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      doc = await DemoDocument.findOne({
        _id: new mongoose.Types.ObjectId(id),
        demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      }).lean();
    }

    if (!doc) {
      doc = await DemoDocument.findOne({
        demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      }).lean();
    }

    if (!doc) {
      throw new AppError(404, "DOC_NOT_FOUND", "Document assignment not found.");
    }

    const isSigned = doc.status === "signed";

    return reply.status(200).send({
      success: true,
      data: {
        _id: doc._id.toString(),
        id: doc._id.toString(),
        templateId: doc._id.toString(),
        templateTitle: doc.title,
        templateVersion: 1,
        employeeId: {
          _id: request.demoUser!.id,
          profile: { firstName: "John", lastName: "Doe" },
          auth: { email: request.demoUser!.email },
        },
        assignedBy: "HR Administrator",
        status: isSigned ? "signed" : "pending",
        assignedAt: doc.createdAt || new Date(Date.now() - 3 * 86400000).toISOString(),
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        signedAt: doc.signedAt,
        renderedContent: doc.renderedContent || doc.content || "Standard agreement text.",
        content: doc.content || doc.renderedContent || "Standard agreement text.",
        signatureData: doc.signatureData,
        auditTrail: doc.auditTrail || [
          {
            action: "assigned",
            timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
            details: "Assigned during onboarding package initialization",
          },
        ],
      },
    });
  };

  updateDocumentTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoDocument = getDemoDocumentModel();

    const updated = await DemoDocument.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      { $set: body },
      { new: true }
    ).lean();

    return reply.status(200).send({
      success: true,
      data: {
        ...updated,
        _id: id,
        id,
        category: (updated as any)?.category || (updated as any)?.documentType,
        version: 1,
      },
    });
  };

  deleteDocumentTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const DemoDocument = getDemoDocumentModel();
    await DemoDocument.deleteOne({
      _id: id,
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    });
    return reply.status(200).send({ success: true, message: "Template removed." });
  };

  assignDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const { templateId, employeeId, dueDate } = (request.body as any) || {};
    const DemoDocument = getDemoDocumentModel();
    const doc = await DemoDocument.findById(templateId).lean();

    return reply.status(201).send({
      success: true,
      data: {
        _id: `assign-${Date.now()}`,
        id: `assign-${Date.now()}`,
        templateId: templateId || "tmpl-1",
        templateTitle: (doc as any)?.title || "Standard Document",
        templateVersion: 1,
        employeeId: employeeId || request.demoUser!.id,
        assignedBy: "HR Admin",
        status: "pending",
        assignedAt: new Date().toISOString(),
        dueDate: dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      },
    });
  };

  getDocumentSignatures = async (request: FastifyRequest, reply: FastifyReply) => {
    const { templateId } = request.params as any;
    const DemoDocument = getDemoDocumentModel();
    const doc = await DemoDocument.findOne({
      _id: mongoose.Types.ObjectId.isValid(templateId) ? new mongoose.Types.ObjectId(templateId) : undefined,
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    return reply.status(200).send({
      success: true,
      data: [
        {
          _id: `sig-${templateId || "1"}`,
          templateId: templateId || "tmpl-1",
          templateTitle: (doc as any)?.title || "NDA Agreement",
          templateVersion: 1,
          employeeId: {
            _id: request.demoUser!.id,
            profile: { firstName: "John", lastName: "Doe" },
            auth: { email: "john.doe@acme-demo.com" },
          },
          assignedBy: "HR Administrator",
          status: "signed",
          assignedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          signedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          signatureData: {
            type: "draw",
            signerName: "John Doe",
            signedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
            sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          },
          auditTrail: [
            {
              action: "signed",
              timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
              details: "Signed electronically with verified demo audit trail",
            },
          ],
        },
      ],
    });
  };

  signDocument = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoDocument = getDemoDocumentModel();
    const DemoActivityLog = getDemoActivityLogModel();

    const signerName = body.payload?.signerName || body.signeeName || request.demoUser!.email;
    const signatureData = body.payload || {
      type: "draw",
      signerName,
      signedAt: new Date().toISOString(),
      sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    };

    let doc: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      doc = await DemoDocument.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id), demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
        {
          $set: {
            status: "signed",
            signedAt: new Date(),
            signeeName: signerName,
            signatureData,
          },
          $push: {
            auditTrail: {
              action: "SIGNED",
              timestamp: new Date().toISOString(),
              details: `Digitally signed by ${signerName}`,
            },
          },
        },
        { new: true }
      ).lean();
    }

    if (!doc) {
      doc = await DemoDocument.findOneAndUpdate(
        { demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
        {
          $set: {
            status: "signed",
            signedAt: new Date(),
            signeeName: signerName,
            signatureData,
          },
        },
        { new: true }
      ).lean();
    }

    if (!doc) {
      throw new AppError(404, "DOC_NOT_FOUND", "Document not found.");
    }

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "DOCUMENT_SIGNED",
      category: "NAVIGATION",
      description: `Digitally signed document: ${doc.title}`,
      severity: "info",
    });

    return reply.status(200).send({
      success: true,
      message: "Document successfully signed.",
      data: {
        ...doc,
        _id: doc._id.toString(),
        id: doc._id.toString(),
        status: "signed",
        signedAt: new Date().toISOString(),
        signatureData,
      },
    });
  };

  getEmailInbox = async (request: FastifyRequest, reply: FastifyReply) => {
    const emails = await demoEmailSinkService.getInbox(request.demoUser!.tenantId);
    return reply.status(200).send({ success: true, data: emails });
  };

  simulateEmail = async (request: FastifyRequest, reply: FastifyReply) => {
    const { subject, htmlContent } = (request.body as any) || {};
    const email = await demoEmailSinkService.captureEmail(
      request.demoUser!.email,
      subject || "Onboarding Milestone Achieved (Demo Simulation)",
      htmlContent || "<p>Congratulations! You have completed your first day checklist in the Talnova Demo.</p>",
      request.demoUser!.tenantId,
      "user_simulated"
    );
    return reply.status(201).send({ success: true, data: email });
  };

  exportControlledData = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoActivityLog = getDemoActivityLogModel();

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "EXPORT_ATTEMPTED",
      category: "EXPORT",
      description: `Exported controlled synthetic demo data summary`,
      severity: "warning",
      metadata: { recordCount: 10, watermark: true },
    });

    const watermarkNote = `CONFIDENTIAL & PROPRIETARY — SYNTHETIC DEMO DATA ONLY — SESSION ${request.demoUser!.sessionId}`;

    return reply.status(200).send({
      success: true,
      watermark: watermarkNote,
      exportedAt: new Date().toISOString(),
      sampleRecords: [
        { id: "DEMO-001", type: "Synthetic Employee", name: "Jane Smith", status: "Active" },
        { id: "DEMO-002", type: "Synthetic Employee", name: "Alex Jones", status: "Onboarding" },
      ],
      notice: "Production database records are completely isolated and never exposed in demo exports.",
    });
  };

  getDashboardSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = new mongoose.Types.ObjectId(request.demoUser!.tenantId);
    const DemoTask = getDemoTaskModel();
    const DemoUser = getDemoUserModel();
    const DemoDocument = getDemoDocumentModel();

    const [tasks, users, documents] = await Promise.all([
      DemoTask.find({ demoTenantId: tenantId }).lean(),
      DemoUser.find({ demoTenantId: tenantId }).lean(),
      DemoDocument.find({ demoTenantId: tenantId }).lean(),
    ]);

    const completedTasks = tasks.filter((t) => t.status === "completed").length;

    return reply.status(200).send({
      success: true,
      data: {
        activeEmployees: users.length,
        pendingTasks: tasks.length - completedTasks,
        completedTasks,
        pendingDocuments: documents.filter((d) => d.status === "pending_signature").length,
        completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
        averageDaysToProductivity: 14,
        metrics: {
          activeOnboarding: users.length,
          completedThisMonth: 14,
          overdueTasks: tasks.filter((t) => t.dueDays < 2 && t.status !== "completed").length,
          avgCompletionDays: 14,
          satisfactionScore: 4.9,
        },
        recentActivity: [
          {
            id: "act-1",
            type: "task_completed",
            user: "John Doe",
            title: "Configured 1Password & MFA Keys",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: "act-2",
            type: "document_signed",
            user: "Sarah Connor",
            title: "Signed Confidentiality Agreement",
            timestamp: new Date(Date.now() - 7200000).toISOString(),
          },
          {
            id: "act-3",
            type: "journey_started",
            user: "Alice Smith",
            title: "Engineering Onboarding Roadmap",
            timestamp: new Date(Date.now() - 14400000).toISOString(),
          },
        ],
        onboardingVelocity: [
          { week: "Week 1", started: 4, completed: 3 },
          { week: "Week 2", started: 6, completed: 5 },
          { week: "Week 3", started: 5, completed: 6 },
          { week: "Week 4", started: 8, completed: 7 },
        ],
      },
    });
  };

  getDirectory = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoUser = getDemoUserModel();
    const users = await DemoUser.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    })
      .select("-passwordHash")
      .lean();

    const formatted = users.map((u, idx) => {
      const parts = (u.fullName || "Demo User").split(" ");
      const firstName = parts[0] || "Demo";
      const lastName = parts.slice(1).join(" ") || "User";
      const deptName = u.department || (idx % 3 === 0 ? "Engineering" : idx % 3 === 1 ? "Sales" : "Product & Design");
      const jobTitle = u.jobTitle || (idx % 2 === 0 ? "Senior Software Engineer" : "Product Specialist");
      const loc = idx % 2 === 0 ? "San Francisco, CA" : "New York, NY";
      const idStr = u._id.toString();

      return {
        ...u,
        _id: idStr,
        id: idStr,
        fullName: u.fullName,
        email: u.email,
        department: deptName,
        jobTitle,
        location: loc,
        status: "active",
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.fullName)}`,
        joinedDate: new Date(Date.now() - (idx + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
        profile: {
          firstName,
          lastName,
          fullName: u.fullName,
          location: loc,
          phone: "+1 (555) 234-5678",
          timezone: idx % 2 === 0 ? "America/Los_Angeles" : "America/New_York",
          avatar: {
            publicUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.fullName)}`,
          },
        },
        auth: {
          email: u.email,
          status: "active",
        },
        employment: {
          employeeId: `EMP-${1000 + idx}`,
          department: deptName,
          departmentId: `dept-${deptName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          designation: jobTitle,
          jobTitle,
          status: "active",
          hireDate: new Date(Date.now() - (idx + 10) * 86400000).toISOString(),
          employmentType: "full_time",
          onboardingState: idx === 0 ? "in_progress" : "completed",
        },
        permissions: {
          role: u.role === "demo_admin" ? "admin" : u.role === "demo_manager" ? "manager" : "employee",
          roles: [u.role === "demo_admin" ? "admin" : u.role === "demo_manager" ? "manager" : "employee"],
          customRoles: [],
        },
        statistics: {
          completionRate: 85,
          completedJourneys: 2,
          certificates: 1,
        },
      };
    });

    return reply.status(200).send({
      success: true,
      data: formatted,
      meta: { total: formatted.length, page: 1, limit: 50 },
    });
  };

  getKBArticles = async (request: FastifyRequest, reply: FastifyReply) => {
    const { getDemoKBArticleModel } = await import("../models/index.js");
    const DemoKBArticle = getDemoKBArticleModel();
    const query = (request.query as any) || {};

    let articles = await DemoKBArticle.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    // Fallback if tenant articles haven't been seeded yet
    if (!articles || articles.length === 0) {
      articles = [
        {
          _id: new mongoose.Types.ObjectId("658c1f000000000000000101"),
          title: "Welcome to Acme: Company Handbook & Core Culture",
          category: "Employee Handbook",
          summary: "Essential guidance on Acme values, hybrid work expectations, communication norms, and employee wellness.",
          content: "### Our Mission\nAt Acme, we build mission-critical enterprise software with zero compromise on quality and security.\n\n### Working Hours & Flexibility\nCore collaboration hours are 10:00 AM to 4:00 PM local time. Outside of core hours, asynchronous communication via Slack and Jira is encouraged.",
          readTimeMinutes: 4,
          status: "published",
        } as any,
        {
          _id: new mongoose.Types.ObjectId("658c1f000000000000000102"),
          title: "Engineering Development Standards & CI/CD Guidelines",
          category: "Engineering Guidelines",
          summary: "Branching strategies, PR review criteria, deployment gates, and security scan compliance requirements.",
          content: "### Pull Request Etiquette\n- All PRs require at least 2 approvals from team code owners.\n- Automated test coverage must not decrease.\n- Static analysis passes without blockers.",
          readTimeMinutes: 6,
          status: "published",
        } as any,
        {
          _id: new mongoose.Types.ObjectId("658c1f000000000000000103"),
          title: "IT Security Protocols & Device Compliance",
          category: "Company Policies",
          summary: "Device encryption, password management, VPN requirements, and incident reporting procedures.",
          content: "### Hardware Requirements\nAll company laptops must enforce full-disk encryption and automatic screen lock after 5 minutes.",
          readTimeMinutes: 3,
          status: "published",
        } as any,
        {
          _id: new mongoose.Types.ObjectId("658c1f000000000000000104"),
          title: "Healthcare Benefits, 401(k) & Wellness Stipend",
          category: "HR & People",
          summary: "Overview of comprehensive medical, dental, vision coverage, retirement match, and wellness subsidies.",
          content: "### Comprehensive Coverage\nCoverage begins on Day 1. Enroll via the employee self-service portal within 30 days of hiring.",
          readTimeMinutes: 5,
          status: "published",
        } as any,
      ];
    }

    let formatted = articles.map(formatKBArticle);

    if (query.search) {
      const q = String(query.search).toLowerCase();
      formatted = formatted.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q)
      );
    }

    if (query.categoryId) {
      formatted = formatted.filter((a) => a.categoryId === query.categoryId);
    }

    if (query.status) {
      formatted = formatted.filter((a) => a.publishing?.status === query.status);
    }

    return reply.status(200).send({
      success: true,
      data: formatted,
    });
  };

  getKBArticleById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { getDemoKBArticleModel } = await import("../models/index.js");
    const DemoKBArticle = getDemoKBArticleModel();

    let article: any = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      article = await DemoKBArticle.findOne({
        _id: id,
        demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      }).lean();
    }

    if (!article) {
      // Check fallback articles
      const fallbackList = [
        {
          _id: id,
          title: "Acme Onboarding & Culture Guide",
          category: "Employee Handbook",
          summary: "Essential guidance on Acme values, hybrid work expectations, communication norms, and employee wellness.",
          content: "### Our Mission\nAt Acme, we build mission-critical enterprise software with zero compromise on quality and security.",
          readTimeMinutes: 4,
          status: "published",
        },
      ];
      article = fallbackList[0];
    }

    return reply.status(200).send({
      success: true,
      data: formatKBArticle(article),
    });
  };

  createKBArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    const { getDemoKBArticleModel } = await import("../models/index.js");
    const DemoKBArticle = getDemoKBArticleModel();

    const category = body.category || "Company Policies";
    const textContent =
      body.content?.blocks?.map((b: any) => b.content).filter(Boolean).join("\n\n") ||
      body.summary ||
      "";

    const created = await DemoKBArticle.create({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
      title: body.title || "New Knowledge Base Article",
      summary: body.summary || "",
      category,
      content: textContent,
      readTimeMinutes: 3,
    });

    return reply.status(201).send({
      success: true,
      data: formatKBArticle(created.toObject()),
    });
  };

  updateKBArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const { getDemoKBArticleModel } = await import("../models/index.js");
    const DemoKBArticle = getDemoKBArticleModel();

    const updateFields: any = {};
    if (body.title) updateFields.title = body.title;
    if (body.summary) updateFields.summary = body.summary;
    if (body.category) updateFields.category = body.category;
    if (body.content?.blocks) {
      updateFields.content = body.content.blocks.map((b: any) => b.content).filter(Boolean).join("\n\n");
    }

    const updated = await DemoKBArticle.findOneAndUpdate(
      { _id: id, demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId) },
      { $set: updateFields },
      { new: true }
    ).lean();

    return reply.status(200).send({
      success: true,
      data: formatKBArticle(updated || { _id: id, ...body }),
    });
  };

  deleteKBArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { getDemoKBArticleModel } = await import("../models/index.js");
    const DemoKBArticle = getDemoKBArticleModel();

    await DemoKBArticle.deleteOne({
      _id: id,
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    });

    return reply.status(200).send({
      success: true,
      message: "Knowledge base article removed successfully.",
    });
  };

  publishKBArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    return reply.status(200).send({
      success: true,
      data: formatKBArticle({ _id: id, status: "published" }),
    });
  };

  archiveKBArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    return reply.status(200).send({
      success: true,
      data: formatKBArticle({ _id: id, status: "archived" }),
    });
  };

  getQuickLinks = async (request: FastifyRequest, reply: FastifyReply) => {
    const links = getTenantQuickLinks(request.demoUser!.tenantId);
    return reply.status(200).send({ success: true, data: links });
  };

  createQuickLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const links = getTenantQuickLinks(request.demoUser!.tenantId);
    const body = (request.body as any) || {};
    const newLink = {
      _id: `ql-${Date.now()}`,
      title: body.title || "External Link",
      url: body.url || "https://talnova.io",
      icon: body.icon || "Globe",
      order: links.length + 1,
    };
    links.push(newLink);
    return reply.status(201).send({ success: true, data: newLink });
  };

  updateQuickLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const links = getTenantQuickLinks(request.demoUser!.tenantId);
    const body = (request.body as any) || {};
    const idx = links.findIndex((l) => l._id === id);
    if (idx !== -1) {
      links[idx] = { ...links[idx], ...body };
      return reply.status(200).send({ success: true, data: links[idx] });
    }
    return reply.status(200).send({ success: true, data: { _id: id, ...body } });
  };

  deleteQuickLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const links = getTenantQuickLinks(request.demoUser!.tenantId);
    const idx = links.findIndex((l) => l._id === id);
    if (idx !== -1) {
      links.splice(idx, 1);
    }
    return reply.status(200).send({ success: true, message: "Quick link deleted" });
  };

  getKnowledgeGaps = async (request: FastifyRequest, reply: FastifyReply) => {
    const gaps = getTenantKnowledgeGaps(request.demoUser!.tenantId);
    return reply.status(200).send({
      success: true,
      data: gaps,
      pagination: {
        total: gaps.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    });
  };

  resolveKnowledgeGapWithQuickAnswer = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { answer } = (request.body as any) || {};
    const gaps = getTenantKnowledgeGaps(request.demoUser!.tenantId);
    const gap = gaps.find((g) => g._id === id);
    if (gap) {
      gap.status = "resolved";
      gap.resolutionType = "quick_answer";
      gap.resolutionNotes = answer;
      gap.resolvedAt = new Date().toISOString();
      return reply.status(200).send({ success: true, data: gap });
    }
    return reply.status(200).send({ success: true, data: { _id: id, status: "resolved", resolutionType: "quick_answer" } });
  };

  resolveKnowledgeGapWithArticle = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { articleId } = (request.body as any) || {};
    const gaps = getTenantKnowledgeGaps(request.demoUser!.tenantId);
    const gap = gaps.find((g) => g._id === id);
    if (gap) {
      gap.status = "resolved";
      gap.resolutionType = "article";
      gap.resolutionResourceId = articleId;
      gap.resolvedAt = new Date().toISOString();
      return reply.status(200).send({ success: true, data: gap });
    }
    return reply.status(200).send({ success: true, data: { _id: id, status: "resolved", resolutionType: "article" } });
  };

  dismissKnowledgeGap = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const gaps = getTenantKnowledgeGaps(request.demoUser!.tenantId);
    const gap = gaps.find((g) => g._id === id);
    if (gap) {
      gap.status = "dismissed";
      return reply.status(200).send({ success: true, data: gap });
    }
    return reply.status(200).send({ success: true, data: { _id: id, status: "dismissed" } });
  };

  triggerReindex = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: { articlesIndexed: 6, totalChunksCreated: 24 },
    });
  };

  getAnalyticsSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: {
        totalOnboarded: 48,
        activeInProgress: 8,
        averageCompletionDays: 14.2,
        csatScore: 4.85,
        departmentBreakdown: [
          { department: "Engineering", count: 22, avgDays: 16 },
          { department: "Sales", count: 14, avgDays: 12 },
          { department: "Product & Design", count: 7, avgDays: 13 },
          { department: "Operations", count: 5, avgDays: 10 },
        ],
        completionTrend: [
          { month: "May", rate: 88 },
          { month: "Jun", rate: 91 },
          { month: "Jul", rate: 94 },
          { month: "Aug", rate: 92 },
          { month: "Sep", rate: 96 },
        ],
      },
    });
  };

  getLeaderboard = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoUser = getDemoUserModel();
    const users = await DemoUser.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    const leaderboard = users.map((u, i) => ({
      userId: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      department: u.department,
      rank: i + 1,
      points: 1250 - i * 180,
      badgesCount: 4 - (i % 3),
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.fullName)}`,
    }));

    return reply.status(200).send({
      success: true,
      data: leaderboard,
    });
  };

  recordTelemetry = async (request: FastifyRequest, reply: FastifyReply) => {
    const { getDemoFeatureUsageModel } = await import("../models/index.js");
    const DemoFeatureUsage = getDemoFeatureUsageModel();
    const { featureKey, route, action = "view", status = "ALLOWED", durationSeconds = 0, metadata = {} } =
      (request.body as any) || {};

    if (!featureKey || !route) {
      throw new AppError(400, "VALIDATION_ERROR", "featureKey and route are required.");
    }

    const companyName = request.demoUser!.companyName || "Acme Corporation Demo";
    const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "-");

    const usageRecord = await DemoFeatureUsage.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      userEmail: request.demoUser!.email,
      companySlug,
      companyName,
      featureKey,
      route,
      action,
      status,
      durationSeconds,
      metadata,
    });

    return reply.status(201).send({
      success: true,
      data: { id: usageRecord._id, recordedAt: usageRecord.createdAt },
    });
  };

  getCurrentOrganization = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoTenant = getDemoTenantModel();
    const tenant = await DemoTenant.findById(request.demoUser!.tenantId).lean();
    if (!tenant) throw new AppError(404, "NOT_FOUND", "Demo company not found.");

    return reply.status(200).send({
      success: true,
      data: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        domain: tenant.domain,
        supportEmail: tenant.contactEmail || "support@talnova.demo",
        branding: {
          logo: { publicUrl: "" },
          primaryColor: "#0284c7",
        },
        notificationSettings: {
          assignmentEmail: true,
          reminderEmail: true,
          weeklyDigest: true,
        },
        securitySettings: {
          allowPasswordLogin: true,
          enforceMfa: false,
          sessionTimeout: 3600,
        },
        categories: ["Engineering", "Product", "Operations", "Sales", "HR"],
        certificate: { template: "classic" },
        analytics: {
          totalEmployees: 24,
          journeys: 6,
          completionRate: 88,
        },
      },
    });
  };

  updateCurrentOrganization = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoTenant = getDemoTenantModel();
    const body = (request.body as any) || {};
    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.supportEmail) updateData.contactEmail = body.supportEmail;

    const tenant = await DemoTenant.findByIdAndUpdate(
      request.demoUser!.tenantId,
      updateData,
      { new: true }
    ).lean();

    return reply.status(200).send({
      success: true,
      message: "Demo organization settings updated.",
      data: {
        ...body,
        name: tenant?.name || body.name || "Acme Corporation Demo",
        slug: tenant?.slug || "acme-corp-demo",
      },
    });
  };

  updateBranding = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      message: "Branding updated successfully in demo.",
      data: {
        primaryColor: body.primaryColor || "#0284c7",
        logo: body.logo || null,
      },
    });
  };

  updateSecurity = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      message: "Security settings updated in demo.",
      data: body,
    });
  };

  getDepartments = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: [
        { _id: "dept-eng", name: "Engineering", code: "ENG", employeeCount: 14 },
        { _id: "dept-prod", name: "Product & Design", code: "PROD", employeeCount: 6 },
        { _id: "dept-sales", name: "Sales & Marketing", code: "SALES", employeeCount: 8 },
        { _id: "dept-hr", name: "People Operations", code: "HR", employeeCount: 4 },
        { _id: "dept-ops", name: "Operations", code: "OPS", employeeCount: 5 },
      ],
    });
  };

  createDepartment = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    return reply.status(201).send({
      success: true,
      data: {
        _id: `dept-${Date.now()}`,
        name: body.name || "New Department",
        code: body.code || "NEW",
        employeeCount: 1,
      },
    });
  };

  deleteDepartment = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      message: "Department removed in demo.",
    });
  };

  getIntegrationCapabilities = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: {
        ai: { available: true, status: "active", provider: "talnova-ai" },
        email: { available: true, status: "active", provider: "sandbox-sink" },
      },
    });
  };

  getNotificationPreferences = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: {
        categories: {
          journeyAssigned: { email: true, inApp: true },
          journeyOverdue: { email: true, inApp: true },
          taskCompleted: { email: true, inApp: true },
          milestoneReached: { email: true, inApp: true },
        },
      },
    });
  };

  updateNotificationPreferences = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      message: "Preferences updated in demo.",
      data: body,
    });
  };

  getNotifications = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: [
        {
          _id: "notif-1",
          title: "Welcome to Talnova Demo",
          message: "Explore your interactive onboarding roadmap, tasks, and directory.",
          type: "info",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  };

  getEmployeeMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoUser = getDemoUserModel();
    const user = await DemoUser.findById(request.demoUser!.id).lean();
    if (!user) throw new AppError(404, "NOT_FOUND", "Demo identity not found.");

    const roleMap: Record<string, string> = {
      demo_admin: "admin",
      demo_manager: "manager",
      demo_employee: "employee",
    };
    const mappedRole = roleMap[user.role] || "employee";

    const names = user.fullName.split(" ");
    const firstName = names[0] || user.fullName;
    const lastName = names.slice(1).join(" ") || "";

    return reply.status(200).send({
      success: true,
      data: {
        _id: user._id.toString(),
        profile: {
          firstName,
          lastName,
          fullName: user.fullName,
          location: "San Francisco, CA",
          timezone: "America/Los_Angeles",
          phone: "+1 (555) 234-5678",
          avatar: { publicUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.fullName)}` },
        },
        auth: {
          email: user.email,
        },
        employment: {
          designation: user.jobTitle,
          departmentId: "dept-eng",
          status: "active",
          hireDate: new Date(Date.now() - 30 * 86400000).toISOString(),
          employmentType: "full_time",
          employeeId: `EMP-${user._id.toString().slice(-4).toUpperCase()}`,
          onboardingState: "active",
        },
        permissions: {
          role: mappedRole,
          roles: [mappedRole],
          customRoles: [],
        },
        statistics: {
          completedJourneys: 2,
          certificates: 1,
          completionRate: 85,
        },
        compliance: {
          legalHold: false,
        },
      },
    });
  };

  getEmployeeById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    if (id === "me") {
      return this.getEmployeeMe(request, reply);
    }
    const DemoUser = getDemoUserModel();
    const user = await DemoUser.findById(id).lean();
    if (!user) {
      return this.getEmployeeMe(request, reply);
    }
    const names = user.fullName.split(" ");
    return reply.status(200).send({
      success: true,
      data: {
        _id: user._id.toString(),
        profile: {
          firstName: names[0] || user.fullName,
          lastName: names.slice(1).join(" ") || "",
          fullName: user.fullName,
          location: "San Francisco, CA",
        },
        auth: { email: user.email },
        employment: {
          designation: user.jobTitle,
          departmentId: "dept-eng",
          status: "active",
          hireDate: new Date(Date.now() - 45 * 86400000).toISOString(),
        },
        permissions: { role: "employee", roles: ["employee"] },
        statistics: { completedJourneys: 1, certificates: 1, completionRate: 90 },
      },
    });
  };

  getAssignmentsMe = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoJourney = getDemoJourneyModel();
    const journeys = await DemoJourney.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    const formatted = journeys.map((j, i) => ({
      _id: `assign-${j._id}`,
      journey: {
        journeyId: j._id.toString(),
        title: j.title,
        version: 1,
      },
      assignment: {
        assignedAt: new Date(Date.now() - (i + 1) * 7 * 86400000).toISOString(),
      },
      progress: {
        completionPercentage: i === 0 ? 100 : 65,
        completedLessons: i === 0 ? 6 : 4,
        totalLessons: 6,
      },
      status: i === 0 ? "completed" : "in_progress",
      certificate: i === 0 ? {
        issued: true,
        issuedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        certificateId: `CERT-${j._id.toString().slice(-6).toUpperCase()}`,
      } : undefined,
    }));

    return reply.status(200).send({ success: true, data: formatted });
  };

  getAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    return this.getAssignmentsMe(request, reply);
  };

  getManagerDashboard = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: {
        totalDirectReports: 4,
        activeOnboardingCount: 2,
        overallCompletionRate: 84,
        overdueItemsCount: 0,
        recentActivities: [
          {
            id: "mact-1",
            employeeName: "John Doe",
            type: "task_completed",
            title: "Completed Development Tooling Setup",
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: "mact-2",
            employeeName: "Bob Vance",
            type: "journey_completed",
            title: "Sales Engineering Certification",
            timestamp: new Date(Date.now() - 14400000).toISOString(),
          },
        ],
      },
    });
  };

  getManagerTeam = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoUser = getDemoUserModel();
    const users = await DemoUser.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    const directReports = users.map((u, i) => ({
      _id: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      jobTitle: u.jobTitle,
      department: u.department,
      location: i % 2 === 0 ? "San Francisco, CA" : "New York, NY",
      hireDate: new Date(Date.now() - (i + 2) * 14 * 86400000).toLocaleDateString(),
      status: i === 0 ? "onboarding" : "active",
      journeyStats: {
        totalAssigned: 2,
        completed: i === 0 ? 1 : 2,
        inProgress: i === 0 ? 1 : 0,
        completionPercentage: i === 0 ? 65 : 100,
      },
      taskStats: {
        totalAssigned: 6,
        completed: i === 0 ? 4 : 6,
        overdue: 0,
      },
      hasOverdueItems: false,
      signedOffAt: i > 0 ? new Date(Date.now() - 7 * 86400000).toISOString() : undefined,
    }));

    return reply.status(200).send({ success: true, data: directReports });
  };

  getManagerTeamOverview = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoUser = getDemoUserModel();
    const users = await DemoUser.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    const team = users.map((u, i) => ({
      _id: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      jobTitle: u.jobTitle,
      department: u.department,
      location: i % 2 === 0 ? "San Francisco, CA" : "New York, NY",
      hireDate: new Date(Date.now() - (i + 2) * 14 * 86400000).toLocaleDateString(),
      status: i === 0 ? "onboarding" : "active",
      journeyStats: {
        totalAssigned: 2,
        completed: i === 0 ? 1 : 2,
        inProgress: i === 0 ? 1 : 0,
        completionPercentage: i === 0 ? 65 : 100,
      },
      taskStats: {
        totalAssigned: 6,
        completed: i === 0 ? 4 : 6,
        overdue: 0,
      },
      hasOverdueItems: false,
      signedOffAt: i > 0 ? new Date(Date.now() - 7 * 86400000).toISOString() : undefined,
    }));

    return reply.status(200).send({
      success: true,
      data: {
        metrics: {
          totalDirectReports: team.length,
          activeOnboardingCount: 2,
          overallCompletionRate: 84,
          overdueItemsCount: 0,
          recentActivities: [
            {
              id: "mact-1",
              employeeName: "John Doe",
              type: "task_completed",
              title: "Completed Development Tooling Setup",
              timestamp: new Date(Date.now() - 3600000).toISOString(),
            },
          ],
        },
        team,
      },
    });
  };

  getManagerDirectReportDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    const { employeeId } = request.params as any;
    const DemoUser = getDemoUserModel();
    const user =
      (await DemoUser.findById(employeeId).lean()) ||
      (await DemoUser.findOne({ demoTenantId: request.demoUser!.tenantId }).lean());

    return reply.status(200).send({
      success: true,
      data: {
        employee: {
          _id: user?._id.toString() || employeeId,
          fullName: user?.fullName || "John Doe",
          email: user?.email || "john.doe@acme-demo.com",
          jobTitle: user?.jobTitle || "Senior Frontend Engineer",
          department: user?.department || "Engineering",
          hireDate: new Date(Date.now() - 30 * 86400000).toISOString(),
          status: "onboarding",
        },
        assignments: [
          {
            _id: "asg-1",
            journeyTitle: "Engineering Onboarding Roadmap",
            journeyVersion: 1,
            status: "in_progress",
            assignedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
            progress: { completionPercentage: 70, completedLessons: 4, totalLessons: 6 },
          },
        ],
        tasks: [
          {
            _id: "tsk-1",
            title: "Complete Security Awareness Training",
            category: "Compliance",
            status: "completed",
            priority: "high",
            dueDate: new Date().toISOString(),
          },
          {
            _id: "tsk-2",
            title: "Submit Signed W-4 and Direct Deposit",
            category: "HR Operations",
            status: "completed",
            priority: "urgent",
            dueDate: new Date().toISOString(),
          },
        ],
      },
    });
  };

  nudgeDirectReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const { employeeId } = request.params as any;
    const { message } = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      message: message || "Friendly nudge sent to direct report.",
      data: { employeeId, sentAt: new Date().toISOString() },
    });
  };

  signOffDirectReport = async (request: FastifyRequest, reply: FastifyReply) => {
    const { employeeId } = request.params as any;
    const { notes } = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      message: "Direct report onboarding officially signed off.",
      data: { employeeId, notes, signedOffAt: new Date().toISOString() },
    });
  };

  getMyBuddyProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);
    const profile = state.profiles.get(request.demoUser!.id) || null;
    return reply.status(200).send({ success: true, data: profile });
  };

  saveBuddyProfile = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);
    const body = (request.body as any) || {};
    const existing = state.profiles.get(request.demoUser!.id) || {
      _id: `bp-${request.demoUser!.id}`,
      userId: request.demoUser!.id,
      department: "Engineering",
      jobTitle: "Staff Software Engineer",
      currentMenteeCount: 1,
    };

    const updated = {
      ...existing,
      ...body,
      skills: Array.isArray(body.skills) ? body.skills : typeof body.skills === "string" ? body.skills.split(",").map((s: string) => s.trim()) : existing.skills,
      languages: Array.isArray(body.languages) ? body.languages : typeof body.languages === "string" ? body.languages.split(",").map((s: string) => s.trim()) : existing.languages,
    };

    state.profiles.set(request.demoUser!.id, updated);
    return reply.status(200).send({ success: true, data: updated });
  };

  getMyBuddy = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);
    // Find assignment where current user is the new hire mentee
    const assignment =
      state.assignments.find((a) => a.newHireUserId?._id === request.demoUser!.id || a._id === "asg-my-buddy") ||
      state.assignments[0] ||
      null;

    return reply.status(200).send({
      success: true,
      data: assignment,
    });
  };

  getMyMentees = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);
    // Find assignments where current user is the mentor
    const mentees = state.assignments.filter(
      (a) => a.buddyUserId?._id === request.demoUser!.id || a._id === "asg-mentee-1"
    );

    return reply.status(200).send({
      success: true,
      data: mentees,
    });
  };

  getBuddyAssignments = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);
    return reply.status(200).send({ success: true, data: state.assignments });
  };

  getAvailableBuddies = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);
    const available = Array.from(state.profiles.values()).filter((p) => p.userId?._id !== request.demoUser!.id);
    return reply.status(200).send({
      success: true,
      data: available.length > 0 ? available : Array.from(state.profiles.values()),
    });
  };

  assignBuddy = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);
    const { newHireUserId, buddyUserId, checklistTemplate } = (request.body as any) || {};

    const DemoUser = getDemoUserModel();
    const [newHireDoc, buddyDoc] = await Promise.all([
      DemoUser.findById(newHireUserId).lean().catch(() => null),
      DemoUser.findById(buddyUserId).lean().catch(() => null),
    ]);

    const newHireName = newHireDoc?.fullName || "Taylor Morgan";
    const buddyName = buddyDoc?.fullName || "Alice Smith";
    const newHireParts = newHireName.split(" ");
    const buddyParts = buddyName.split(" ");

    const newAssignment = {
      _id: `asg-${Date.now()}`,
      assignedAt: new Date().toISOString(),
      status: "active" as const,
      buddyUserId: {
        _id: buddyUserId,
        profile: {
          firstName: buddyParts[0],
          lastName: buddyParts.slice(1).join(" "),
          avatar: { publicUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddyName)}` },
        },
        employment: {
          jobTitle: buddyDoc?.jobTitle || "Senior Staff Engineer",
          department: buddyDoc?.department || "Engineering",
        },
      },
      newHireUserId: {
        _id: newHireUserId,
        profile: {
          firstName: newHireParts[0],
          lastName: newHireParts.slice(1).join(" "),
        },
        employment: {
          jobTitle: newHireDoc?.jobTitle || "Software Engineer",
          department: newHireDoc?.department || "Engineering",
        },
      },
      communicationLinks: {
        email: buddyDoc?.email || "alice.smith@acme-demo.com",
        slackChannelUrl: "https://slack.com",
        teamsUrl: "https://teams.microsoft.com",
      },
      checklist: [
        {
          _id: `chk-new-1`,
          title: "Initial 1-on-1 Coffee & Welcome Chat",
          stage: "day_1" as const,
          completed: false,
        },
        {
          _id: `chk-new-2`,
          title: "Team Tools & Engineering Guidelines Walkthrough",
          stage: "week_1" as const,
          completed: false,
        },
        {
          _id: `chk-new-3`,
          title: "30-Day Check-in & Culture Alignment",
          stage: "month_1" as const,
          completed: false,
        },
      ],
      checkins: [],
    };

    state.assignments.unshift(newAssignment);
    return reply.status(201).send({ success: true, data: newAssignment });
  };

  updateBuddyChecklist = async (request: FastifyRequest, reply: FastifyReply) => {
    const { assignmentId } = request.params as any;
    const { taskId, completed } = (request.body as any) || {};
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);

    const assignment = state.assignments.find((a) => a._id === assignmentId);
    if (assignment && assignment.checklist) {
      const task = assignment.checklist.find((t: any) => t._id === taskId || t.title === taskId);
      if (task) {
        task.completed = completed;
        task.completedAt = completed ? new Date().toISOString() : undefined;
      }
      return reply.status(200).send({ success: true, data: assignment });
    }

    return reply.status(200).send({
      success: true,
      data: { _id: assignmentId, checklist: [] },
    });
  };

  logBuddyCheckin = async (request: FastifyRequest, reply: FastifyReply) => {
    const { assignmentId } = request.params as any;
    const { notes, rating, sentiment } = (request.body as any) || {};
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);

    const assignment = state.assignments.find((a) => a._id === assignmentId);
    if (assignment) {
      if (!assignment.checkins) assignment.checkins = [];
      const newCheckin = {
        _id: `chk-in-${Date.now()}`,
        completedAt: new Date().toISOString(),
        notes: notes || "Informal catch-up and milestone review.",
        rating: rating || 5,
        sentiment: sentiment || "positive",
      };
      assignment.checkins.push(newCheckin);
      return reply.status(201).send({ success: true, data: assignment });
    }

    return reply.status(200).send({ success: true, data: { _id: assignmentId } });
  };

  addBuddyChecklistTask = async (request: FastifyRequest, reply: FastifyReply) => {
    const { assignmentId } = request.params as any;
    const { title, stage, description } = (request.body as any) || {};
    const state = getTenantBuddyState(request.demoUser!.tenantId, request.demoUser!.id);

    const assignment = state.assignments.find((a) => a._id === assignmentId);
    if (assignment) {
      if (!assignment.checklist) assignment.checklist = [];
      const newTask = {
        _id: `task-${Date.now()}`,
        title: title || "Custom Mentorship Task",
        description: description || "",
        stage: stage || "day_1",
        completed: false,
      };
      assignment.checklist.push(newTask);
      return reply.status(201).send({ success: true, data: assignment });
    }

    return reply.status(200).send({ success: true, data: { _id: assignmentId } });
  };

  getAuditLogs = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoActivityLog = getDemoActivityLogModel();
    const logs = await DemoActivityLog.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    const formatted = logs.map((l) => ({
      _id: l._id.toString(),
      action: l.action,
      category: l.category,
      description: l.description,
      createdAt: l.createdAt,
      actorUserId: {
        profile: {
          firstName: "Sarah",
          lastName: "Connor",
        },
      },
    }));

    return reply.status(200).send({ success: true, data: formatted });
  };

  getDocumentsInbox = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoDocument = getDemoDocumentModel();
    const docs = await DemoDocument.find({
      demoTenantId: new mongoose.Types.ObjectId(request.demoUser!.tenantId),
    }).lean();

    return reply.status(200).send({
      success: true,
      data: docs.map((d) => ({
        _id: d._id.toString(),
        id: d._id.toString(),
        title: d.title,
        type: d.documentType,
        status: d.status === "signed" ? "completed" : "pending",
        required: true,
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      })),
    });
  };

  // ==================== MILESTONES & REVIEWS ====================

  getMilestones = async (request: FastifyRequest, reply: FastifyReply) => {
    return this.getMyMilestones(request, reply);
  };

  getMyMilestones = async (request: FastifyRequest, reply: FastifyReply) => {
    const DemoUser = getDemoUserModel();
    const user = await DemoUser.findById(request.demoUser!.id).lean();

    const empIdObj = {
      _id: request.demoUser!.id,
      id: request.demoUser!.id,
      profile: {
        firstName: user?.fullName.split(" ")[0] || "John",
        lastName: user?.fullName.split(" ").slice(1).join(" ") || "Doe",
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.fullName || "John Doe")}`,
      },
      auth: { email: user?.email || request.demoUser!.email },
      employment: {
        jobTitle: user?.jobTitle || "Senior Software Engineer",
        department: user?.department || "Engineering",
      },
    };

    const mockMilestones = [
      {
        _id: "ms-30",
        id: "ms-30",
        templateId: "tmpl-ms-30",
        employeeId: empIdObj,
        milestoneTitle: "Day 30 Initial Ramp & Culture Checkpoint",
        milestoneCode: "MS-30-ENG",
        targetDay: 30,
        dueDate: new Date(Date.now() - 5 * 86400000).toISOString(),
        status: "approved",
        goalsProgress: [
          { goalTitle: "Complete all compliance documentation & 1Password setup", completed: true, completedAt: new Date(Date.now() - 25 * 86400000).toISOString() },
          { goalTitle: "Deploy first canary PR to staging environment", completed: true, completedAt: new Date(Date.now() - 15 * 86400000).toISOString() },
          { goalTitle: "Complete 1-on-1 introductory chats with all core squad peers", completed: true, completedAt: new Date(Date.now() - 8 * 86400000).toISOString() },
        ],
        employeeRating: 5,
        comments: "Onboarding materials were crystal clear. Buddy support made environment setup effortless.",
        managerRating: 5,
        managerFeedback: "Exceptional speed to first contribution! Great engagement in squad architecture reviews.",
        evaluatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        employeeSelfCheck: {
          completedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
          confidenceRating: 5,
          employeeRating: 5,
          comments: "Feeling fully autonomous on daily development workflows.",
          responses: [
            { questionId: "cq-1", question: "How supported do you feel by your onboarding buddy and team?", answer: "Very supported, Alice is awesome!" },
            { questionId: "cq-2", question: "What tools or access are you still missing?", answer: "None, all SSO permissions granted on Day 1." },
          ],
        },
        managerReview: {
          reviewedBy: "Sarah Connor (Director of Engineering)",
          reviewedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
          approvalStatus: "approved",
          performanceRating: 5,
          feedback: "Great start, look forward to Month 2 project ownership!",
        },
        sla: {
          reviewDeadline: new Date(Date.now() - 4 * 86400000).toISOString(),
          reminderSentCount: 0,
          escalationState: "normal",
        },
      },
      {
        _id: "ms-60",
        id: "ms-60",
        templateId: "tmpl-ms-60",
        employeeId: empIdObj,
        milestoneTitle: "Day 60 Autonomy & Cross-Functional Partnership Checkpoint",
        milestoneCode: "MS-60-ENG",
        targetDay: 60,
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
        status: "in_review",
        goalsProgress: [
          { goalTitle: "Lead technical design RFC for upcoming customer feature", completed: true, completedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
          { goalTitle: "Shadow primary on-call engineer for one full sprint shift", completed: true, completedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
          { goalTitle: "Participate in customer feedback interview with Product Manager", completed: false },
        ],
        employeeRating: 4,
        comments: "Design RFC approved and scheduled for execution next sprint.",
        employeeSelfCheck: {
          completedAt: new Date().toISOString(),
          confidenceRating: 4,
          employeeRating: 4,
          comments: "Making strong progress on independent feature ownership.",
          responses: [
            { questionId: "cq-3", question: "Rate your confidence in navigating internal systems:", answer: "4/5 - high confidence in services and deployment pipelines." },
          ],
        },
        managerReview: {
          approvalStatus: "pending",
        },
        sla: {
          reviewDeadline: new Date(Date.now() + 7 * 86400000).toISOString(),
          reminderSentCount: 1,
          escalationState: "normal",
        },
      },
      {
        _id: "ms-90",
        id: "ms-90",
        templateId: "tmpl-ms-90",
        employeeId: empIdObj,
        milestoneTitle: "Day 90 Full Productivity & Onboarding Graduation",
        milestoneCode: "MS-90-ENG",
        targetDay: 90,
        dueDate: new Date(Date.now() + 35 * 86400000).toISOString(),
        status: "pending",
        goalsProgress: [
          { goalTitle: "Full autonomous sprint cycle execution & code ownership", completed: false },
          { goalTitle: "Formal onboarding retrospective and buddy program feedback", completed: false },
        ],
        sla: {
          reviewDeadline: new Date(Date.now() + 38 * 86400000).toISOString(),
          reminderSentCount: 0,
          escalationState: "normal",
        },
      },
    ];

    return reply.status(200).send({ success: true, data: mockMilestones });
  };

  getTeamMilestones = async (request: FastifyRequest, reply: FastifyReply) => {
    return this.getMyMilestones(request, reply);
  };

  getMilestoneTemplates = async (_request: FastifyRequest, reply: FastifyReply) => {
    const templates = [
      {
        _id: "tmpl-ms-30",
        id: "tmpl-ms-30",
        title: "Day 30 Onboarding Checkpoint",
        description: "First month evaluation reviewing tooling setup, compliance sign-offs, and first contribution.",
        targetDay: 30,
        goals: [
          { _id: "g-1", title: "Complete all compliance documentation & 1Password setup" },
          { _id: "g-2", title: "Deploy first canary PR to staging environment" },
          { _id: "g-3", title: "Complete 1-on-1 introductory chats with all core squad peers" },
        ],
        checkinQuestions: [
          { _id: "cq-1", question: "How supported do you feel by your onboarding buddy and team?", type: "rating", required: true },
          { _id: "cq-2", question: "What tools or access are you still missing?", type: "text", required: false },
        ],
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      },
      {
        _id: "tmpl-ms-60",
        id: "tmpl-ms-60",
        title: "Day 60 Growth & Autonomy Checkpoint",
        description: "Two-month review evaluating independent feature development and on-call shadow readiness.",
        targetDay: 60,
        goals: [
          { _id: "g-4", title: "Lead technical design RFC for upcoming customer feature" },
          { _id: "g-5", title: "Shadow primary on-call engineer for one full sprint shift" },
          { _id: "g-6", title: "Participate in customer feedback interview with Product Manager" },
        ],
        checkinQuestions: [
          { _id: "cq-3", question: "Rate your confidence in navigating internal systems:", type: "rating", required: true },
        ],
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      },
      {
        _id: "tmpl-ms-90",
        id: "tmpl-ms-90",
        title: "Day 90 Full Productivity Graduation",
        description: "Formal milestone checkpoint confirming graduation into fully autonomous role ownership.",
        targetDay: 90,
        goals: [
          { _id: "g-7", title: "Full autonomous sprint cycle execution & code ownership" },
          { _id: "g-8", title: "Formal onboarding retrospective and buddy program feedback" },
        ],
        checkinQuestions: [
          { _id: "cq-4", question: "Overall satisfaction with your Talnova onboarding experience:", type: "rating", required: true },
        ],
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      },
    ];

    return reply.status(200).send({ success: true, data: templates });
  };

  createMilestoneTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body as any) || {};
    return reply.status(201).send({
      success: true,
      data: {
        _id: `tmpl-ms-${Date.now()}`,
        id: `tmpl-ms-${Date.now()}`,
        title: body.title || "Custom Milestone Checkpoint",
        description: body.description || "",
        targetDay: body.targetDay || 30,
        goals: body.goals || [],
        checkinQuestions: body.checkinQuestions || [],
        createdAt: new Date().toISOString(),
      },
    });
  };

  updateMilestoneTemplate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      data: { ...body, _id: id, id },
    });
  };

  deleteMilestoneTemplate = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({ success: true, message: "Milestone template removed." });
  };

  assignMilestone = async (request: FastifyRequest, reply: FastifyReply) => {
    const { templateId, employeeId } = (request.body as any) || {};
    return reply.status(201).send({
      success: true,
      message: "Milestone checkpoint successfully assigned.",
      data: {
        _id: `ms-${Date.now()}`,
        templateId,
        employeeId,
        status: "pending",
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
    });
  };

  submitMilestoneSelfEvaluation = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoActivityLog = getDemoActivityLogModel();

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "MILESTONE_SELF_CHECKIN",
      category: "NAVIGATION",
      description: `Submitted self-evaluation for milestone checkpoint ${id}`,
      severity: "info",
    });

    return reply.status(200).send({
      success: true,
      message: "Self check-in submitted successfully.",
      data: {
        _id: id,
        id,
        status: "in_review",
        employeeSelfCheck: {
          completedAt: new Date().toISOString(),
          confidenceRating: body.confidenceRating || 5,
          employeeRating: body.employeeRating || 5,
          comments: body.comments || "",
          responses: body.responses || [],
        },
      },
    });
  };

  submitMilestoneManagerReview = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    const DemoActivityLog = getDemoActivityLogModel();

    await DemoActivityLog.create({
      demoTenantId: request.demoUser!.tenantId,
      demoUserId: request.demoUser!.id,
      action: "MILESTONE_MANAGER_REVIEW",
      category: "NAVIGATION",
      description: `Manager approved milestone review ${id}`,
      severity: "info",
    });

    return reply.status(200).send({
      success: true,
      message: "Manager review approved successfully.",
      data: {
        _id: id,
        id,
        status: "approved",
        managerReview: {
          reviewedBy: request.demoUser!.email,
          reviewedAt: new Date().toISOString(),
          approvalStatus: "approved",
          performanceRating: body.performanceRating || 5,
          feedback: body.feedback || "Approved in demo session",
        },
      },
    });
  };

  requestMilestoneRevision = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    return reply.status(200).send({
      success: true,
      data: { _id: id, status: "revision_requested" },
    });
  };

  escalateMilestone = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    return reply.status(200).send({
      success: true,
      message: "Milestone escalation reminder sent to manager.",
      data: { _id: id, escalated: true },
    });
  };

  updateMilestoneGoals = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      data: { _id: id, goalsProgress: body.goalsProgress || [] },
    });
  };

  updateMilestoneStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const { status } = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      data: { _id: id, status },
    });
  };

  getAIConversations = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: [
        {
          id: "conv-1",
          title: "Benefits & Remote Work Policy",
          updatedAt: new Date(Date.now() - 3600000).toISOString(),
          messagesCount: 2,
        },
        {
          id: "conv-2",
          title: "Engineering Onboarding Setup",
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          messagesCount: 4,
        },
      ],
    });
  };

  getAIConversationById = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: {
        id: "conv-1",
        title: "Benefits & Remote Work Policy",
        messages: [
          {
            id: "m-1",
            role: "user",
            content: "What is our policy for remote equipment stipend?",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: "m-2",
            role: "assistant",
            content:
              "Under Acme Corp's Remote Work Policy, all full-time employees are eligible for a $1,000 home office equipment reimbursement within their first 90 days. You can submit receipts through the Documents portal.",
            createdAt: new Date(Date.now() - 3590000).toISOString(),
            sources: ["Acme Employee Handbook 2026 - Section 4.2"],
          },
        ],
      },
    });
  };

  postAIChat = async (request: FastifyRequest, reply: FastifyReply) => {
    const { message } = (request.body as any) || {};
    return reply.status(200).send({
      success: true,
      data: {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: `[Talnova AI Assistant] Based on Acme Corporation's knowledge base: You asked about "${
          message || "company policies"
        }". In the demo environment, all onboarding journeys, compliance guidelines, and role checklists are automatically synthesized.`,
        sources: ["Talnova Onboarding Playbook (Synthetic)"],
        createdAt: new Date().toISOString(),
      },
    });
  };
}

export const demoAppController = new DemoAppController();
export default demoAppController;
