export interface PlatformFeatureMeta {
  key: string;
  name: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
  environment?: 'all' | 'production' | 'staging' | 'development';
}

export const PLATFORM_FEATURES: PlatformFeatureMeta[] = [
  // ===========================================================================
  // 1. Identity, Authentication & Tenant Access (9 Capabilities)
  // ===========================================================================
  {
    key: 'auth_credentials',
    name: 'Password-Based Authentication',
    description: 'Native username and password authentication with bcrypt password hashing',
    category: 'Identity & Access',
    defaultEnabled: true,
  },
  {
    key: 'auth_session_revocation',
    name: 'Secure Session Termination',
    description: 'Immediate revocation of active JWT sessions and quarantine boundary enforcement',
    category: 'Identity & Access',
    defaultEnabled: true,
  },
  {
    key: 'auth_self_registration',
    name: 'Invitation & Self-Registration',
    description: 'Candidate onboarding self-registration and invitation token intake',
    category: 'Identity & Access',
    defaultEnabled: true,
  },
  {
    key: 'auth_password_reset',
    name: 'Password Recovery & Reset',
    description: 'Self-service password recovery workflows with time-limited tokens',
    category: 'Identity & Access',
    defaultEnabled: true,
  },
  {
    key: 'sso_enforcement',
    name: 'Enterprise SAML 2.0 / OIDC SSO',
    description: 'Single Sign-On enforcement via corporate identity providers',
    category: 'Identity & Access',
    defaultEnabled: false,
  },
  {
    key: 'auth_token_refresh',
    name: 'JWT Token Auto-Renewal',
    description: 'Seamless rotating refresh tokens for continuous active user sessions',
    category: 'Identity & Access',
    defaultEnabled: true,
  },
  {
    key: 'rbac_route_protection',
    name: 'Role Capability Guards',
    description: 'Fine-grained role and capability boundaries on client and API routes',
    category: 'Identity & Access',
    defaultEnabled: true,
  },
  {
    key: 'multi_org_switch',
    name: 'Multi-Tenant Workspace Switcher',
    description: 'Allows enterprise users to switch across multi-tenant workspaces',
    category: 'Identity & Access',
    defaultEnabled: true,
  },
  {
    key: 'scim_provisioning',
    name: 'SCIM 2.0 Automated User Sync',
    description: 'Sync Okta, Azure AD, and Google Workspace identities via SCIM 2.0',
    category: 'Identity & Access',
    defaultEnabled: false,
  },

  // ===========================================================================
  // 2. Candidate Onboarding Experience (10 Capabilities)
  // ===========================================================================
  {
    key: 'onboarding_roadmap',
    name: 'Interactive Candidate Roadmap',
    description: 'Visual multi-stage journey timeline and progress roadmap for candidates',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'digital_signatures',
    name: 'Compliance Document E-Signatures',
    description: 'Legally binding electronic signature collection on compliance PDFs',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'checklist_tasks',
    name: 'Candidate Task Checklist',
    description: 'Interactive pre-boarding and first-week task completion checklists',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'lms_course_player',
    name: 'LMS Interactive Course Viewer',
    description: 'In-app rich multimedia training content and SCORM learning player',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'lms_assessments',
    name: 'Course Quizzes & Knowledge Checks',
    description: 'Interactive knowledge verification quizzes and comprehension assessments',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'milestone_ratings',
    name: '30-60-90 Self-Rating Intake',
    description: 'Structured 30, 60, and 90-day sentiment and milestone self-evaluations',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'buddy_connection',
    name: 'Onboarding Buddy Chat & Info',
    description: 'Dedicated mentor pairing with direct chat and scheduled touchpoints',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'graduation_handover',
    name: 'Handover & Graduation Certificate',
    description: 'Automated transition from candidate status to active team member',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'pwa_offline_sync',
    name: 'Mobile PWA Offline Learning',
    description: 'Progressive Web App support with IndexedDB offline sync capabilities',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },
  {
    key: 'onboarding_copilot',
    name: 'Onboarding AI Copilot',
    description: 'Autonomous virtual assistant guiding candidates through onboarding steps',
    category: 'Candidate Experience',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 3. HR Administration & Journey Blueprinting (18 Capabilities)
  // ===========================================================================
  {
    key: 'journey_templates',
    name: 'Journey Template Authoring',
    description: 'Create and maintain reusable multi-stage onboarding journey blueprints',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'journey_builder',
    name: 'Visual Drag-and-Drop Builder',
    description: 'Visual drag-and-drop workflow canvas for assembling custom journeys',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'step_prerequisites',
    name: 'Dynamic Step Prerequisite Gating',
    description: 'Sequential step gating based on predecessor task completion',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'employee_directory',
    name: 'Employee Directory & Management',
    description: 'Centralized staff roster with role assignment and status filtering',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'employee_invite',
    name: 'Candidate Invitation Dispatch',
    description: 'Direct email invitation dispatch with secure onboarding token links',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'bulk_csv_import',
    name: 'Enterprise Bulk CSV Import',
    description: 'High-throughput CSV candidate import with schema validation',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'workflow_rules',
    name: 'Workflow Automation Rules Engine',
    description: 'Rule-based automation triggers for candidate lifecycle transitions',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'workflow_actions',
    name: 'Trigger-Condition-Action Builder',
    description: 'Custom event-driven action builder for webhook and notification dispatch',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'hr_ops_dashboard',
    name: 'HR Operations Velocity Dashboard',
    description: 'Executive cockpit monitoring onboarding throughput and completion SLAs',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'hr_exceptions',
    name: 'Exceptions Workbench & SLA Triage',
    description: 'Operational workbench for triaging stalled tasks and escalation queues',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'doc_templates',
    name: 'Document Template Designer',
    description: 'PDF and HTML template creation with dynamic token interpolation',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'doc_field_markers',
    name: 'PDF Field Positioning (Canvas)',
    description: 'Visual coordinate mapping for signature, date, and initials fields',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'task_templates',
    name: 'Standalone Task Template Builder',
    description: 'Reusable role-specific task catalogs and assignment bundles',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'task_due_offsets',
    name: 'Relative Due-Date Offset Rules',
    description: 'Dynamic due-date scheduling calculated relative to hire start date',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'ai_course_builder',
    name: 'AI Course Builder',
    description: 'Generates structured onboarding courses using LLM intelligence',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'org_branding',
    name: 'Org Branding, Logos & Themes',
    description: 'Custom organization logos, brand color palettes, and welcome theming',
    category: 'HR Administration',
    defaultEnabled: true,
  },
  {
    key: 'advanced_hris_sync',
    name: 'HRIS Integrations Marketplace',
    description: 'Bi-directional employee record synchronization with Workday, BambooHR, and Rippling',
    category: 'HR Administration',
    defaultEnabled: false,
  },
  {
    key: 'tenant_analytics',
    name: 'Executive Drop-Off Analytics',
    description: 'Funnel analysis identifying candidate drop-off and friction stages',
    category: 'HR Administration',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 4. Team Supervision & Manager Operations (7 Capabilities)
  // ===========================================================================
  {
    key: 'manager_dashboard',
    name: 'Manager Team Operations View',
    description: 'Manager cockpit for monitoring direct report onboarding journeys',
    category: 'Manager Operations',
    defaultEnabled: true,
  },
  {
    key: 'direct_report_view',
    name: 'Direct Report Progress Dossier',
    description: 'Granular dossier view of individual candidate task completion and feedback',
    category: 'Manager Operations',
    defaultEnabled: true,
  },
  {
    key: 'milestone_approval',
    name: '30-60-90 Milestone Approvals',
    description: 'Manager evaluation and sign-off portal for probation milestones',
    category: 'Manager Operations',
    defaultEnabled: true,
  },
  {
    key: 'task_verification',
    name: 'Task Evidence & File Verification',
    description: 'Manager approval workflow for candidate submitted documents and files',
    category: 'Manager Operations',
    defaultEnabled: true,
  },
  {
    key: 'checkin_scheduler',
    name: '1-on-1 Check-In Meeting Scheduler',
    description: 'Integrated calendar scheduling for weekly 1-on-1 manager syncs',
    category: 'Manager Operations',
    defaultEnabled: true,
  },
  {
    key: 'buddy_assignment',
    name: 'Direct Hire Buddy Pairing',
    description: 'Manager interface for pairing new hires with experienced team mentors',
    category: 'Manager Operations',
    defaultEnabled: true,
  },
  {
    key: 'team_velocity',
    name: 'Team Velocity & SLA Alerting',
    description: 'Real-time alerts for impending milestone deadlines and overdue items',
    category: 'Manager Operations',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 5. Mentorship & Buddy Program (4 Capabilities)
  // ===========================================================================
  {
    key: 'buddy_profile',
    name: 'Buddy Profile & Capacity Setup',
    description: 'Mentor profile declaration including skills, interests, and mentee capacity',
    category: 'Mentorship & Buddy',
    defaultEnabled: true,
  },
  {
    key: 'mentee_tracking',
    name: 'Mentee Progress Oversight',
    description: 'Dedicated view for buddies to track mentee roadmap and milestone progress',
    category: 'Mentorship & Buddy',
    defaultEnabled: true,
  },
  {
    key: 'buddy_feedback',
    name: 'Check-in Sentiment & Notes Log',
    description: 'Structured check-in notes and sentiment capture between buddy and mentee',
    category: 'Mentorship & Buddy',
    defaultEnabled: true,
  },
  {
    key: 'smart_buddy_match',
    name: 'Algorithmic Buddy Matching',
    description: 'Machine learning matching based on department, interests, and timezone',
    category: 'Mentorship & Buddy',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 6. Frontline & Touch Kiosk Systems (5 Capabilities)
  // ===========================================================================
  {
    key: 'kiosk_pairing',
    name: '6-Digit Kiosk Device Pairing',
    description: 'Secure 6-digit one-time code pairing for hardware tablet registration',
    category: 'Kiosk & Frontline',
    defaultEnabled: true,
  },
  {
    key: 'kiosk_mode',
    name: 'Touchscreen Kiosk Player Mode',
    description: 'Dedicated fullscreen locked-down terminal interface for factory floor onboarding',
    category: 'Kiosk & Frontline',
    defaultEnabled: true,
  },
  {
    key: 'kiosk_audio_sop',
    name: 'High-Contrast Audio SOP Playback',
    description: 'Audio narration and high-contrast visuals for frontline workplace safety',
    category: 'Kiosk & Frontline',
    defaultEnabled: true,
  },
  {
    key: 'kiosk_safety_check',
    name: 'Touch PPE Safety Checklists',
    description: 'Touchscreen verification of mandatory safety gear and facility compliance',
    category: 'Kiosk & Frontline',
    defaultEnabled: true,
  },
  {
    key: 'kiosk_telemetry',
    name: 'Device Heartbeat & Offline Cache',
    description: 'Local SQLite caching and background telemetry heartbeats for kiosk devices',
    category: 'Kiosk & Frontline',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 7. IT Administration & Hardware Provisioning (4 Capabilities)
  // ===========================================================================
  {
    key: 'it_ops_queue',
    name: 'IT Hardware Provisioning Queue',
    description: 'IT dispatch queue for staging laptops, peripherals, and security tokens',
    category: 'IT Administration',
    defaultEnabled: true,
  },
  {
    key: 'it_asset_tracking',
    name: 'Asset Serial & Model Tagging',
    description: 'Serial number, asset tag, and MDM profile assignment to new hires',
    category: 'IT Administration',
    defaultEnabled: true,
  },
  {
    key: 'it_shipping_flow',
    name: 'Hardware Shipping & Delivery Flow',
    description: 'Carrier tracking number capture and delivery confirmation workflow',
    category: 'IT Administration',
    defaultEnabled: true,
  },
  {
    key: 'it_access_setup',
    name: 'Software Accounts Provisioning',
    description: 'Checklist tracking for email, VPN, SaaS licenses, and security access',
    category: 'IT Administration',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 8. Engagement, Gamification & Recognition (5 Capabilities)
  // ===========================================================================
  {
    key: 'gamified_milestones',
    name: 'Learner Gamification Points Engine',
    description: 'Award milestone achievements and learner leaderboard',
    category: 'Engagement & Gamification',
    defaultEnabled: true,
  },
  {
    key: 'gamification_badges',
    name: 'Achievement Badges & Awards',
    description: 'Digital unlockable badges for fast completion and perfect quiz scores',
    category: 'Engagement & Gamification',
    defaultEnabled: true,
  },
  {
    key: 'learner_streaks',
    name: 'Daily Learning Streak Engine',
    description: 'Motivational consecutive day login tracking with streak freeze protections',
    category: 'Engagement & Gamification',
    defaultEnabled: true,
  },
  {
    key: 'leaderboard_view',
    name: 'Organization Leaderboard Page',
    description: 'Tenant-wide friendly competition showing top onboarding points earners',
    category: 'Engagement & Gamification',
    defaultEnabled: true,
  },
  {
    key: 'level_progression',
    name: 'Experience Level Progression',
    description: 'Tiered level unlocks reflecting cumulative knowledge and completed tasks',
    category: 'Engagement & Gamification',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 9. Workplace Wayfinding, Maps & Scheduling (6 Capabilities)
  // ===========================================================================
  {
    key: 'office_map',
    name: 'Interactive Floorplan Map Viewer',
    description: 'Interactive SVG architectural floorplans showing facilities and layouts',
    category: 'Workplace & Maps',
    defaultEnabled: true,
  },
  {
    key: 'desk_pins',
    name: 'Desk & Amenity Visual Pins',
    description: 'Interactive markers designating assigned desks, restrooms, and emergency exits',
    category: 'Workplace & Maps',
    defaultEnabled: true,
  },
  {
    key: 'map_wayfinding',
    name: 'Visual Wayfinding & Pathfinding',
    description: 'Visual step-by-step route navigation from reception to assigned workspace',
    category: 'Workplace & Maps',
    defaultEnabled: true,
  },
  {
    key: 'calendar_integration',
    name: 'Google / Outlook Calendar Sync',
    description: 'Bi-directional synchronization with Google Calendar and Microsoft Outlook',
    category: 'Workplace & Maps',
    defaultEnabled: true,
  },
  {
    key: 'meeting_automation',
    name: 'Auto-Scheduled Orientation Meets',
    description: 'Automated calendar invitation dispatch for cohorts and manager meets',
    category: 'Workplace & Maps',
    defaultEnabled: true,
  },
  {
    key: 'ical_feed',
    name: 'Personal iCal Calendar Feed URL',
    description: 'Token-protected webcal feed for external calendar client subscriptions',
    category: 'Workplace & Maps',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 10. Knowledge Base & AI Intelligence (5 Capabilities)
  // ===========================================================================
  {
    key: 'knowledge_base',
    name: 'Categorized Knowledge Base',
    description: 'Searchable repository of company handbooks, benefit guides, and policies',
    category: 'Knowledge Base & AI',
    defaultEnabled: true,
  },
  {
    key: 'kb_slideshow',
    name: 'Fullscreen Presentation Slideshow',
    description: 'Interactive slide deck presentation view for orientation documentation',
    category: 'Knowledge Base & AI',
    defaultEnabled: true,
  },
  {
    key: 'ai_assistant',
    name: 'Interactive AI Q&A Assistant',
    description: 'Conversational AI agent answering questions regarding internal handbooks',
    category: 'Knowledge Base & AI',
    defaultEnabled: true,
  },
  {
    key: 'rag_policy_search',
    name: 'RAG Vector Search over Handbooks',
    description: 'Retrieval-augmented generation leveraging semantic search across docs',
    category: 'Knowledge Base & AI',
    defaultEnabled: true,
  },
  {
    key: 'ai_response_feedback',
    name: 'AI Rating & Answer Feedback',
    description: 'Thumbs up/down feedback logging to refine assistant response quality',
    category: 'Knowledge Base & AI',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 11. Public Compliance & Cryptographic Verification (4 Capabilities)
  // ===========================================================================
  {
    key: 'certificates',
    name: 'Digital Completion Certificates',
    description: 'Cryptographically verifiable graduation certificates upon journey completion',
    category: 'Compliance & Verification',
    defaultEnabled: true,
  },
  {
    key: 'public_qr_verify',
    name: 'Public QR Code Certificate Page',
    description: 'Publicly accessible credential verification portal reached via QR scan',
    category: 'Compliance & Verification',
    defaultEnabled: true,
  },
  {
    key: 'sha256_audit_seal',
    name: 'SHA-256 Tamper-Evident Signatures',
    description: 'Cryptographic digest seals ensuring certificates cannot be forged',
    category: 'Compliance & Verification',
    defaultEnabled: true,
  },
  {
    key: 'cert_pdf_download',
    name: 'Client PDF Certificate Render',
    description: 'High-resolution PDF rendering suitable for candidate printing or framing',
    category: 'Compliance & Verification',
    defaultEnabled: true,
  },

  // ===========================================================================
  // 12. Super Admin Enterprise Control Plane (18 Capabilities)
  // ===========================================================================
  {
    key: 'super_admin_core',
    name: 'Super Admin Command Center Hub',
    description: 'Centralized multi-tenant administration portal with global stats',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'tenant_oversight',
    name: 'Organization 360 Dossier & Health',
    description: 'Comprehensive tenant metadata, contract terms, and member statistics',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'tenant_lifecycle',
    name: 'Tenant Quarantine & Suspension',
    description: 'Immediate tenant isolation, maintenance mode, and status controls',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'user_360',
    name: 'User 360 & Impersonation',
    description: 'Deep diagnostic user profile inspection and secure support impersonation',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'session_tracker',
    name: 'Active JWT Session Management',
    description: 'Global real-time tracking of active user sessions across all organizations',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'session_kill',
    name: 'Force User Logout & Kill Session',
    description: 'Instant cryptographic invalidation of compromised user sessions',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'b2b_invoicing',
    name: 'Itemized Invoice Engine',
    description: 'Enterprise B2B invoicing with recurring subscriptions and line-item taxes',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'payment_receipts',
    name: 'Partial Payment Reconciliation',
    description: 'Audit-grade payment reconciliation supporting multiple partial payments',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'operating_expenses',
    name: 'Authoritative Expense Tracking',
    description: 'Internal infrastructure and operational cost accounting engine',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'customer_accounts',
    name: 'Commercial Tiers & Credit Holds',
    description: 'Commercial account terms, prepaid balances, and automated credit locks',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'api_ring_buffer',
    name: 'Fastify Live Latency Telemetry',
    description: 'In-memory circular telemetry buffer tracking endpoint latency & errors',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'ai_token_tracker',
    name: 'AI Token & Cost Telemetry Buffer',
    description: 'Token consumption and dollar expenditure tracking per tenant LLM request',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'alert_triage',
    name: 'Incident Alert Lifecycle Engine',
    description: 'Real-time system incident alerts with severity triage and resolution logs',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'advanced_reporting',
    name: '15 Streaming Canonical Reports',
    description: 'Real-time streaming and export of compliance and audit reports',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'maintenance_guard',
    name: 'Global Maintenance Mode Hook',
    description: 'Platform-wide emergency traffic interruption for scheduled maintenance',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'feature_governance',
    name: 'Feature Flag Overrides Center',
    description: 'Granular organization and role overrides for all platform capabilities',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'feature_adoption',
    name: 'Feature Adoption Telemetry View',
    description: 'Analytics tracking tenant feature engagement and active usage percentages',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'cross_tenant_search',
    name: 'Global Cross-Tenant Omnisearch',
    description: 'Instant omnibar search finding tenants, users, and invoices globally',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'audit_log_viewer',
    name: 'Platform Security Audit Trail',
    description: 'Immutable, tamper-evident security audit log viewer with actor tracking',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'organization_export',
    name: 'Tenant Data Portability & Archive',
    description: 'Full JSON/CSV export of tenant organizational data for portability',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'security_policy_enforcement',
    name: 'MFA & Session Timeout Guard',
    description: 'Enterprise password complexity, MFA enforcement, and idle session limits',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'infra_telemetry',
    name: 'Node & Database Health Observability',
    description: 'Real-time Node.js event loop, memory, and MongoDB connection metrics',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'storage_telemetry',
    name: 'S3 / Local Media Asset Metrics',
    description: 'Storage utilization tracking across documents, videos, and avatars',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'revenue_recognition',
    name: 'Deterministic MRR & ARR Accounting',
    description: 'Accrual and recognized SaaS revenue calculations over contract terms',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'cash_reconciliation',
    name: 'Authoritative Cash Collection Math',
    description: 'Reconciliation of bank receipts against issued tenant invoices',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'tenant_credit_limits',
    name: 'Enterprise Credit Hold Governance',
    description: 'Credit limit enforcement freezing non-critical actions on overdue accounts',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'task_sla_monitoring',
    name: 'Cross-Tenant SLA Bottleneck Heatmap',
    description: 'Platform-wide bottleneck detection on task and milestone completions',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
  {
    key: 'onboarding_funnels',
    name: 'Cross-Tenant Onboarding Progression',
    description: 'Cohort analytics visualizing velocity from invitation to graduation',
    category: 'Super Admin & Governance',
    defaultEnabled: true,
  },
];

const FEATURE_MAP = new Map<string, PlatformFeatureMeta>(
  PLATFORM_FEATURES.map((item) => [item.key.toLowerCase(), item])
);

export function getFeatureMetadata(key: string): PlatformFeatureMeta {
  const normalized = (key || '').toLowerCase().trim();
  const existing = FEATURE_MAP.get(normalized);
  if (existing) return existing;

  const humanized = key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    key,
    name: humanized,
    description: `Platform capability: ${humanized}`,
    category: 'Core Platform',
    defaultEnabled: true,
  };
}

export function getFeatureName(key: string): string {
  return getFeatureMetadata(key).name;
}

export function getFeatureCategory(key: string): string {
  return getFeatureMetadata(key).category;
}
