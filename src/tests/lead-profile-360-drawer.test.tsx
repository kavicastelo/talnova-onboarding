import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { LeadProfile360Drawer } from '../components/super-admin/sales/leads/LeadProfile360Drawer';
import { LeadTimeline } from '../components/super-admin/sales/leads/LeadTimeline';
import { LeadNotesWidget } from '../components/super-admin/sales/leads/LeadNotesWidget';
import { LeadScoreBreakdownWidget } from '../components/super-admin/sales/leads/LeadScoreBreakdownWidget';
import { salesService, LeadItem } from '../services/sales.service';
import { SuperAdminFilterProvider } from '../context/SuperAdminFilterContext';

// Mock Sonner toast and Toaster
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return {
    ...actual,
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    },
    Toaster: () => null,
  };
});

// Mock Sales Service
vi.mock('../services/sales.service', async () => {
  const actual = await vi.importActual<any>('../services/sales.service');
  return {
    ...actual,
    salesService: {
      getLeads: vi.fn(),
      getLeadById: vi.fn(),
      createLead: vi.fn(),
      updateLead: vi.fn(),
      updateLeadStatus: vi.fn(),
      deleteLead: vi.fn(),
      addLeadNote: vi.fn(),
      recalculateScore: vi.fn(),
      recordScoreEvent: vi.fn(),
      checkDuplicates: vi.fn(),
      mergeLeads: vi.fn(),
    },
  };
});

// Mock SuperAdminOrganizations hook
vi.mock('../hooks/useSuperAdmin', () => ({
  useSuperAdminOrganizations: () => ({
    data: { data: [] },
    isLoading: false,
  }),
}));

const mockLead: LeadItem = {
  _id: 'lead-360-test',
  name: 'Sarah Connor',
  email: 'sarah@cyberdyne.test',
  phone: '+1 555-0100',
  whatsapp: '+1 555-0100',
  companyName: 'Cyberdyne Systems',
  jobTitle: 'Head of Cyber Defense',
  industry: 'Enterprise Security',
  companySize: '501-1000',
  country: 'United States',
  region: 'California',
  source: 'product_demo',
  sourceDetails: 'Requested live AI demo',
  status: 'qualified',
  score: 85,
  priority: 'urgent',
  estimatedBudget: 75000,
  currency: 'USD',
  expectedPurchaseDate: '2026-11-30T00:00:00.000Z',
  assignedOwnerId: {
    _id: 'usr-1',
    name: 'Kyle Reese',
    email: 'kyle@talnova.test',
    role: 'sales_rep',
  },
  tags: ['enterprise', 'high-intent', 'q4-pipeline'],
  notes: [
    {
      _id: 'note-1',
      content: 'Met with client team. Interested in automated compliance verification features.',
      createdBy: {
        _id: 'usr-1',
        name: 'Kyle Reese',
        email: 'kyle@talnova.test',
      },
      createdAt: '2026-05-15T14:30:00.000Z',
    },
  ],
  scoreBreakdown: [
    { rule: 'product_demo_source', points: 25, timestamp: '2026-05-10T10:00:00.000Z' },
    { rule: 'enterprise_company_size', points: 20, timestamp: '2026-05-10T10:00:00.000Z' },
    { rule: 'budget_over_50k', points: 15, timestamp: '2026-05-10T10:00:00.000Z' },
    { rule: 'c_level_job_title', points: 15, timestamp: '2026-05-10T10:00:00.000Z' },
  ],
  lastContactDate: '2026-05-15T14:30:00.000Z',
  nextFollowUpDate: '2026-05-22T10:00:00.000Z',
  createdAt: '2026-05-10T10:00:00.000Z',
  updatedAt: '2026-05-15T15:00:00.000Z',
};

const emptyLead: LeadItem = {
  _id: 'lead-empty',
  name: 'Anonymous Prospect',
  email: 'prospect@acme.test',
  companyName: 'Acme Unknown',
  source: 'website',
  status: 'new',
  score: 10,
  priority: 'low',
  currency: 'USD',
  tags: [],
  notes: [],
  scoreBreakdown: [],
  createdAt: '2026-05-16T12:00:00.000Z',
  updatedAt: '2026-05-16T12:00:00.000Z',
};

function renderWithProviders(element: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SuperAdminFilterProvider>
          {element}
        </SuperAdminFilterProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LEAD-007: Lead Profile 360 Drawer & Activity History UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LeadProfile360Drawer Master Component', () => {
    it('renders drawer header with lead details, status badge, score pill and action buttons', () => {
      const html = renderWithProviders(
        <LeadProfile360Drawer
          lead={mockLead}
          isOpen={true}
          onClose={vi.fn()}
        />
      );

      // Header identity
      expect(html).toContain('Sarah Connor');
      expect(html).toContain('Cyberdyne Systems');
      expect(html).toContain('Head of Cyber Defense');

      // Status badge and score
      expect(html).toContain('Qualified');
      expect(html).toContain('Score:');
      expect(html).toContain('85');
      expect(html).toContain('/ 100');
      expect(html).toContain('urgent');

      // Quick action toolbar
      expect(html).toContain('mailto:sarah@cyberdyne.test');
      expect(html).toContain('tel:+1 555-0100');
      expect(html).toContain('https://wa.me/15550100');
      expect(html).toContain('Convert to Deal');

      // Tabs presence
      expect(html).toContain('Overview');
      expect(html).toContain('Timeline');
      expect(html).toContain('Notes');
      expect(html).toContain('Scoring');

      // Overview Content
      expect(html).toContain('sarah@cyberdyne.test');
      expect(html).toContain('501-1000 employees');
      expect(html).toContain('USD 75,000');
      expect(html).toContain('Kyle Reese');
      expect(html).toContain('q4-pipeline');
    });

    it('returns null when drawer isOpen is false or lead is null', () => {
      const htmlClosed = renderWithProviders(
        <LeadProfile360Drawer lead={mockLead} isOpen={false} onClose={vi.fn()} />
      );
      // Closed sheet content is not mounted in the DOM
      expect(htmlClosed).toBe('');

      const htmlNull = renderWithProviders(
        <LeadProfile360Drawer lead={null} isOpen={true} onClose={vi.fn()} />
      );
      expect(htmlNull).toBe('');
    });
  });

  describe('LeadTimeline Component', () => {
    it('renders chronological stream of status, score, note, and contact events', () => {
      const html = renderWithProviders(<LeadTimeline lead={mockLead} />);

      expect(html).toContain('Lead Captured');
      expect(html).toContain('product demo');
      expect(html).toContain('Scoring Rule: product_demo_source');
      expect(html).toContain('+25 pts');
      expect(html).toContain('Scoring Rule: enterprise_company_size');
      expect(html).toContain('+20 pts');
      expect(html).toContain('Note Added by Kyle Reese');
      expect(html).toContain('Prospect Interaction Recorded');
      expect(html).toContain('Follow-Up Scheduled');
    });

    it('renders honest empty state when lead has no activity records', () => {
      const leadNoEvents = { ...emptyLead, createdAt: '' };
      const html = renderWithProviders(<LeadTimeline lead={leadNoEvents} />);

      expect(html).toContain('No timeline activity recorded yet');
      expect(html).toContain('Activity will automatically populate');
    });
  });

  describe('LeadNotesWidget Component', () => {
    it('renders note composer and list of logged notes with author and timestamp', () => {
      const html = renderWithProviders(<LeadNotesWidget lead={mockLead} />);

      expect(html).toContain('Add Internal CRM Note');
      expect(html).toContain('Record call summary, client expectations, pain points');
      expect(html).toContain('Post Note');
      expect(html).toContain('note');
      expect(html).toContain('Kyle Reese');
      expect(html).toContain('Met with client team. Interested in automated compliance verification features.');
    });

    it('renders honest empty state when lead has zero notes', () => {
      const html = renderWithProviders(<LeadNotesWidget lead={emptyLead} />);

      expect(html).toContain('No notes posted yet');
      expect(html).toContain('Use the composer above to log key insights');
    });
  });

  describe('LeadScoreBreakdownWidget Component', () => {
    it('renders score gauge rating, priority badge, and individual rule breakdown cards', () => {
      const html = renderWithProviders(<LeadScoreBreakdownWidget lead={mockLead} />);

      expect(html).toContain('Lead Score &amp; Qualification Rating');
      expect(html).toContain('85');
      expect(html).toContain('/ 100');
      expect(html).toContain('Sales Ready (Hot)');
      expect(html).toContain('Urgent');
      expect(html).toContain('Recalculate');
      expect(html).toContain('product_demo_source');
      expect(html).toContain('+25');
      expect(html).toContain('enterprise_company_size');
      expect(html).toContain('+20');
      expect(html).toContain('rules');
      expect(html).toContain('triggered');
    });

    it('renders honest empty state when score breakdown is empty', () => {
      const html = renderWithProviders(<LeadScoreBreakdownWidget lead={emptyLead} />);

      expect(html).toContain('No scoring events on record');
      expect(html).toContain('Nurture Required (Cold)');
      expect(html).toContain('Low');
    });
  });
});
