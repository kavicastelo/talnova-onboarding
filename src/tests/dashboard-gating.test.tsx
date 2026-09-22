import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RoleProvider } from '../context/RoleContext';
import { EmployeeDashboard } from '../pages/EmployeeDashboard';
import { AdminDashboard } from '../pages/AdminDashboard';
import { ManagerDashboard } from '../pages/ManagerDashboard';
import { HROperations } from '../pages/HROperations';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'admin.title': 'Dashboard',
        'admin.stats.totalEmployees': 'Total Employees',
        'admin.stats.activeJourneys': 'Active Journeys',
        'admin.stats.completionRate': 'Completion Rate',
        'admin.stats.avgTimeToComplete': 'Avg Time to Complete',
        'admin.completionsOverTime': 'Completions Over Time',
        'admin.recentActivity': 'Recent Activity',
        'employee.assignedJourneys': 'Assigned Journeys',
        'employee.noJourneys': 'No journeys assigned yet',
      };
      return map[key] || key;
    },
  }),
}));

// Mock recharts and ChartContainer to avoid SVG/DOM rendering issues in SSR
vi.mock('recharts', () => ({
  BarChart: ({ children }: any) => <div data-testid="barchart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../components/Chart', () => ({
  ChartContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
  ChartTooltipContent: () => null,
}));

// Mock auth hook
vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: () => ({
    data: { id: 'usr-emp-1', name: 'Jane Doe', email: 'jane@northwind.test', role: 'employee' },
    isLoading: false,
    error: null,
  }),
}));

// Mock employee hooks
vi.mock('../hooks/useEmployees', () => ({
  useEmployee: () => ({
    data: {
      id: 'emp-1',
      name: 'Jane Doe',
      fullName: 'Jane Doe',
      email: 'jane@northwind.test',
      status: 'Onboarding',
      assignedJourneys: [
        {
          id: 'j-1',
          journeyId: 'j-1',
          title: 'Welcome to Northwind',
          progress: 50,
          status: 'In Progress',
          assignedAt: '2026-09-01',
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useEmployees: () => ({
    data: { employees: [] },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

// Mock journey hooks
vi.mock('../hooks/useJourneys', () => ({
  useJourneys: () => ({ data: [] }),
  useAssignJourney: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock task hooks
vi.mock('../hooks/useTasks', () => ({
  useTasks: () => ({
    data: {
      tasks: [
        { _id: 't-1', title: 'Set up work laptop', status: 'pending', priority: 'high' },
      ],
    },
    isLoading: false,
  }),
  useUpdateTaskStatus: () => ({ mutate: vi.fn() }),
  useConfirmHardwareReceipt: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Mock document inbox hook
vi.mock('../hooks/useDocuments', () => ({
  useEmployeeDocumentInbox: () => ({
    data: [
      { _id: 'doc-1', title: 'Non-Disclosure Agreement', status: 'pending_signature' },
    ],
    isLoading: false,
  }),
}));

// Mock buddy hook
vi.mock('../hooks/useBuddy', () => ({
  useMyBuddy: () => ({
    data: { buddyUserId: 'usr-buddy-1', status: 'paired' },
    isLoading: false,
  }),
}));

// Mock milestone hook
vi.mock('../hooks/useMilestones', () => ({
  useMyMilestones: () => ({
    data: [
      { _id: 'm-1', title: 'Day 30 Check-in', dayInterval: 30, status: 'in_progress' },
    ],
    isLoading: false,
  }),
  useTeamMilestones: () => ({
    data: [],
    isLoading: false,
  }),
}));

// Mock dashboard summary hook
vi.mock('../hooks/useDashboard', () => ({
  useDashboardSummary: () => ({
    data: {
      totalEmployees: 150,
      totalEmployeesDelta: '+10%',
      activeJourneys: 6,
      activeJourneysDelta: '+2',
      completionRate: 92,
      completionRateDelta: '+4%',
      avgTimeToComplete: '12d',
      avgTimeToCompleteDelta: '-1d',
      completionsOverTime: [{ name: 'Jan', completions: 20 }],
      recentActivity: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

// Mock manager hooks
vi.mock('../hooks/useManager', () => ({
  useManagerDashboard: () => ({
    data: {
      totalDirectReports: 4,
      activeOnboardingCount: 2,
      overallCompletionRate: 80,
      overdueItemsCount: 1,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useTeamDirectReports: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useTeamOverview: () => ({
    data: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useDirectReportDetails: () => ({
    data: null,
    isLoading: false,
  }),
  useNudgeDirectReport: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useSignOffDirectReport: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

// Mock HR Operations hooks
vi.mock('../hooks/useHROperations', () => ({
  useHRDashboard: () => ({
    data: {
      activeOnboardees: 12,
      journeyComplianceRate: 88,
      pendingDocuments: 4,
      overdueMilestones: 2,
      unassignedBuddiesCount: 3,
    },
    isLoading: false,
  }),
  useHRExceptions: () => ({
    data: [],
    isLoading: false,
    refetch: vi.fn(),
  }),
  useHRComplianceReport: () => ({
    data: [],
    isLoading: false,
  }),
  useUpdateLifecycleState: () => ({ mutate: vi.fn() }),
  useCompleteHandover: () => ({ mutate: vi.fn() }),
  useExecuteHRBulkAction: () => ({ mutate: vi.fn() }),
}));

// Mock localStorage for test environment
const storageMap: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => storageMap[key] ?? null,
  setItem: (key: string, val: string) => { storageMap[key] = val; },
  removeItem: (key: string) => { delete storageMap[key]; },
  clear: () => { Object.keys(storageMap).forEach((k) => delete storageMap[k]); },
};

describe('PR-DSH-001: Multi-Persona Dashboard Widget Feature Gating', () => {
  beforeEach(() => {
    Object.keys(storageMap).forEach((k) => delete storageMap[k]);
  });

  describe('EmployeeDashboard Gating', () => {
    it('Requirement 13.1 & 13.2: Renders EmployeeDashboard with digital_signatures: false, buddy_connection: false; asserts cards are absent', () => {
      const html = renderToString(
        <RoleProvider initialRole="employee" initialFeatures={{ digital_signatures: false, buddy_connection: false }}>
          <MemoryRouter>
            <EmployeeDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      // Assert "Required Documents" and "My Buddy" cards are absent
      expect(html).not.toContain('Required Documents');
      expect(html).not.toContain('data-testid="card-required-documents"');
      expect(html).not.toContain('My Buddy');
      expect(html).not.toContain('data-testid="card-my-buddy"');
      // Assert step 1 for e-signatures is also hidden from stepper
      expect(html).not.toContain('1. E-Signatures');
    });

    it('Requirement 13.3 & 13.4: Re-render with digital_signatures: true; asserts "Required Documents" card appears', () => {
      const html = renderToString(
        <RoleProvider initialRole="employee" initialFeatures={{ digital_signatures: true, buddy_connection: false }}>
          <MemoryRouter>
            <EmployeeDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      // Assert "Required Documents" card appears
      expect(html).toContain('Required Documents');
      expect(html).toContain('data-testid="card-required-documents"');
      expect(html).toContain('1. E-Signatures');

      // Assert "My Buddy" is still absent
      expect(html).not.toContain('My Buddy');
      expect(html).not.toContain('data-testid="card-my-buddy"');
    });

    it('Requirement 11.4: Gates buddy_connection, gamified_milestones, and onboarding_copilot widgets', () => {
      // Disabled state
      const disabledHtml = renderToString(
        <RoleProvider
          initialRole="employee"
          initialFeatures={{
            buddy_connection: false,
            gamified_milestones: false,
            onboarding_copilot: false,
          }}
        >
          <MemoryRouter>
            <EmployeeDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(disabledHtml).not.toContain('data-testid="btn-copilot-drawer"');
      expect(disabledHtml).not.toContain('data-testid="widget-points-leaderboard"');
      expect(disabledHtml).not.toContain('data-testid="card-my-buddy"');

      // Enabled state
      const enabledHtml = renderToString(
        <RoleProvider
          initialRole="employee"
          initialFeatures={{
            buddy_connection: true,
            gamified_milestones: true,
            onboarding_copilot: true,
          }}
        >
          <MemoryRouter>
            <EmployeeDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(enabledHtml).toContain('data-testid="btn-copilot-drawer"');
      expect(enabledHtml).toContain('Ask Copilot');
      expect(enabledHtml).toContain('data-testid="widget-points-leaderboard"');
      expect(enabledHtml).toContain('Points &amp; Leaderboard');
      expect(enabledHtml).toContain('data-testid="card-my-buddy"');
      expect(enabledHtml).toContain('My Buddy');
    });
  });

  describe('AdminDashboard Gating', () => {
    it('Requirement 11.2: Gates ai_course_builder, digital_signatures, and kiosk_mode quick actions', () => {
      // Disabled state
      const disabledHtml = renderToString(
        <RoleProvider
          initialRole="admin"
          initialFeatures={{
            ai_course_builder: false,
            digital_signatures: false,
            kiosk_mode: false,
          }}
        >
          <MemoryRouter>
            <AdminDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(disabledHtml).not.toContain('data-testid="quick-action-ai-builder"');
      expect(disabledHtml).not.toContain('Generate Course with AI');
      expect(disabledHtml).not.toContain('data-testid="widget-pending-documents"');
      expect(disabledHtml).not.toContain('Pending Documents');
      expect(disabledHtml).not.toContain('data-testid="widget-kiosk-devices"');
      expect(disabledHtml).not.toContain('Kiosk Device Summary');

      // Enabled state
      const enabledHtml = renderToString(
        <RoleProvider
          initialRole="admin"
          initialFeatures={{
            ai_course_builder: true,
            digital_signatures: true,
            kiosk_mode: true,
          }}
        >
          <MemoryRouter>
            <AdminDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(enabledHtml).toContain('data-testid="quick-action-ai-builder"');
      expect(enabledHtml).toContain('Generate Course with AI');
      expect(enabledHtml).toContain('data-testid="widget-pending-documents"');
      expect(enabledHtml).toContain('Pending Documents');
      expect(enabledHtml).toContain('data-testid="widget-kiosk-devices"');
      expect(enabledHtml).toContain('Kiosk Device Summary');
    });
  });

  describe('ManagerDashboard Gating', () => {
    it('Requirement 11.3: Gates milestone_approval, buddy_assignment, and calendar_integration cards', () => {
      // Disabled state
      const disabledHtml = renderToString(
        <RoleProvider
          initialRole="manager"
          initialFeatures={{
            milestone_approval: false,
            buddy_assignment: false,
            calendar_integration: false,
          }}
        >
          <MemoryRouter>
            <ManagerDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(disabledHtml).not.toContain('data-testid="card-milestone-approvals"');
      expect(disabledHtml).not.toContain('Milestone Approvals');
      expect(disabledHtml).not.toContain('data-testid="card-buddy-matching"');
      expect(disabledHtml).not.toContain('Buddy Matching');
      expect(disabledHtml).not.toContain('data-testid="card-calendar-schedule"');
      expect(disabledHtml).not.toContain('Calendar 1-on-1 Schedule');

      // Enabled state
      const enabledHtml = renderToString(
        <RoleProvider
          initialRole="manager"
          initialFeatures={{
            milestone_approval: true,
            buddy_assignment: true,
            calendar_integration: true,
          }}
        >
          <MemoryRouter>
            <ManagerDashboard />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(enabledHtml).toContain('data-testid="card-milestone-approvals"');
      expect(enabledHtml).toContain('Milestone Approvals');
      expect(enabledHtml).toContain('data-testid="card-buddy-matching"');
      expect(enabledHtml).toContain('Buddy Matching');
      expect(enabledHtml).toContain('data-testid="card-calendar-schedule"');
      expect(enabledHtml).toContain('Calendar 1-on-1 Schedule');
    });
  });

  describe('HROperations Dashboard Gating', () => {
    it('Requirement 11 & 17: Gates Pending Documents, Overdue Milestones, and Unassigned Buddies in HROperations', () => {
      // Disabled state
      const disabledHtml = renderToString(
        <RoleProvider
          initialRole="admin"
          initialFeatures={{
            digital_signatures: false,
            milestone_approval: false,
            milestone_ratings: false,
            buddy_assignment: false,
            buddy_connection: false,
          }}
        >
          <MemoryRouter>
            <HROperations />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(disabledHtml).not.toContain('data-testid="kpi-pending-documents"');
      expect(disabledHtml).not.toContain('data-testid="kpi-overdue-milestones"');
      expect(disabledHtml).not.toContain('data-testid="kpi-unassigned-buddies"');

      // Enabled state
      const enabledHtml = renderToString(
        <RoleProvider
          initialRole="admin"
          initialFeatures={{
            digital_signatures: true,
            milestone_approval: true,
            buddy_assignment: true,
          }}
        >
          <MemoryRouter>
            <HROperations />
          </MemoryRouter>
        </RoleProvider>
      );

      expect(enabledHtml).toContain('data-testid="kpi-pending-documents"');
      expect(enabledHtml).toContain('Pending Documents');
      expect(enabledHtml).toContain('data-testid="kpi-overdue-milestones"');
      expect(enabledHtml).toContain('Overdue Milestones');
      expect(enabledHtml).toContain('data-testid="kpi-unassigned-buddies"');
      expect(enabledHtml).toContain('Unassigned Buddies');
    });
  });
});
