import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { KioskDeviceManifest } from '../types/kiosk/device.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

describe('K-RUN-002: Multi-Journey Kiosk Home Screen Launcher Suite', () => {
  let mockManifest: KioskDeviceManifest;

  beforeEach(() => {
    vi.clearAllMocks();

    mockManifest = {
      deviceId: 'HW-GUID-SOUTH-404',
      organizationId: 'org_enterprise_001',
      device: {
        _id: 'dev_terminal_404',
        deviceId: 'HW-GUID-SOUTH-404',
        name: 'Assembly Bay 3 Terminal',
        location: 'Building C - Sector 7',
        status: 'online'
      },
      launchMode: 'launcher',
      journeys: [
        {
          _id: 'jrn_safety_1',
          organizationId: 'org_enterprise_001',
          title: 'Forklift Safety & Loading Dock Precautions',
          description: 'Critical operating procedures and pedestrian safety zones',
          priority: 0,
          isMandatory: true,
          status: 'published',
          version: 1,
          language: 'en',
          supportedLanguages: ['en'],
          steps: [
            {
              id: 's1',
              type: 'content',
              title: 'Step 1',
              order: 0,
              blocks: [],
              interaction: { type: 'hold_to_confirm' }
            },
            {
              id: 's2',
              type: 'content',
              title: 'Step 2',
              order: 1,
              blocks: [],
              interaction: { type: 'hold_to_confirm' }
            }
          ],
          settings: {
            autoPlay: false,
            loopForever: false,
            idleTimeoutSeconds: 60,
            autoReturnHome: true,
            hideNavigation: false,
            disableExit: true,
            security: { protectionType: 'none' }
          },
          publishing: { status: 'published', version: 1 },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          createdBy: 'admin',
          isDeleted: false
        },
        {
          _id: 'jrn_ppe_2',
          organizationId: 'org_enterprise_001',
          title: 'Mandatory PPE Verification Checklist',
          description: 'Hard hat, high-vis vest, and safety boots inspection',
          priority: 1,
          isMandatory: true,
          status: 'published',
          version: 1,
          language: 'en',
          supportedLanguages: ['en'],
          steps: [
            {
              id: 's1',
              type: 'content',
              title: 'Step 1',
              order: 0,
              blocks: [],
              interaction: { type: 'ppe_checklist', requireSupervisorWitness: true }
            }
          ],
          settings: {
            autoPlay: false,
            loopForever: false,
            idleTimeoutSeconds: 60,
            autoReturnHome: true,
            hideNavigation: false,
            disableExit: true,
            security: { protectionType: 'pin' },
            requireSupervisorWitness: true
          },
          publishing: { status: 'published', version: 1 },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          createdBy: 'admin',
          isDeleted: false
        },
        {
          _id: 'jrn_compliance_3',
          organizationId: 'org_enterprise_001',
          title: 'Corporate Code of Conduct & NDA Policy',
          description: 'Annual regulatory compliance and ethics guidelines',
          priority: 2,
          isMandatory: false,
          status: 'published',
          version: 1,
          language: 'en',
          supportedLanguages: ['en'],
          steps: [],
          settings: {
            autoPlay: false,
            loopForever: false,
            idleTimeoutSeconds: 60,
            autoReturnHome: true,
            hideNavigation: false,
            disableExit: true,
            security: { protectionType: 'none' }
          },
          publishing: { status: 'published', version: 1 },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          createdBy: 'admin',
          isDeleted: false
        },
        {
          _id: 'jrn_operations_4',
          organizationId: 'org_enterprise_001',
          title: 'Shift Handover & Machinery Maintenance Log',
          description: 'Standard conveyor operational handover checklist',
          priority: 3,
          isMandatory: false,
          status: 'published',
          version: 1,
          language: 'en',
          supportedLanguages: ['en'],
          steps: [],
          settings: {
            autoPlay: false,
            loopForever: false,
            idleTimeoutSeconds: 60,
            autoReturnHome: true,
            hideNavigation: false,
            disableExit: true,
            security: { protectionType: 'none' }
          },
          publishing: { status: 'published', version: 1 },
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          createdBy: 'admin',
          isDeleted: false
        }
      ]
    };
  });

  describe('Acceptance Criteria 1: 4 Assigned Journeys Render Complete Metadata', () => {
    it('renders all 4 cards with proper titles, duration badges, and start buttons', () => {
      const onLaunchSpy = vi.fn();
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={onLaunchSpy}
        />
      );

      // Verify all 4 journey cards are present
      expect(html).toContain('data-testid="journey-card-jrn_safety_1"');
      expect(html).toContain('data-testid="journey-card-jrn_ppe_2"');
      expect(html).toContain('data-testid="journey-card-jrn_compliance_3"');
      expect(html).toContain('data-testid="journey-card-jrn_operations_4"');

      // Verify titles
      expect(html).toContain('Forklift Safety &amp; Loading Dock Precautions');
      expect(html).toContain('Mandatory PPE Verification Checklist');
      expect(html).toContain('Corporate Code of Conduct &amp; NDA Policy');
      expect(html).toContain('Shift Handover &amp; Machinery Maintenance Log');

      // Verify duration badges
      expect(html).toContain('data-testid="journey-duration-jrn_safety_1"');
      expect(html).toContain('data-testid="journey-duration-jrn_ppe_2"');
      expect(html).toContain('data-testid="journey-duration-jrn_compliance_3"');
      expect(html).toContain('data-testid="journey-duration-jrn_operations_4"');

      // Verify launch buttons
      expect(html).toContain('data-testid="launch-journey-jrn_safety_1"');
      expect(html).toContain('data-testid="launch-journey-jrn_ppe_2"');
      expect(html).toContain('data-testid="launch-journey-jrn_compliance_3"');
      expect(html).toContain('data-testid="launch-journey-jrn_operations_4"');
    });

    it('enforces touch-optimized minimum dimensions and touch target padding', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      // Requirement 1: Cards must have minimum dimensions of 280x200px
      expect(html).toContain('min-w-[280px]');
      expect(html).toContain('min-h-[200px]');
      // Launch buttons have generous minimum touch height
      expect(html).toContain('min-h-[48px]');
    });
  });

  describe('Acceptance Criteria 2: Identify as Employee & Frontline Identification Modal', () => {
    it('renders the "Identify as Employee" action button in the persistent footer', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="identify-employee-button"');
      expect(html).toContain('Identify as Employee');
    });

    it('renders the Emergency Protocol button in the persistent footer', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="emergency-protocol-button"');
      expect(html).toContain('Emergency Protocol');
    });
  });

  describe('Mandatory Requirements & Supervisor Witness Badges', () => {
    it('renders mandatory badge for required journeys', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="mandatory-badge-jrn_safety_1"');
      expect(html).toContain('data-testid="mandatory-badge-jrn_ppe_2"');
      // Journey 3 and 4 are not mandatory
      expect(html).not.toContain('data-testid="mandatory-badge-jrn_compliance_3"');
      expect(html).not.toContain('data-testid="mandatory-badge-jrn_operations_4"');
    });

    it('renders witness badge when supervisor witness is required', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      // Journey 2 requires supervisor witness
      expect(html).toContain('data-testid="witness-badge-jrn_ppe_2"');
      expect(html).toContain('Supervisor Witness Required');
      // Journey 1 does not require supervisor witness
      expect(html).not.toContain('data-testid="witness-badge-jrn_safety_1"');
    });
  });

  describe('Persistent Header & Accessibility Controls', () => {
    it('renders terminal name, physical location, and online status', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="terminal-title"');
      expect(html).toContain('Assembly Bay 3 Terminal');
      expect(html).toContain('data-testid="terminal-location"');
      expect(html).toContain('Building C - Sector 7');
      expect(html).toContain('Online');
    });

    it('renders accessibility controls: high contrast toggle, font scaling, and language switcher', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="language-switcher"');
      expect(html).toContain('data-testid="toggle-high-contrast"');
      expect(html).toContain('data-testid="toggle-font-scale"');
    });
  });

  describe('Category Filtering & Search Filter', () => {
    it('renders category filter tabs with dynamic counts', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="category-tab-all"');
      expect(html).toContain('data-testid="category-tab-safety"');
      expect(html).toContain('data-testid="category-tab-compliance"');
      expect(html).toContain('data-testid="category-tab-operations"');
      expect(html).toContain('data-testid="touch-search-input"');
    });
  });

  describe('Standby State when Zero Journeys Assigned', () => {
    it('renders terminal standby mode when manifest has no assigned journeys', () => {
      const emptyManifest: KioskDeviceManifest = {
        ...mockManifest,
        journeys: []
      };

      const html = renderToString(
        <KioskHomeScreen
          manifest={emptyManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="terminal-empty-standby"');
      expect(html).toContain('Terminal Standby Mode');
    });
  });
});
