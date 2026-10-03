import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import axe from 'axe-core';
import { JSDOM } from 'jsdom';

// Screens & Modals under audit
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';
import { KioskPairingScreen } from '../features/kiosk/components/KioskPairingScreen';
import { FrontlineIdentifyModal } from '../features/kiosk/components/auth/FrontlineIdentifyModal';
import { SupervisorWitnessGateModal } from '../features/kiosk/components/auth/SupervisorWitnessGateModal';
import { AccessibilityToolbar } from '../features/kiosk/components/accessibility/AccessibilityToolbar';

import { KioskDeviceManifest } from '../types/kiosk/device.types';
import { KioskStep } from '../types/kiosk/step.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => ({
  deviceIdentityService: {
    isRevoked: vi.fn(() => false),
    clearRevocationStatus: vi.fn(),
    getOrCreateHardwareGuid: vi.fn(async () => 'HW-GUID-AXE-001'),
    getHardwareGuidSync: vi.fn(() => 'HW-GUID-AXE-001'),
    getEmployeeUser: vi.fn(() => ({
      id: 'usr-axe-worker',
      fullName: 'Alex Vance',
      firstName: 'Alex',
      lastName: 'Vance',
      department: 'Heavy Manufacturing'
    })),
    setEmployeeSession: vi.fn(),
    clearEmployeeSession: vi.fn(),
    setDeviceCredentials: vi.fn()
  }
}));

// Mock useKioskPlayer context hook
const mockUseKioskPlayer = vi.fn();
vi.mock('../features/kiosk/context/KioskPlayerContext', () => ({
  useKioskPlayer: () => mockUseKioskPlayer(),
  KioskPlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock kioskLockdownService
vi.mock('../features/kiosk/services/kiosk-lockdown.service', () => ({
  kioskLockdownService: {
    startLockdown: vi.fn(),
    stopLockdown: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    requestFullscreen: vi.fn()
  }
}));

// Mock emergencyService
vi.mock('../features/kiosk/services/emergency.service', () => ({
  emergencyService: {
    getActiveEmergency: vi.fn(() => null),
    subscribe: vi.fn(() => () => {}),
    getSiren: vi.fn(() => ({
      getIsMuted: () => false,
      toggleMute: () => true
    }))
  }
}));

// Mock kioskCommandExecutorService
vi.mock('../features/kiosk/services/kiosk-command-executor.service', () => ({
  kioskCommandExecutorService: {
    isInMaintenance: vi.fn(() => false),
    getMaintenanceDetails: vi.fn(() => ({ payload: null })),
    onMaintenanceChange: vi.fn(() => () => {}),
    onManifestReload: vi.fn(() => () => {})
  }
}));

// Mock privacyResetService
vi.mock('../features/kiosk/services/privacy-reset.service', () => ({
  privacyResetService: {
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    recordActivity: vi.fn()
  }
}));

// Helper to audit a rendered React element with axe-core in JSDOM
async function auditWithAxe(
  component: React.ReactElement,
  options: { title?: string; pageRole?: string } = {}
) {
  const html = renderToString(component);
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${options.title || 'Talnova Kiosk Terminal'}</title>
</head>
<body class="bg-slate-950 text-white">
  <main id="kiosk-main-landmark" role="${options.pageRole || 'main'}">
    ${html}
  </main>
</body>
</html>`;

  const dom = new JSDOM(fullHtml, {
    url: 'http://localhost/kiosk',
    pretendToBeVisual: true
  });

  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document as any;
  globalThis.Node = dom.window.Node as any;
  globalThis.Element = dom.window.Element as any;
  globalThis.HTMLElement = dom.window.HTMLElement as any;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement as any;
  globalThis.HTMLButtonElement = dom.window.HTMLButtonElement as any;
  globalThis.localStorage = dom.window.localStorage as any;

  const results = await axe.run(dom.window.document.body, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag22aa']
    },
    rules: {
      // In JSDOM, visual layout and stylesheet computation is synthetic;
      // axe color-contrast requires a full browser compositor unless computed.
      'color-contrast': { enabled: false }
    }
  });

  const criticalOrSerious = results.violations.filter((v) =>
    ['critical', 'serious'].includes(v.impact || '')
  );

  return { results, violations: results.violations, criticalOrSerious };
}

describe('K-VAL-003: Automated Axe-Core WCAG 2.2 AA Kiosk Accessibility Audit Suite', () => {
  const standardStep: KioskStep = {
    id: 'step-standard-01',
    title: 'High-Voltage Safety Briefing',
    type: 'content',
    order: 0,
    blocks: [
      {
        id: 'blk-text-1',
        type: 'text',
        order: 0,
        mediaReferences: {
          en: { textValue: 'Always wear dielectric gloves when operating substation disconnect switches.' }
        }
      }
    ],
    interaction: {
      type: 'tap_to_continue'
    }
  };

  const videoStep: KioskStep = {
    id: 'step-video-02',
    title: 'Arc Flash Shield Deployment Video',
    type: 'content',
    order: 1,
    blocks: [
      {
        id: 'blk-vid-1',
        type: 'video',
        order: 0,
        content: {
          videoUrl: 'https://cdn.talnova.com/videos/arc-flash-demo.mp4',
          title: 'Arc Flash Shield Demonstration Video',
          captionsUrl: 'https://cdn.talnova.com/captions/arc-flash.vtt'
        }
      }
    ],
    interaction: {
      type: 'tap_to_continue'
    }
  };

  const ppeChecklistStep: KioskStep = {
    id: 'step-ppe-03',
    title: 'Mandatory PPE Verification Checklist',
    type: 'checklist',
    order: 2,
    blocks: [
      {
        id: 'blk-ppe-1',
        type: 'checklist',
        order: 0,
        items: [
          { id: 'ppe-helmet', text: 'Dielectric Hardhat with Chin Strap', isChecked: false, isRequired: true },
          { id: 'ppe-gloves', text: 'Class 4 Insulated High-Voltage Gloves', isChecked: false, isRequired: true },
          { id: 'ppe-visor', text: 'Arc-Rated Face Shield (40 cal/cm²)', isChecked: false, isRequired: true }
        ]
      }
    ],
    interaction: {
      type: 'tap_to_continue'
    }
  };

  const sampleManifest: KioskDeviceManifest = {
    deviceId: 'HW-GUID-AXE-001',
    organizationId: 'org-titan-energy',
    device: {
      _id: 'dev-titan-001',
      deviceId: 'HW-GUID-AXE-001',
      name: 'North Substation Kiosk Terminal',
      location: 'Substation Yard East',
      status: 'online'
    },
    launchMode: 'launcher',
    journeys: [
      {
        _id: 'jrn-hv-safety',
        organizationId: 'org-titan-energy',
        title: 'Substation High-Voltage Switching Safety',
        description: 'Mandatory safety protocol before switching 230kV disconnect breakers.',
        priority: 0,
        isMandatory: true,
        status: 'published',
        version: 1,
        language: 'en',
        supportedLanguages: ['en'],
        steps: [standardStep, videoStep, ppeChecklistStep]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. KioskHomeScreen Screen Audit
  // =========================================================================
  describe('Screen 1: KioskHomeScreen Launcher', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations', async () => {
      const { violations, criticalOrSerious } = await auditWithAxe(
        <KioskHomeScreen
          manifest={sampleManifest}
          onSelectJourney={vi.fn()}
          onOpenIdentify={vi.fn()}
          onOpenToolbar={vi.fn()}
          onPairDevice={vi.fn()}
        />,
        { title: 'Substation Safety Kiosk Launcher' }
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. KioskPlayer: Standard Step
  // =========================================================================
  describe('Screen 2: KioskPlayer (Standard Content Step)', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations on standard step', async () => {
      mockUseKioskPlayer.mockReturnValue({
        journey: sampleManifest.journeys[0],
        currentStepIndex: 0,
        currentStep: standardStep,
        isFirstStep: true,
        isLastStep: false,
        isRevoked: false,
        progressPercentage: 33,
        selectedLanguage: 'en',
        highContrast: false,
        fontScale: 100,
        isMuted: false,
        showSubtitles: false,
        isLoading: false,
        error: null,
        tamperingDetected: false,
        completedSteps: new Set<string>(),
        goToNextStep: vi.fn(),
        goToPrevStep: vi.fn(),
        setLanguage: vi.fn(),
        changeLanguage: vi.fn(),
        setStepIndex: vi.fn(),
        nextStep: vi.fn(),
        prevStep: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        toggleHighContrast: vi.fn(),
        resetTamperingState: vi.fn(),
        startSession: vi.fn(),
        recordInteraction: vi.fn(),
        completeSession: vi.fn(),
        abortSession: vi.fn(),
        recordPpeCompliance: vi.fn(),
        exitJourney: vi.fn(),
        loadJourney: vi.fn()
      });

      const { violations, criticalOrSerious } = await auditWithAxe(
        <KioskPlayer journeyId="jrn-hv-safety" onExit={vi.fn()} />
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. KioskPlayer: Video Step
  // =========================================================================
  describe('Screen 3: KioskPlayer (Video Step with Accessible Captions & Controls)', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations on video step', async () => {
      mockUseKioskPlayer.mockReturnValue({
        journey: sampleManifest.journeys[0],
        currentStepIndex: 1,
        currentStep: videoStep,
        isFirstStep: false,
        isLastStep: false,
        isRevoked: false,
        progressPercentage: 66,
        selectedLanguage: 'en',
        highContrast: false,
        fontScale: 100,
        isMuted: false,
        showSubtitles: true,
        isLoading: false,
        error: null,
        tamperingDetected: false,
        completedSteps: new Set(['step-standard-01']),
        goToNextStep: vi.fn(),
        goToPrevStep: vi.fn(),
        setLanguage: vi.fn(),
        changeLanguage: vi.fn(),
        setStepIndex: vi.fn(),
        nextStep: vi.fn(),
        prevStep: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        toggleHighContrast: vi.fn(),
        resetTamperingState: vi.fn(),
        startSession: vi.fn(),
        recordInteraction: vi.fn(),
        completeSession: vi.fn(),
        abortSession: vi.fn(),
        recordPpeCompliance: vi.fn(),
        exitJourney: vi.fn(),
        loadJourney: vi.fn()
      });

      const { violations, criticalOrSerious } = await auditWithAxe(
        <KioskPlayer journeyId="jrn-hv-safety" onExit={vi.fn()} />
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. KioskPlayer: PPE Checklist Step
  // =========================================================================
  describe('Screen 4: KioskPlayer (PPE Checklist Step)', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations on PPE checklist step', async () => {
      mockUseKioskPlayer.mockReturnValue({
        journey: sampleManifest.journeys[0],
        currentStepIndex: 2,
        currentStep: ppeChecklistStep,
        isFirstStep: false,
        isLastStep: true,
        isRevoked: false,
        progressPercentage: 100,
        selectedLanguage: 'en',
        highContrast: false,
        fontScale: 100,
        isMuted: false,
        showSubtitles: false,
        isLoading: false,
        error: null,
        tamperingDetected: false,
        completedSteps: new Set(['step-standard-01', 'step-video-02']),
        goToNextStep: vi.fn(),
        goToPrevStep: vi.fn(),
        setLanguage: vi.fn(),
        changeLanguage: vi.fn(),
        setStepIndex: vi.fn(),
        nextStep: vi.fn(),
        prevStep: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        toggleHighContrast: vi.fn(),
        resetTamperingState: vi.fn(),
        startSession: vi.fn(),
        recordInteraction: vi.fn(),
        completeSession: vi.fn(),
        abortSession: vi.fn(),
        recordPpeCompliance: vi.fn(),
        exitJourney: vi.fn(),
        loadJourney: vi.fn()
      });

      const { violations, criticalOrSerious } = await auditWithAxe(
        <KioskPlayer journeyId="jrn-hv-safety" onExit={vi.fn()} />
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 5. KioskPlayer: Completion Gate Screen
  // =========================================================================
  describe('Screen 5: KioskPlayer (Completion Gate & Certification Screen)', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations on completion screen', async () => {
      mockUseKioskPlayer.mockReturnValue({
        journey: sampleManifest.journeys[0],
        currentStepIndex: 2,
        currentStep: ppeChecklistStep,
        isFirstStep: false,
        isLastStep: true,
        isRevoked: false,
        progressPercentage: 100,
        selectedLanguage: 'en',
        highContrast: false,
        fontScale: 100,
        isMuted: false,
        showSubtitles: false,
        isLoading: false,
        error: null,
        tamperingDetected: false,
        completedSteps: new Set(['step-standard-01', 'step-video-02', 'step-ppe-03']),
        goToNextStep: vi.fn(),
        goToPrevStep: vi.fn(),
        setLanguage: vi.fn(),
        changeLanguage: vi.fn(),
        setStepIndex: vi.fn(),
        nextStep: vi.fn(),
        prevStep: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        toggleHighContrast: vi.fn(),
        resetTamperingState: vi.fn(),
        startSession: vi.fn(),
        recordInteraction: vi.fn(),
        completeSession: vi.fn(),
        abortSession: vi.fn(),
        recordPpeCompliance: vi.fn(),
        exitJourney: vi.fn(),
        loadJourney: vi.fn()
      });

      const { violations, criticalOrSerious } = await auditWithAxe(
        <KioskPlayer journeyId="jrn-hv-safety" onExit={vi.fn()} initialCompleted={true} />
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. KioskPairingScreen Screen Audit
  // =========================================================================
  describe('Screen 6: KioskPairingScreen Terminal Provisioning', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations', async () => {
      const { violations, criticalOrSerious } = await auditWithAxe(
        <KioskPairingScreen onPairSuccess={vi.fn()} />,
        { title: 'Kiosk Terminal Pairing & Provisioning' }
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 7. FrontlineIdentifyModal Modal Audit
  // =========================================================================
  describe('Screen 7: FrontlineIdentifyModal Badge & Keypad Dialog', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations', async () => {
      const { violations, criticalOrSerious } = await auditWithAxe(
        <FrontlineIdentifyModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          kioskDeviceId="HW-GUID-AXE-001"
        />,
        { title: 'Frontline Worker Identification' }
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 8. SupervisorWitnessGateModal Modal Audit
  // =========================================================================
  describe('Screen 8: SupervisorWitnessGateModal Dual-Custody Attestation Dialog', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations', async () => {
      const { violations, criticalOrSerious } = await auditWithAxe(
        <SupervisorWitnessGateModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          sessionId="sess-test-axe-001"
          organizationId="org-titan-energy"
        />,
        { title: 'Supervisor Attestation Sign-off' }
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });

  // =========================================================================
  // 9. AccessibilityToolbar Component Audit
  // =========================================================================
  describe('Screen 9: AccessibilityToolbar Assistive Controls', () => {
    it('passes axe-core audit with 0 WCAG 2.2 AA violations in standard mode', async () => {
      const { violations, criticalOrSerious } = await auditWithAxe(
        <AccessibilityToolbar
          highContrast={false}
          onToggleHighContrast={vi.fn()}
          fontScale={100}
          onFontScaleChange={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
          showSubtitlesToggle={true}
          showQuickZoomButtons={true}
        />
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });

    it('passes axe-core audit with 0 WCAG 2.2 AA violations in high contrast mode', async () => {
      const { violations, criticalOrSerious } = await auditWithAxe(
        <AccessibilityToolbar
          highContrast={true}
          onToggleHighContrast={vi.fn()}
          fontScale={150}
          onFontScaleChange={vi.fn()}
          showSubtitles={true}
          onToggleSubtitles={vi.fn()}
          showSubtitlesToggle={true}
          showQuickZoomButtons={true}
        />
      );

      expect(criticalOrSerious).toHaveLength(0);
      expect(violations).toHaveLength(0);
    });
  });
});
