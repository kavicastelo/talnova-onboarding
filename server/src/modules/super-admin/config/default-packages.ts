import { IPackageFeature } from "../models/package.model.js";

export const CANONICAL_PACKAGE_FEATURES: Omit<IPackageFeature, "enabled">[] = [
  // Learning & Content
  {
    featureKey: "journey_templates",
    name: "Journey Templates",
    module: "learning",
    description: "Pre-built onboarding journeys, roadmaps, and modular learning steps",
    isAddOn: false,
  },
  {
    featureKey: "journey_builder",
    name: "Visual Journey Builder",
    module: "learning",
    description: "Drag-and-drop journey builder with step prerequisites and branching",
    isAddOn: true,
    addOnPriceMonthly: 49,
    addOnPriceAnnual: 490,
  },
  {
    featureKey: "knowledge_base",
    name: "Knowledge Base & SOPs",
    module: "learning",
    description: "Self-service organization wiki, policies, and document library",
    isAddOn: false,
  },
  {
    featureKey: "certificates",
    name: "Certificates & Badges",
    module: "learning",
    description: "Verifiable milestone certificates and achievement credentials",
    isAddOn: true,
    addOnPriceMonthly: 29,
    addOnPriceAnnual: 290,
  },

  // Operations & Field
  {
    featureKey: "kiosk_mode",
    name: "Kiosk Terminals & Offline Edge",
    module: "operations",
    description: "Self-service kiosk mode for hardware terminals, pin check-in & edge sync",
    isAddOn: true,
    addOnPriceMonthly: 59,
    addOnPriceAnnual: 590,
  },
  {
    featureKey: "checklist_tasks",
    name: "Checklist Tasks & Verification",
    module: "operations",
    description: "Role-targeted task checklists with verification and file submissions",
    isAddOn: false,
  },
  {
    featureKey: "it_ops_queue",
    name: "IT Hardware & Asset Queue",
    module: "operations",
    description: "Laptop, peripheral, and badge fulfillment tracking workbench",
    isAddOn: true,
    addOnPriceMonthly: 39,
    addOnPriceAnnual: 390,
  },

  // Compliance & Legal
  {
    featureKey: "digital_signatures",
    name: "Cryptographic E-Signatures",
    module: "compliance",
    description: "Legally binding digital document signing with SHA-256 audit trails",
    isAddOn: true,
    addOnPriceMonthly: 49,
    addOnPriceAnnual: 490,
  },
  {
    featureKey: "hr_exceptions",
    name: "HR Exceptions Workbench",
    module: "compliance",
    description: "Real-time blocked task escalations, SLA tracking, and resolution engine",
    isAddOn: true,
    addOnPriceMonthly: 39,
    addOnPriceAnnual: 390,
  },

  // People & Engagement
  {
    featureKey: "employee_directory",
    name: "Employee Directory & Profiles",
    module: "people",
    description: "Searchable employee directory with department filters and org chart",
    isAddOn: false,
  },
  {
    featureKey: "buddy_connection",
    name: "Onboarding Buddy Program",
    module: "people",
    description: "Intelligent peer buddy matching, mentorship tasks, and check-ins",
    isAddOn: true,
    addOnPriceMonthly: 29,
    addOnPriceAnnual: 290,
  },
  {
    featureKey: "milestone_ratings",
    name: "30/60/90 Day Milestones",
    module: "people",
    description: "Goal tracking, milestone ratings, and manager 1-on-1 performance reviews",
    isAddOn: false,
  },
  {
    featureKey: "calendar_integration",
    name: "Calendar & Meeting Sync",
    module: "people",
    description: "Google Calendar & Outlook sync for introductory sessions and check-ins",
    isAddOn: true,
    addOnPriceMonthly: 29,
    addOnPriceAnnual: 290,
  },
  {
    featureKey: "office_map",
    name: "Interactive Office Floorplan",
    module: "people",
    description: "Interactive desk finder, amenities map, and office location floorplans",
    isAddOn: true,
    addOnPriceMonthly: 39,
    addOnPriceAnnual: 390,
  },
  {
    featureKey: "gamified_milestones",
    name: "Leaderboard & Gamification",
    module: "people",
    description: "Experience points, badges, and company onboarding leaderboard",
    isAddOn: false,
  },

  // Intelligence & Automation
  {
    featureKey: "tenant_analytics",
    name: "Tenant Analytics & Velocity",
    module: "intelligence",
    description: "Onboarding velocity metrics, task completion rates, and SLA charts",
    isAddOn: true,
    addOnPriceMonthly: 69,
    addOnPriceAnnual: 690,
  },
  {
    featureKey: "workflow_rules",
    name: "Automated Workflow Engine",
    module: "intelligence",
    description: "Rule-based triggers, dynamic assignment, and automated task dispatching",
    isAddOn: true,
    addOnPriceMonthly: 59,
    addOnPriceAnnual: 590,
  },
  {
    featureKey: "ai_assistant",
    name: "AI Onboarding Assistant",
    module: "intelligence",
    description: "Context-aware conversational RAG assistant answering company questions",
    isAddOn: true,
    addOnPriceMonthly: 79,
    addOnPriceAnnual: 790,
  },
  {
    featureKey: "ai_course_builder",
    name: "AI Generative Course Builder",
    module: "intelligence",
    description: "Automated curriculum and journey generator using enterprise LLM prompts",
    isAddOn: true,
    addOnPriceMonthly: 99,
    addOnPriceAnnual: 990,
  },

  // Enterprise & Access
  {
    featureKey: "sso_enforcement",
    name: "Enterprise SAML / OIDC SSO",
    module: "enterprise",
    description: "Okta, Azure AD, Google Workspace Single Sign-On enforcement",
    isAddOn: true,
    addOnPriceMonthly: 99,
    addOnPriceAnnual: 990,
  },
  {
    featureKey: "advanced_hris_sync",
    name: "HRIS Bi-Directional Sync",
    module: "enterprise",
    description: "Automated employee sync via Workday, BambooHR, Rippling & Hibob",
    isAddOn: true,
    addOnPriceMonthly: 129,
    addOnPriceAnnual: 1290,
  },
  {
    featureKey: "scim_provisioning",
    name: "SCIM 2.0 Directory Sync",
    module: "enterprise",
    description: "Automated identity provisioning and deprovisioning via SCIM 2.0",
    isAddOn: true,
    addOnPriceMonthly: 89,
    addOnPriceAnnual: 890,
  },
];

export interface IDefaultPackageSeed {
  name: string;
  slug: string;
  description: string;
  badge?: string;
  tier: "free" | "standard" | "custom" | "enterprise";
  isPublic: boolean;
  isDefault: boolean;
  billing: {
    basePriceMonthly: number;
    basePriceAnnual: number;
    currency: string;
  };
  limits: {
    maxUsers: number;
    maxStorageGb: number;
    maxJourneys: number;
    maxKiosks: number;
    aiTokenMonthlyLimit: number;
  };
  enabledFeatureKeys: string[];
}

export const DEFAULT_PACKAGES: IDefaultPackageSeed[] = [
  // 1. Freemium / Community (Default for open self-registration)
  {
    name: "Freemium Community",
    slug: "freemium",
    description: "Ideal for small teams, startups, and evaluation. Core checklist and learning journeys included.",
    badge: "Free Forever",
    tier: "free",
    isPublic: true,
    isDefault: true,
    billing: {
      basePriceMonthly: 0,
      basePriceAnnual: 0,
      currency: "USD",
    },
    limits: {
      maxUsers: 10,
      maxStorageGb: 2,
      maxJourneys: 3,
      maxKiosks: 0,
      aiTokenMonthlyLimit: 50000,
    },
    enabledFeatureKeys: [
      "journey_templates",
      "knowledge_base",
      "checklist_tasks",
      "employee_directory",
      "milestone_ratings",
      "gamified_milestones",
    ],
  },

  // 2. Kiosk Terminal Suite (Specialized modular package)
  {
    name: "Kiosk Terminal Suite",
    slug: "kiosk-suite",
    description: "Designed for warehousing, manufacturing, field ops, and retail branches needing dedicated kiosk stations.",
    badge: "Field Ops",
    tier: "standard",
    isPublic: true,
    isDefault: false,
    billing: {
      basePriceMonthly: 79,
      basePriceAnnual: 790,
      currency: "USD",
    },
    limits: {
      maxUsers: 50,
      maxStorageGb: 10,
      maxJourneys: 5,
      maxKiosks: 15,
      aiTokenMonthlyLimit: 100000,
    },
    enabledFeatureKeys: [
      "kiosk_mode",
      "checklist_tasks",
      "employee_directory",
      "office_map",
      "knowledge_base",
      "milestone_ratings",
    ],
  },

  // 3. LMS & Compliance Suite (Specialized modular package)
  {
    name: "LMS & Compliance Suite",
    slug: "lms-compliance",
    description: "Optimized for corporate training, legal onboarding, and strict cryptographic compliance document signing.",
    badge: "Compliance",
    tier: "standard",
    isPublic: true,
    isDefault: false,
    billing: {
      basePriceMonthly: 149,
      basePriceAnnual: 1490,
      currency: "USD",
    },
    limits: {
      maxUsers: 100,
      maxStorageGb: 25,
      maxJourneys: 25,
      maxKiosks: 0,
      aiTokenMonthlyLimit: 250000,
    },
    enabledFeatureKeys: [
      "journey_templates",
      "journey_builder",
      "digital_signatures",
      "certificates",
      "knowledge_base",
      "checklist_tasks",
      "hr_exceptions",
      "employee_directory",
      "milestone_ratings",
    ],
  },

  // 4. Growth Suite (Comprehensive for scaling mid-market companies)
  {
    name: "Growth Suite",
    slug: "growth-suite",
    description: "The complete platform for scaling teams: journey builder, task workflows, IT asset logistics, and analytics.",
    badge: "Most Popular",
    tier: "standard",
    isPublic: true,
    isDefault: false,
    billing: {
      basePriceMonthly: 249,
      basePriceAnnual: 2490,
      currency: "USD",
    },
    limits: {
      maxUsers: 250,
      maxStorageGb: 50,
      maxJourneys: 50,
      maxKiosks: 5,
      aiTokenMonthlyLimit: 1000000,
    },
    enabledFeatureKeys: [
      "journey_templates",
      "journey_builder",
      "knowledge_base",
      "certificates",
      "checklist_tasks",
      "it_ops_queue",
      "digital_signatures",
      "hr_exceptions",
      "employee_directory",
      "buddy_connection",
      "milestone_ratings",
      "calendar_integration",
      "office_map",
      "gamified_milestones",
      "tenant_analytics",
      "workflow_rules",
    ],
  },

  // 5. All-in-One Enterprise (Full capability suite)
  {
    name: "All-in-One Enterprise",
    slug: "enterprise",
    description: "Unrestricted enterprise powerhouse: includes all 20+ modules, Generative AI, SSO, SCIM, and HRIS integrations.",
    badge: "Full Suite",
    tier: "enterprise",
    isPublic: true,
    isDefault: false,
    billing: {
      basePriceMonthly: 499,
      basePriceAnnual: 4990,
      currency: "USD",
    },
    limits: {
      maxUsers: 1000,
      maxStorageGb: 200,
      maxJourneys: 100,
      maxKiosks: 50,
      aiTokenMonthlyLimit: 5000000,
    },
    enabledFeatureKeys: [
      "journey_templates",
      "journey_builder",
      "knowledge_base",
      "certificates",
      "kiosk_mode",
      "checklist_tasks",
      "it_ops_queue",
      "digital_signatures",
      "hr_exceptions",
      "employee_directory",
      "buddy_connection",
      "milestone_ratings",
      "calendar_integration",
      "office_map",
      "gamified_milestones",
      "tenant_analytics",
      "workflow_rules",
      "ai_assistant",
      "ai_course_builder",
      "sso_enforcement",
      "advanced_hris_sync",
      "scim_provisioning",
    ],
  },
];
