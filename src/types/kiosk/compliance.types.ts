/**
 * K-ANA-003: Safety Compliance Reporting & Audit Packet Types
 */

export interface ComplianceTrendPeriod {
  period: string;
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  targetRate: number;
}

export interface SupervisorWitnessDetails {
  supervisorName: string;
  method: string;
  witnessedAt?: string | Date;
}

export interface RecentCompletionRecord {
  sessionId: string;
  workerName: string;
  workerEmail: string;
  department: string;
  jobTitle: string;
  journeyTitle: string;
  deviceName: string;
  deviceLocation: string;
  startedAt: string | Date;
  completedAt: string | Date;
  durationSeconds: number;
  quizScore?: number;
  ppeItemsVerified?: string[];
  supervisorWitness?: SupervisorWitnessDetails;
  verificationChecksum: string;
}

export interface KioskComplianceSummary {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  certifiedWorkersCount: number;
  totalWorkersCount: number;
  supervisorSignOffsCount: number;
  averageDurationSeconds: number;
  complianceStatus: 'compliant' | 'needs_attention' | 'at_risk';
  historicalTrends: ComplianceTrendPeriod[];
  recentCompletions: RecentCompletionRecord[];
}

export interface ShiftBreakdownItem {
  shift: 'Morning' | 'Afternoon' | 'Night' | string;
  completions: number;
}

export interface DepartmentCompliance {
  department: string;
  totalWorkers: number;
  certifiedWorkers: number;
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  supervisorSignOffs: number;
  dropouts: number;
  shiftBreakdown: ShiftBreakdownItem[];
}

export interface DepartmentComplianceResponse {
  departments: DepartmentCompliance[];
}

export interface ComplianceFilterParams {
  journeyId?: string;
  startDate?: string;
  endDate?: string;
  department?: string;
  format?: 'csv' | 'json';
}

export interface ComplianceAuditRecord {
  sessionId: string;
  workerName: string;
  workerEmail: string;
  department: string;
  jobTitle: string;
  journeyTitle: string;
  deviceName: string;
  deviceLocation: string;
  startedAt: string;
  completedAt: string;
  durationMinutes: string;
  quizScore: string;
  supervisorWitnessed: string;
  supervisorName: string;
  witnessMethod: string;
  verificationChecksum: string;
}

export interface ComplianceAuditPacketResponse {
  exportDate: string;
  organization: string;
  totalRecords: number;
  records: ComplianceAuditRecord[];
}
