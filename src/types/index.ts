// -------------------------
// Auth & User Types
// -------------------------
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'super_admin';
  avatar: string;
  company: string;
}

// -------------------------
// Onboarding Journey Types
// -------------------------
export type JourneyStatus = 'Active' | 'Draft' | 'Archived';

export interface Journey {
  id: string;
  title: string;
  status: JourneyStatus;
  enrolled: number;
  completion: number;
  lastUpdated: string;
  description?: string;
  category?: string;
  modules?: CourseModule[];
  audience?: {
    isPublic?: boolean;
  };
  settings?: {
    allowSkipLessons: boolean;
    requireSequentialCompletion: boolean;
    allowRetakes: boolean;
    maxRetakes?: number;
  };
  certificate?: {
    enabled: boolean;
    templateId?: string;
    passingScore?: number;
  };
}

export interface JourneyAssignment {
  employeeId: string;
  employeeName: string;
  progress: number;
  assignedAt: string;
  status: 'In Progress' | 'Completed';
}

// -------------------------
// Employee & Team Types
// -------------------------
export type EmployeeStatus = 'Active' | 'Onboarding' | 'Inactive';

export interface AssignedJourneyOverview {
  id: string;
  title: string;
  assignedAt: string;
  progress: number;
  status: 'In Progress' | 'Completed';
  certificate?: {
    issued: boolean;
    issuedAt?: string;
    certificateId?: string;
  };
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  status: EmployeeStatus;
  progress: number;
  email?: string;
  location?: string;
  hireDate?: string;
  completedJourneysCount?: number;
  certificatesCount?: number;
  assignedJourneys?: AssignedJourneyOverview[];
  avatar?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  timezone?: string;
  designation?: string;
  payrollCategory?: string;
}

// -------------------------
// Course & Curriculum Types
// -------------------------
export type LessonType = 'Video' | 'Article' | 'Task' | 'Quiz' | 'PDF' | 'Document' | 'Audio' | 'Image';

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  duration: string;
  isCompleted: boolean;
  content?: string;
  description?: string;
  prerequisites?: string[];
  estimatedTime?: number; // in minutes
  completionRule?: 'video' | 'button' | 'quiz';
  contentBlocks?: Array<{
    id: string;
    type: string;
    title?: string;
    content?: string;
    uploadUrl?: string;
    embedUrl?: string;
    order: number;
  }>;
  quiz?: {
    id: string;
    passingScore: number;
    questions: Array<{
      id: string;
      questionText: string;
      type: 'single_choice' | 'multiple_choice' | 'true_false';
      points: number;
      options: Array<{
        id: string;
        optionText: string;
        isCorrect: boolean;
      }>;
    }>;
  } | null;
  quizAttempt?: {
    score: number;
    passed: boolean;
    attemptNumber: number;
  } | null;
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  progress: number;
  modules: CourseModule[];
}

// -------------------------
// Dashboard & Analytics Types
// -------------------------
export interface CompletionTrendPoint {
  name: string; // Month name (e.g. "Jan", "Feb")
  completions?: number;
  rate?: number; // for percentage trends
}

export interface ActivityItem {
  id: string;
  userInitials: string;
  userName: string;
  actionDescription: string;
  journeyTitle: string;
  timeAgo: string;
}

export interface AdminDashboardSummary {
  totalEmployees: number;
  totalEmployeesDelta: string;
  activeJourneys: number;
  activeJourneysDelta: string;
  completionRate: number;
  completionRateDelta: string;
  avgTimeToComplete: string;
  avgTimeToCompleteDelta: string;
  completionsOverTime: CompletionTrendPoint[];
  recentActivity: ActivityItem[];
}

export interface DepartmentCompletion {
  name: string;
  completions: number;
}

export interface JourneyCompletionRate {
  id: string;
  title: string;
  category: string;
  totalAssignments: number;
  totalCompletions: number;
  completionRate: number;
  averageScore: number;
}

export interface AnalyticsSummary {
  avgCompletionRate: number;
  avgCompletionRateDelta: string;
  activeLearners: number;
  activeLearnersPercent: string;
  learningHours: number;
  learningHoursAverage: string;
  certificatesIssued: number;
  certificatesIssuedDelta: string;
  completionTrend: CompletionTrendPoint[];
  departmentCompletions: DepartmentCompletion[];
  journeyCompletionRates: JourneyCompletionRate[];
}

// -------------------------
// Knowledge Base Types
// -------------------------
export interface KbCategory {
  title: string;
  iconName: 'Shield' | 'Book' | 'FileText' | 'Users' | 'HelpCircle';
  count: number;
  description: string;
}

export interface KbArticle {
  id: string;
  title: string;
  category: string;
  readTime: string;
  content?: string;
  summary?: string;
  blocks?: Array<{
    id: string;
    type: 'text' | 'image' | 'video' | 'pdf';
    content?: string;
    embedUrl?: string;
    filename?: string;
  }>;
}

// -------------------------
// Workspace Settings Types
// -------------------------
export interface NotificationPreferences {
  newAssignmentEmails: boolean;
  deadlineReminders: boolean;
  weeklyManagerDigest: boolean;
}

export interface WorkspaceSettings {
  orgName: string;
  organizationName?: string;
  workspaceUrl: string;
  supportEmail: string;
  logoUrl?: string;
  primaryColor: string;
  logo?: {
    uploadId: string;
    fileName: string;
    publicUrl?: string;
  };
  notifications: NotificationPreferences;
  security: {
    allowPasswordLogin: boolean;
    enforceMfa: boolean;
    sessionTimeout: number;
  };
  categories?: string[];
  certificate?: {
    template: 'classic' | 'modern' | 'minimalist';
    signatureUrl?: string;
    signatoryName?: string;
    signatoryTitle?: string;
  };
}

export interface AppNotification {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
}

// -------------------------
// API Request/Response Common envelopes
// -------------------------
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
