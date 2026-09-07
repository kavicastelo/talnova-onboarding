# Talnova Onboarding - AI Architecture Context Document

This document is optimized for consumption by LLM agents. It contains the complete technical specifications, schemas, interfaces, routes, and development rules for the Talnova Onboarding backend.

---

## 1. Core Stack

* **Runtime:** Node.js 22 LTS
* **Language:** TypeScript (Strict Mode)
* **Framework:** Fastify
* **Package Manager:** npm (ES Modules)
* **API Style:** REST (JSON payload / responses)
* **Database:** MongoDB Atlas
* **ODM:** Mongoose
* **Validation:** Zod
* **Logger:** Pino
* **Authentication:** JWT + Refresh Tokens (Argon2id for password hashing)
* **Storage:** Cloudflare R2
* **Background Jobs:** node-cron (Initial Phase), BullMQ (Future Phase)
* **Process Manager:** PM2
* **Reverse Proxy:** Nginx

---

## 2. Directory Structure

The backend application is isolated inside a dedicated `server/` subdirectory under the repository root.

```text
server/
├── scripts/
├── tests/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
├── ecosystem.config.js
└── src/
    ├── app/                  # Application startup & routes initialization
    ├── bootstrap/            # Server, DB, & plugins bootstrapping
    ├── common/               # Global decorators, errors, responses, and interfaces
    │   ├── errors/
    │   ├── constants/
    │   ├── responses/
    │   ├── exceptions/
    │   ├── decorators/
    │   ├── enums/
    │   └── interfaces/
    ├── config/               # Environment-driven configuration files
    ├── database/             # Connection management, plugins, seeders
    ├── middleware/           # Fastify global hook-based middlewares
    ├── plugins/              # Fastify plugin wrapper registrations
    ├── shared/               # Cross-feature utilities (Storage, Email, Audit)
    │   ├── storage/
    │   ├── email/
    │   └── audit/
    ├── types/                # Global type declarations (API, JWT, Request overrides)
    ├── utils/                # Pure stateless helpers (Slug, Crypto, Date)
    ├── jobs/                 # Cron task executors
    ├── server.ts             # Process startup entrypoint
    ├── app.ts                # Fastify instance builder
    └── modules/              # Feature modules (Feature-First Architecture)
        ├── auth/
        ├── organizations/
        ├── employees/
        ├── journeys/
        ├── assignments/
        ├── knowledge-base/
        ├── uploads/
        ├── notifications/
        └── audit/
```

### Standard Module Substructure

Every module in `server/src/modules/<module-name>/` must follow:

```text
├── controllers/          # Translates HTTP to Service invocations
├── services/             # Primary business rules and orchestration
├── repositories/         # MongoDB collection read/write persistence
├── models/               # Mongoose schema definitions
├── routes/               # Endpoint declarations and middlewares
├── schemas/              # Zod validation schemas
├── dto/                  # Request/Response Data Transfer Objects
├── types/                # Module-specific type aliases
├── constants/            # Module-specific variables
└── index.ts              # Module entry point
```

---

## 3. Dependency Flow & Modularity Rules

* **Inward Flow Only:** `Route -> Controller -> Service -> Repository -> Database`
* **Direct Database Bypass Forbidden:** Controllers must never access models or repositories. Services must never access databases except via repositories.
* **Loose Coupling:** Modules must communicate only through public service interfaces of other modules. Repositories must never be imported across module boundaries.
* **Shared/Common Independence:** Code in `common/`, `shared/`, `config/`, and `database/` must not import anything from `modules/`.

---

## 4. Request Lifecycle

```text
Client Request
  ↓
Fastify Route Hook
  ↓
Global / Route Middlewares (Request ID, Logging)
  ↓
Authentication Middleware (JWT token signature verification)
  ↓
Authorization Middleware (RBAC role / permission check)
  ↓
Request Validation (Zod schema checking for Body, Params, Query, Headers)
  ↓
Controller (Thin handler, maps DTO, invokes Service)
  ↓
Service (Enforces business logic, scopes query by organizationId, calls Repository)
  ↓
Repository (Mongoose CRUD/aggregation querying, excludes isDeleted: true records)
  ↓
Mongoose ODM / MongoDB Atlas
  ↓
Service / Controller (Aggregates or maps return DTO)
  ↓
Fastify Serialization Hook (Standard API Response Envelope)
  ↓
Client Response
```

---

## 5. Security & Multi-Tenancy

### Tenant Isolation

* Every document representing tenant data must contain `organizationId: ObjectId`.
* All queries and database writes must scope by `organizationId` from the authenticated request context.
* Cross-tenant query execution is a critical security vulnerability.

### Authentication Config

* **Access Token:** JWT
  * Lifetime: 15 minutes
  * Storage: Client memory (not LocalStorage)
  * Payload: `{ userId: string, organizationId: string, role: string, sessionId: string, tokenVersion: number }`
* **Refresh Token:** JWT
  * Lifetime: 30 days
  * Storage: HTTP-only, Secure, SameSite=Strict cookie
  * Flow: Mandatory rotating refresh tokens. Token reuse invalidates user session.

### Authorization (RBAC)

* **Roles:** `owner` | `admin` | `manager` | `employee`
* **Permission Format:** `resource:action` (e.g., `journeys:publish`, `employees:create`)
* **Tenant Validation:** Services must check `user.organizationId === resource.organizationId` before permitting reads or updates.

---

## 6. API Standards

### Base URL

```text
/api/v1
```

### JSON Structure

* All request and response bodies must use camelCase keys.

### Standard Success Response Envelope

```typescript
interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}
```

### Paginated Collection Response Envelope

```typescript
interface PaginatedResponse<T> {
  success: true;
  message: string;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Standard Error Response Envelope

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
}
```

### HTTP Status Code Usage

* `200 OK` - Resource retrieved or updated successfully.
* `201 Created` - Resource created successfully.
* `204 No Content` - Delete or empty operation successful.
* `400 Bad Request` - Syntactically invalid request.
* `401 Unauthorized` - Missing, invalid, or expired authentication token.
* `403 Forbidden` - Insufficient roles/permissions or tenant boundary violation.
* `404 Not Found` - Resource does not exist.
* `409 Conflict` - Resource duplicate or state conflict.
* `413 Payload Too Large` - Request payload exceeds configured maximum size.
* `422 Unprocessable Entity` - Validation failed.
* `429 Too Many Requests` - Rate limit exceeded.
* `500 Internal Server Error` - Uncaught system failure (logs detailed trace to Pino, returns generic message to client).

---

## 7. Database Conventions & Collections Schemas

### Mongoose Common Options

* Enforce `timestamps: true` (creates `createdAt` and `updatedAt` as Dates).
* Enforce schema validation rules at the Mongoose level in addition to Zod layers.

### Types Definitions for Schemas

```typescript
type UploadReference = {
  uploadId: ObjectId;
  fileName: string;
  publicUrl?: string;
};
```

---

### Collection: `organizations`

```typescript
interface OrganizationSchema {
  _id: ObjectId;
  name: string;
  slug: string; // Unique index
  description?: string;
  website?: string;
  industry?: string;
  size?: "1-10" | "11-50" | "51-250" | "251-1000" | "1000+";
  supportEmail?: string;
  branding: {
    logo?: UploadReference;
    favicon?: UploadReference;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  workspace: {
    timezone: string; // e.g. "UTC", "America/New_York"
    locale: string; // e.g. "en-US"
    dateFormat: string; // e.g. "YYYY-MM-DD"
    firstDayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  };
  departments: Array<{
    _id: ObjectId;
    name: string;
    description?: string;
    color?: string;
    active: boolean;
  }>;
  teams: Array<{
    _id: ObjectId;
    departmentId?: ObjectId;
    name: string;
    active: boolean;
  }>;
  jobTitles: Array<{
    _id: ObjectId;
    title: string;
    active: boolean;
  }>;
  locations: Array<{
    _id: ObjectId;
    name: string;
    city: string;
    country: string;
    timezone: string;
  }>;
  notificationSettings: {
    assignmentEmail: boolean;
    reminderEmail: boolean;
    weeklyDigest: boolean;
  };
  securitySettings: {
    allowPasswordLogin: boolean;
    enforceMfa: boolean;
    sessionTimeout: number; // in seconds
  };
  analytics: {
    totalEmployees: number;
    activeEmployees: number;
    journeys: number;
    completionRate: number;
  };
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}
```

* **Indexes:**
  * `{ slug: 1 }` (Unique)
  * `{ name: 1 }`
  * `{ isDeleted: 1 }`

---

### Collection: `users` (Represents both User Auth & Employee Profiles)

```typescript
interface UserSchema {
  _id: ObjectId;
  organizationId: ObjectId;
  auth: {
    email: string; // Unique index, lowercase
    passwordHash: string;
    emailVerified: boolean;
    lastLoginAt?: Date;
    passwordChangedAt?: Date;
  };
  profile: {
    firstName: string;
    lastName: string;
    fullName: string;
    avatar?: UploadReference;
    phone?: string;
    location?: string;
    timezone?: string;
  };
  employment: {
    employeeId?: string;
    departmentId?: ObjectId;
    teamId?: ObjectId;
    jobTitleId?: ObjectId;
    managerId?: ObjectId;
    employmentType: "full_time" | "part_time" | "contractor" | "intern";
    hireDate?: Date;
    status: "invited" | "active" | "onboarding" | "inactive";
  };
  permissions: {
    role: "owner" | "admin" | "manager" | "employee";
    customRoles: string[];
  };
  preferences: {
    language: string;
    theme: "light" | "dark" | "system";
    emailNotifications: boolean;
  };
  statistics: {
    assignedJourneys: number;
    completedJourneys: number;
    certificates: number;
    completionRate: number;
  };
  security: {
    mfaEnabled: boolean;
    failedLoginAttempts: number;
    lockedUntil?: Date;
    lastPasswordReset?: Date;
  };
  createdBy?: ObjectId;
  updatedBy?: ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}
```

* **Indexes:**
  * `{ "auth.email": 1 }` (Unique)
  * `{ organizationId: 1 }`
  * `{ "employment.departmentId": 1 }`
  * `{ "employment.teamId": 1 }`
  * `{ "employment.managerId": 1 }`
  * `{ "permissions.role": 1 }`
  * `{ "employment.status": 1 }`
  * **Compound:** `{ organizationId: 1, "auth.email": 1 }`
  * **Compound:** `{ organizationId: 1, "permissions.role": 1 }`

---

### Collection: `journeys`

```typescript
interface Option {
  _id: ObjectId;
  text: string;
  isCorrect: boolean;
}

interface Question {
  _id: ObjectId;
  type: "single_choice" | "multiple_choice" | "true_false";
  question: string;
  options: Option[];
  explanation?: string;
  points: number;
}

interface Quiz {
  _id: ObjectId;
  title: string;
  passingScore: number;
  questions: Question[];
}

interface ContentBlock {
  _id: ObjectId;
  type: "video" | "audio" | "image" | "pdf" | "document" | "text" | "embed" | "checklist";
  title?: string;
  content?: string;
  uploadId?: ObjectId;
  embedUrl?: string;
  order: number;
  settings?: {
    autoplay?: boolean;
    downloadable?: boolean;
    requiredViewPercentage?: number;
  };
}

interface Attachment {
  _id: ObjectId;
  title: string;
  uploadId: ObjectId;
  downloadable: boolean;
}

interface Lesson {
  _id: ObjectId;
  title: string;
  description?: string;
  order: number;
  estimatedDurationMinutes: number;
  contentBlocks: ContentBlock[];
  attachments: Attachment[];
  quiz?: Quiz;
  completionRules: {
    requireContentCompletion: boolean;
    requireQuizCompletion: boolean;
    minimumQuizScore?: number;
  };
}

interface Module {
  _id: ObjectId;
  title: string;
  description?: string;
  order: number;
  estimatedDurationMinutes: number;
  lessons: Lesson[];
}

interface JourneySchema {
  _id: ObjectId;
  organizationId: ObjectId;
  title: string;
  slug: string;
  description: string;
  thumbnail?: UploadReference;
  category?: string;
  tags: string[];
  audience: {
    departments?: ObjectId[];
    teams?: ObjectId[];
    jobTitles?: ObjectId[];
    employmentTypes?: string[];
  };
  modules: Module[];
  certificate: {
    enabled: boolean;
    templateId?: ObjectId;
    passingScore?: number;
  };
  publishing: {
    status: "draft" | "published" | "archived";
    publishedAt?: Date;
    version: number;
  };
  analytics: {
    totalAssignments: number;
    totalCompletions: number;
    completionRate: number;
    averageScore: number;
    averageDurationMinutes: number;
  };
  settings: {
    allowSkipLessons: boolean;
    requireSequentialCompletion: boolean;
    allowRetakes: boolean;
    maxRetakes?: number;
  };
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}
```

* **Indexes:**
  * `{ organizationId: 1 }`
  * `{ slug: 1 }`
  * `{ "publishing.status": 1 }`
  * **Compound:** `{ organizationId: 1, "publishing.status": 1 }`

---

### Collection: `employeeAssignments`

```typescript
interface ContentBlockProgress {
  blockId: ObjectId;
  type: string;
  viewed: boolean;
  viewedPercentage?: number;
  completedAt?: Date;
}

interface Answer {
  questionId: ObjectId;
  selectedOptions: ObjectId[];
  correct: boolean;
  pointsEarned: number;
}

interface QuizAttempt {
  attemptNumber: number;
  startedAt: Date;
  submittedAt?: Date;
  score: number;
  passed: boolean;
  answers: Answer[];
}

interface LessonProgress {
  lessonId: ObjectId;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  completedAt?: Date;
  timeSpentSeconds: number;
  contentBlocks: ContentBlockProgress[];
  quizAttempt?: QuizAttempt;
}

interface ModuleProgress {
  moduleId: ObjectId;
  title: string;
  completed: boolean;
  completedAt?: Date;
  lessons: LessonProgress[];
}

interface EmployeeAssignmentSchema {
  _id: ObjectId;
  organizationId: ObjectId;
  employeeId: ObjectId;
  assignedBy: ObjectId;
  journey: {
    journeyId: ObjectId;
    title: string;
    version: number;
  };
  assignment: {
    assignedAt: Date;
    dueDate?: Date;
    priority: "low" | "normal" | "high" | "critical";
  };
  status: "assigned" | "in_progress" | "completed" | "overdue" | "expired";
  progress: {
    totalModules: number;
    completedModules: number;
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
    totalTimeSpentSeconds: number;
    lastActivityAt?: Date;
  };
  modules: ModuleProgress[];
  certificate?: {
    issued: boolean;
    issuedAt?: Date;
    certificateId?: ObjectId;
  };
  completedAt?: Date;
}
```

* **Indexes:**
  * `{ organizationId: 1 }`
  * `{ employeeId: 1 }`
  * `{ status: 1 }`
  * **Compound:** `{ employeeId: 1, status: 1 }`
  * **Compound:** `{ organizationId: 1, employeeId: 1 }`

---

### Collection: `knowledgeBase`

```typescript
interface KBContentBlock {
  _id: ObjectId;
  type: "text" | "image" | "video" | "audio" | "pdf" | "document" | "embed" | "callout" | "code";
  content?: string;
  uploadId?: ObjectId;
  embedUrl?: string;
  order: number;
}

interface KBAttachment {
  _id: ObjectId;
  title: string;
  uploadId: ObjectId;
  downloadable: boolean;
}

interface KnowledgeBaseSchema {
  _id: ObjectId;
  organizationId: ObjectId;
  title: string;
  slug: string;
  summary?: string;
  content: {
    blocks: KBContentBlock[];
  };
  categoryId?: ObjectId;
  tags: string[];
  visibility: {
    access: "all" | "department" | "team" | "custom";
    departments?: ObjectId[];
    teams?: ObjectId[];
    users?: ObjectId[];
  };
  attachments: KBAttachment[];
  analytics: {
    views: number;
    uniqueViews: number;
    averageReadTimeSeconds: number;
    lastViewedAt?: Date;
  };
  publishing: {
    status: "draft" | "published" | "archived";
    publishedAt?: Date;
    version: number;
  };
  searchKeywords: string[];
  createdBy: ObjectId;
  updatedBy?: ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
}
```

* **Indexes:**
  * `{ organizationId: 1 }`
  * `{ slug: 1 }`
  * `{ categoryId: 1 }`
  * **Compound:** `{ organizationId: 1, slug: 1 }`
  * **Text Index:** `{ title: "text", summary: "text", searchKeywords: "text" }`

---

### Collection: `uploads`

```typescript
interface UploadSchema {
  _id: ObjectId;
  organizationId: ObjectId;
  fileName: string;
  originalFileName: string;
  extension: string;
  mimeType: string;
  fileSizeBytes: number;
  type: "video" | "image" | "audio" | "document" | "other";
  storage: {
    provider: "cloudflare-r2";
    bucket: string;
    objectKey: string;
    publicUrl?: string;
  };
  metadata: {
    width?: number;
    height?: number;
    durationSeconds?: number;
    pages?: number;
  };
  thumbnail?: {
    uploadId: ObjectId;
  };
  ownership: {
    uploadedBy: ObjectId;
    uploadedAt: Date;
  };
  usage: {
    entityType?: "journey" | "knowledge_base" | "user_avatar" | "certificate" | "organization";
    entityId?: ObjectId;
    usageCount: number;
  };
  security: {
    visibility: "public" | "private";
    virusScanned: boolean;
    virusScanStatus: "pending" | "clean" | "infected";
  };
  lifecycle: {
    status: "active" | "archived" | "deleted";
  };
}
```

* **Indexes:**
  * `{ organizationId: 1 }`
  * `{ "ownership.uploadedBy": 1 }`
  * `{ "lifecycle.status": 1 }`
  * **Compound:** `{ organizationId: 1, "lifecycle.status": 1 }`

---

### Collection: `notifications`

```typescript
interface NotificationSchema {
  _id: ObjectId;
  organizationId: ObjectId;
  recipientUserId: ObjectId;
  type:
    | "journey_assigned"
    | "journey_due_soon"
    | "journey_overdue"
    | "journey_completed"
    | "employee_invited"
    | "announcement"
    | "knowledge_update"
    | "manager_alert"
    | "system";
  channel: "in_app" | "email" | "push" | "webhook";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "critical";
  data: {
    journeyId?: ObjectId;
    assignmentId?: ObjectId;
    articleId?: ObjectId;
    actorUserId?: ObjectId;
    deepLink?: string;
  };
  status: "pending" | "queued" | "sent" | "failed" | "cancelled";
  isRead: boolean;
  readAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  expiresAt?: Date; // TTL Indexed
}
```

* **Indexes:**
  * `{ recipientUserId: 1 }`
  * `{ expiresAt: 1 }` (TTL Index: automatically deletes older notifications)
  * **Compound:** `{ recipientUserId: 1, isRead: 1 }`
  * **Compound:** `{ organizationId: 1, createdAt: -1 }`

---

### Collection: `auditLogs`

```typescript
interface AuditLogSchema {
  _id: ObjectId;
  organizationId: ObjectId;
  actorUserId?: ObjectId;
  actorType: "user" | "system" | "api" | "scheduler";
  eventCategory:
    | "authentication"
    | "user"
    | "journey"
    | "assignment"
    | "content"
    | "organization"
    | "security"
    | "system";
  eventType: string;
  resourceType: string;
  resourceId?: ObjectId;
  action:
    | "create"
    | "update"
    | "delete"
    | "assign"
    | "complete"
    | "archive"
    | "restore"
    | "login"
    | "logout";
  description: string;
  metadata: {
    previousValue?: any;
    newValue?: any;
    changes?: Record<string, any>;
  };
  request: {
    ipAddress?: string;
    userAgent?: string;
    method?: string;
    endpoint?: string;
  };
  severity: "info" | "warning" | "critical";
  createdAt: Date; // TTL Index for 7 years retention
}
```

* **Indexes:**
  * `{ organizationId: 1 }`
  * `{ actorUserId: 1 }`
  * `{ resourceId: 1 }`
  * **Compound:** `{ organizationId: 1, createdAt: -1 }`

---

### Collection: `systemSettings`

```typescript
interface SystemSettingsSchema {
  _id: ObjectId;
  organizationId: ObjectId; // Unique index
  onboarding: {
    defaultReminderDays: number[]; // e.g. [3, 7, 14]
    autoAssignMandatoryJourneys: boolean;
    allowSelfEnrollment: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    inAppEnabled: boolean;
    digestEnabled: boolean;
  };
  uploads: {
    maxFileSizeMb: number;
    allowedMimeTypes: string[];
  };
  security: {
    passwordMinLength: number;
    enforceMfa: boolean;
    sessionTimeoutMinutes: number;
  };
  ai: {
    enabled: boolean;
  };
  integrations: {
    slack: Record<string, any>;
    teams: Record<string, any>;
    webhook: Record<string, any>;
  };
}
```

* **Indexes:**
  * `{ organizationId: 1 }` (Unique)

---

## 8. Routing Matrix

### Authentication (`/api/v1/auth`)
* `POST /login` - Public. Authenticate email/password. Set Cookie, return access token.
* `POST /logout` - Protected. Invalidate refresh token, clear cookie.
* `POST /refresh` - Public (Cookie required). Invalidate old, issue new Access + Refresh tokens.
* `POST /forgot-password` - Public. Request reset email.
* `POST /reset-password` - Public. Verify reset token and write new password.
* `POST /invitations/accept` - Public. Complete register from invitation token.

### Organizations (`/api/v1/organizations`)
* `GET /current` - Protected (Admin/Owner). Get details.
* `PATCH /current` - Protected (Owner). Update workspace settings.
* `PATCH /branding` - Protected (Admin/Owner). Update logo/colors.
* `PATCH /security` - Protected (Owner). Update MFA/timeouts.
* `GET /departments` - Protected (Admin/Manager). List.
* `POST /departments` - Protected (Admin). Create.
* `PATCH /departments/:id` - Protected (Admin). Update.
* `DELETE /departments/:id` - Protected (Admin). Soft delete.
* `GET /teams` - Protected (Admin/Manager). List.
* `POST /teams` - Protected (Admin). Create.
* `PATCH /teams/:id` - Protected (Admin). Update.
* `DELETE /teams/:id` - Protected (Admin). Soft delete.

### Employees / Users (`/api/v1/employees` or `/api/v1/users`)
* `GET /me` - Protected (All). Current profile and statistics.
* `PATCH /me` - Protected (All). Update preferences/avatar.
* `GET /` - Protected (Admin/Manager). List employee directory.
* `POST /` - Protected (Admin). Create employee record directly.
* `GET /:id` - Protected (Admin/Manager). Get details.
* `PATCH /:id` - Protected (Admin). Update details or transfer department.
* `DELETE /:id` - Protected (Admin). Soft delete employee.
* `POST /invite` - Protected (Admin). Trigger onboarding invitation.

### Journeys (`/api/v1/journeys`)
* `GET /` - Protected (All). List organization journeys.
* `POST /` - Protected (Admin). Create draft journey.
* `GET /:id` - Protected (All). Get detailed modules/lessons structure.
* `PATCH /:id` - Protected (Admin). Update journey/modules/quizzes builder.
* `DELETE /:id` - Protected (Admin). Soft delete journey.
* `POST /:id/publish` - Protected (Admin). Increment version and publish.
* `POST /:id/archive` - Protected (Admin). Archive journey.
* `POST /:id/duplicate` - Protected (Admin). Clone journey structure to draft.
* `GET /:id/analytics` - Protected (Admin/Manager). Get snapshot completions/scores.

### Assignments (`/api/v1/assignments`)
* `GET /` - Protected (Admin/Manager). List all assignments.
* `POST /` - Protected (Admin). Create journey assignment to individual or target audience.
* `GET /me/active` - Protected (Employee). Get active assigned onboarding journeys.
* `GET /me/completed` - Protected (Employee). Get past completed assignments.
* `GET /:id` - Protected (All). Get specific assignment progress.
* `POST /:id/start` - Protected (Employee). Start learning.
* `POST /:id/complete-lesson` - Protected (Employee). Mark lesson content completed.
* `POST /:id/submit-quiz` - Protected (Employee). Evaluate quiz answers, calculate score, update progress.
* `POST /:id/complete` - Protected (Employee/System). Verify completion criteria, generate certificate reference.

### Knowledge Base (`/api/v1/knowledge-base`)
* `GET /` - Protected (All). List accessible articles.
* `GET /search` - Protected (All). Search full-text articles.
* `POST /` - Protected (Admin). Create article.
* `GET /:id` - Protected (All). Fetch content blocks, record view analytics.
* `PATCH /:id` - Protected (Admin). Update article.
* `DELETE /:id` - Protected (Admin). Soft delete article.
* `POST /:id/publish` - Protected (Admin). Publish article.
* `POST /:id/archive` - Protected (Admin). Archive article.
* `GET /popular` - Protected (All). List most viewed articles.

### Uploads (`/api/v1/uploads`)
* `POST /request-url` - Protected (All). Create signed upload URL for direct-to-R2 (Future) or validate file for direct endpoint streaming (Initial).
* `POST /complete` - Protected (All). Complete upload registration and save metadata in database.
* `GET /` - Protected (Admin). List all files uploaded in organization.
* `GET /:id` - Protected (All). Get file metadata or resolve signed url.
* `DELETE /:id` - Protected (Admin/Uploader). Mark deleted.

### Notifications (`/api/v1/notifications`)
* `GET /` - Protected (All). List current user notifications.
* `GET /unread` - Protected (All). List unread notifications.
* `PATCH /:id/read` - Protected (All). Mark single notification read.
* `PATCH /read-all` - Protected (All). Mark all notification read.
* `DELETE /:id` - Protected (All). Remove notification.
* `GET /count` - Protected (All). Return unread count badge.

### Audit Logs (`/api/v1/audit-logs`)
* `GET /` - Protected (Admin/Owner). List all audit records.
* `GET /:id` - Protected (Admin/Owner). Fetch detailed log and meta changes.
* `GET /export` - Protected (Admin/Owner). Trigger CSV/JSON compilation.

---

## 9. Error Handling Code Matrix

```typescript
const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",             // HTTP 422
  UNAUTHORIZED: "UNAUTHORIZED",                     // HTTP 401
  FORBIDDEN: "FORBIDDEN",                           // HTTP 403
  NOT_FOUND: "NOT_FOUND",                           // HTTP 404
  CONFLICT: "CONFLICT",                             // HTTP 409
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",       // HTTP 429
  FILE_TOO_LARGE: "FILE_TOO_LARGE",                 // HTTP 413
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE", // HTTP 415
  TOKEN_EXPIRED: "TOKEN_EXPIRED",                   // HTTP 401 (explicit subtype)
  INVALID_TOKEN: "INVALID_TOKEN",                   // HTTP 401 (explicit subtype)
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",   // HTTP 500
} as const;
```

---

## 10. File Storage Architecture (Cloudflare R2)

* **Initial Phase File Pipeline:**
  1. Client sends multipart/form-data request to Fastify `/api/v1/uploads/`.
  2. Fastify validation hook checks file size & MIME type using `@fastify/multipart`.
  3. Fastify streams file chunks to Cloudflare R2 bucket.
  4. Upon successful write to R2, Fastify writes metadata to `uploads` collection.
  5. Fastify returns JSON payload containing file ID and public URL.
* **Storage Key Format:**
  `organizations/{organizationId}/uploads/{year}/{month}/{uuid}.{extension}`
* **Private Assets Security:** Large learning videos and compliance PDFs are uploaded with private visibility. Temporary signed URLs must be generated by the `StorageService` to authorize client reads, or client must pull files through an authenticated proxy endpoint.

---

## 11. Deployment PM2 Configuration

The production Node process must run via PM2 using an `ecosystem.config.js` script:

```javascript
module.exports = {
  apps: [{
    name: 'talnova-api',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

---

## 12. Coding Standards for AI Agents

* **Strict Types:** `any` is prohibited. If types are dynamic, use `unknown` and implement type guards.
* **Async/Await:** Avoid callbacks. Use Promise-based operations.
* **No Console Logs:** Always log via the injected Fastify Pino logger: `request.log.info()` or `server.log.error()`.
* **Centralized Logic:** Keep route files empty of logic. Business rules must reside exclusively inside classes in `services/`.
* **Repository encapsulation:** Raw Mongoose model calls (like `User.find()`) are restricted to files inside `repositories/`. Do not import Mongoose models in services.
* **Tenant Isolation check:** Ensure every repository query includes `{ organizationId }` unless explicitly querying a global resource.
* **Idempotency & Cleanups:** Uncompleted operations must cleanup temporary disk items synchronously or asynchronously.
