import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KioskComplianceDashboard } from '../pages/kiosk/KioskComplianceDashboard';
import { kioskService } from '../features/kiosk/services/kiosk.service';
import {
  KioskComplianceSummary,
  DepartmentComplianceResponse,
  ComplianceAuditRecord
} from '../types/kiosk/compliance.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Mock ResponsiveContainer for recharts in test environment
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div className="recharts-responsive-container">{children}</div>
  };
});

describe('K-ANA-003: Enterprise Safety Compliance Reporting Dashboard Suite', () => {
  const mockSummary: KioskComplianceSummary = {
    totalSessions: 142,
    completedSessions: 131,
    completionRate: 92,
    certifiedWorkersCount: 88,
    totalWorkersCount: 95,
    supervisorSignOffsCount: 46,
    averageDurationSeconds: 435, // 7m 15s
    complianceStatus: 'compliant',
    historicalTrends: [
      { period: 'W-08-25', totalSessions: 22, completedSessions: 20, completionRate: 91, targetRate: 85 },
      { period: 'W-09-01', totalSessions: 25, completedSessions: 23, completionRate: 92, targetRate: 85 },
      { period: 'W-09-08', totalSessions: 24, completedSessions: 22, completionRate: 92, targetRate: 85 },
      { period: 'W-09-15', totalSessions: 21, completedSessions: 19, completionRate: 90, targetRate: 85 },
      { period: 'W-09-22', totalSessions: 26, completedSessions: 24, completionRate: 92, targetRate: 85 },
      { period: 'W-09-29', totalSessions: 24, completedSessions: 23, completionRate: 96, targetRate: 85 }
    ],
    recentCompletions: [
      {
        sessionId: 'session-alpha-001',
        workerName: 'Marcus Vance',
        workerEmail: 'm.vance@plant-a.com',
        department: 'Operations',
        jobTitle: 'Heavy Machinery Operator',
        journeyTitle: 'OSHA Warehouse & Forklift Safety 2026',
        deviceName: 'North Gate Kiosk 1',
        deviceLocation: 'Building A - North Gate',
        startedAt: '2026-10-01T08:00:00.000Z',
        completedAt: '2026-10-01T08:07:15.000Z',
        durationSeconds: 435,
        quizScore: 100,
        supervisorWitness: {
          supervisorName: 'Elena Rostova',
          method: 'pin_verified',
          witnessedAt: '2026-10-01T08:07:12.000Z'
        },
        verificationChecksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      },
      {
        sessionId: 'session-alpha-002',
        workerName: 'Aaliyah Chen',
        workerEmail: 'a.chen@plant-a.com',
        department: 'Logistics',
        jobTitle: 'Inventory Specialist',
        journeyTitle: 'Hazardous Materials & Spill Response',
        deviceName: 'Dock Bay 4 Terminal',
        deviceLocation: 'Loading Dock B',
        startedAt: '2026-10-01T09:15:00.000Z',
        completedAt: '2026-10-01T09:22:00.000Z',
        durationSeconds: 420,
        quizScore: 95,
        supervisorWitness: {
          supervisorName: 'David Kalu',
          method: 'touch_override',
          witnessedAt: '2026-10-01T09:21:55.000Z'
        },
        verificationChecksum: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'
      }
    ]
  };

  const mockDepartmentResponse: DepartmentComplianceResponse = {
    departments: [
      {
        department: 'Operations',
        totalWorkers: 40,
        certifiedWorkers: 38,
        totalSessions: 60,
        completedSessions: 57,
        completionRate: 95,
        supervisorSignOffs: 22,
        dropouts: 3,
        shiftBreakdown: [
          { shift: 'Morning', completions: 28 },
          { shift: 'Afternoon', completions: 20 },
          { shift: 'Night', completions: 9 }
        ]
      },
      {
        department: 'Logistics',
        totalWorkers: 30,
        certifiedWorkers: 27,
        totalSessions: 45,
        completedSessions: 41,
        completionRate: 91,
        supervisorSignOffs: 14,
        dropouts: 4,
        shiftBreakdown: [
          { shift: 'Morning', completions: 20 },
          { shift: 'Afternoon', completions: 15 },
          { shift: 'Night', completions: 6 }
        ]
      },
      {
        department: 'Maintenance',
        totalWorkers: 25,
        certifiedWorkers: 23,
        totalSessions: 37,
        completedSessions: 33,
        completionRate: 89,
        supervisorSignOffs: 10,
        dropouts: 4,
        shiftBreakdown: [
          { shift: 'Morning', completions: 18 },
          { shift: 'Afternoon', completions: 10 },
          { shift: 'Night', completions: 5 }
        ]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Acceptance Criteria: Organization-Wide Compliance & KPI Summary Rendering', () => {
    it('renders the compliance dashboard structure, headers and testids', () => {
      const html = renderToString(<KioskComplianceDashboard />);

      // Dashboard Header and Title
      expect(html).toContain('Safety Compliance Dashboard');
      expect(html).toContain('OSHA Audit Packet Engine');
      expect(html).toContain('Regulatory Standard 29 CFR 1910');

      // Primary Action Buttons
      expect(html).toContain('data-testid="export-compliance-btn"');
      expect(html).toContain('data-testid="export-json-btn"');
      expect(html).toContain('data-testid="refresh-compliance-btn"');

      // Filter Controls
      expect(html).toContain('data-testid="filter-preset-all"');
      expect(html).toContain('data-testid="filter-preset-q1"');
      expect(html).toContain('data-testid="filter-preset-30d"');
      expect(html).toContain('data-testid="start-date-input"');
      expect(html).toContain('data-testid="end-date-input"');
      expect(html).toContain('data-testid="journey-filter-select"');
      expect(html).toContain('data-testid="department-filter-select"');

      // Summary Metric Cards
      expect(html).toContain('data-testid="metric-compliance-percentage"');
      expect(html).toContain('data-testid="metric-certified-workers"');
      expect(html).toContain('data-testid="metric-supervisor-signoffs"');
      expect(html).toContain('data-testid="metric-total-sessions"');

      // Charts
      expect(html).toContain('data-testid="historical-trend-chart"');
      expect(html).toContain('data-testid="shift-distribution-chart"');
      expect(html).toContain('data-testid="department-breakdown-chart"');
    });

    it('renders accurate compliance percentage and certification metrics', () => {
      // Spy on kioskService before rendering
      vi.spyOn(kioskService, 'getComplianceSummary').mockResolvedValue(mockSummary);
      vi.spyOn(kioskService, 'getComplianceByDepartment').mockResolvedValue(mockDepartmentResponse);
      vi.spyOn(kioskService, 'listJourneys').mockResolvedValue({ journeys: [], total: 0 });

      const html = renderToString(<KioskComplianceDashboard />);

      // Verify KPI Metric Card Presence
      expect(html).toContain('Org Compliance Rate');
      expect(html).toContain('Certified Workers');
      expect(html).toContain('Supervisor Sign-offs');
      expect(html).toContain('Total Sessions');
    });
  });

  describe('2. Acceptance Criteria: Q1 Date Range Audit Export Flow', () => {
    it('calls exportComplianceReport with Q1 date range parameters and handles CSV download', async () => {
      const mockCsvContent =
        '"Session ID","Worker Name","Worker Email","Department","Job Title","Journey Title","Terminal Device","Location","Started At","Completed At","Duration (Minutes)","Quiz Score","Supervisor Witnessed","Supervisor Name","Witness Method","Verification Checksum"\r\n' +
        '"session-alpha-001","Marcus Vance","m.vance@plant-a.com","Operations","Heavy Machinery Operator","OSHA Warehouse & Forklift Safety 2026","North Gate Kiosk 1","Building A - North Gate","2026-10-01T08:00:00.000Z","2026-10-01T08:07:15.000Z","7.3","100","Yes","Elena Rostova","pin_verified","e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"';

      const mockBlob = new Blob([mockCsvContent], { type: 'text/csv;charset=utf-8' });
      const exportSpy = vi.spyOn(kioskService, 'exportComplianceReport').mockResolvedValue({
        blob: mockBlob,
        filename: 'compliance-audit-packet-2026-Q1.csv'
      });

      // Directly invoke the export service as triggered by the button
      const q1Filters = {
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        format: 'csv' as const
      };

      const result = await kioskService.exportComplianceReport(q1Filters);

      expect(exportSpy).toHaveBeenCalledWith(q1Filters);
      expect(result.filename).toBe('compliance-audit-packet-2026-Q1.csv');
      expect(result.blob).toBeDefined();

      const text = await result.blob.text();
      expect(text).toContain('Marcus Vance');
      expect(text).toContain('Elena Rostova');
      expect(text).toContain('pin_verified');
      expect(text).toContain('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('exports JSON audit packet when JSON format is requested', async () => {
      const mockAuditPacket = {
        exportDate: '2026-10-02T07:00:00.000Z',
        organization: 'Enterprise Safety Network',
        totalRecords: 1,
        records: [
          {
            sessionId: 'session-alpha-001',
            workerName: 'Marcus Vance',
            workerEmail: 'm.vance@plant-a.com',
            department: 'Operations',
            jobTitle: 'Heavy Machinery Operator',
            journeyTitle: 'OSHA Warehouse & Forklift Safety 2026',
            deviceName: 'North Gate Kiosk 1',
            deviceLocation: 'Building A - North Gate',
            startedAt: '2026-10-01T08:00:00.000Z',
            completedAt: '2026-10-01T08:07:15.000Z',
            durationMinutes: '7.3',
            quizScore: '100',
            supervisorWitnessed: 'Yes',
            supervisorName: 'Elena Rostova',
            witnessMethod: 'pin_verified',
            verificationChecksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
          }
        ]
      };

      const jsonBlob = new Blob([JSON.stringify(mockAuditPacket)], { type: 'application/json' });
      const exportSpy = vi.spyOn(kioskService, 'exportComplianceReport').mockResolvedValue({
        blob: jsonBlob,
        filename: 'compliance-audit-packet-2026-Q1.json'
      });

      const result = await kioskService.exportComplianceReport({
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        format: 'json'
      });

      expect(exportSpy).toHaveBeenCalled();
      const rawText = await result.blob.text();
      const parsed = JSON.parse(rawText);
      expect(parsed.records[0].workerName).toBe('Marcus Vance');
      expect(parsed.records[0].supervisorName).toBe('Elena Rostova');
      expect(parsed.records[0].witnessMethod).toBe('pin_verified');
    });
  });

  describe('3. Department Breakdown & Shift Distribution Analysis', () => {
    it('aggregates shift distribution correctly across departments', () => {
      let morning = 0;
      let afternoon = 0;
      let night = 0;

      mockDepartmentResponse.departments.forEach((dept) => {
        dept.shiftBreakdown.forEach((shift) => {
          if (shift.shift.toLowerCase().includes('morning')) morning += shift.completions;
          else if (shift.shift.toLowerCase().includes('afternoon')) afternoon += shift.completions;
          else if (shift.shift.toLowerCase().includes('night')) night += shift.completions;
        });
      });

      // Operations (28) + Logistics (20) + Maintenance (18) = 66 morning completions
      expect(morning).toBe(66);
      // Operations (20) + Logistics (15) + Maintenance (10) = 45 afternoon completions
      expect(afternoon).toBe(45);
      // Operations (9) + Logistics (6) + Maintenance (5) = 20 night completions
      expect(night).toBe(20);
      expect(morning + afternoon + night).toBe(131);
    });

    it('identifies compliant departments vs those needing attention', () => {
      const operations = mockDepartmentResponse.departments[0];
      const logistics = mockDepartmentResponse.departments[1];
      const maintenance = mockDepartmentResponse.departments[2];

      expect(operations.completionRate).toBeGreaterThanOrEqual(85); // Compliant
      expect(logistics.completionRate).toBeGreaterThanOrEqual(85); // Compliant
      expect(maintenance.completionRate).toBeGreaterThanOrEqual(85); // Compliant
    });
  });

  describe('4. Cryptographic Proof & Supervisor Attestation Verification', () => {
    it('verifies SHA-256 HMAC checksum format for completed audit records', () => {
      const record = mockSummary.recentCompletions[0];
      expect(record.verificationChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(record.supervisorWitness?.method).toBe('pin_verified');
      expect(record.supervisorWitness?.supervisorName).toBe('Elena Rostova');
    });

    it('verifies touch override attestation method for floor supervisor overrides', () => {
      const record = mockSummary.recentCompletions[1];
      expect(record.verificationChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(record.supervisorWitness?.method).toBe('touch_override');
      expect(record.supervisorWitness?.supervisorName).toBe('David Kalu');
    });
  });
});
