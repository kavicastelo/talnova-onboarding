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
}

// -------------------------
// Course & Curriculum Types
// -------------------------
export type LessonType = 'Video' | 'Article' | 'Task' | 'Quiz';

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
  notifications: NotificationPreferences;
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
