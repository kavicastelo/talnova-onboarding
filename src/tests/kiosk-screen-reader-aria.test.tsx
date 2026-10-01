import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// Components & Hooks
import { KioskLiveAnnouncer } from '../features/kiosk/components/accessibility/KioskLiveAnnouncer';
import {
  useKioskKeyboardNavigation,
  handleKioskKeyboardEvent
} from '../features/kiosk/hooks/useKioskKeyboardNavigation';
import { KioskPlayerHeader } from '../features/kiosk/components/KioskPlayerHeader';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KioskActionFooter } from '../features/kiosk/components/KioskActionFooter';
import { AccessibilityToolbar } from '../features/kiosk/components/accessibility/AccessibilityToolbar';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { EmergencyEvacuationOverlay } from '../features/kiosk/components/emergency/EmergencyEvacuationOverlay';

import { KioskDeviceManifest } from '../types/kiosk/device.types';
import { KioskStep } from '../types/kiosk/step.types';
import { KioskEmergency } from '../types/kiosk/emergency.types';

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
    getOrCreateHardwareGuid: vi.fn(async () => 'HW-GUID-ACC-003'),
    getHardwareGuidSync: vi.fn(() => 'HW-GUID-ACC-003'),
    getEmployeeUser: vi.fn(() => ({
      id: 'usr-screen-reader-worker',
      fullName: 'Jordan Bell',
      department: 'Safety'
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

describe('K-ACC-003: Screen Reader ARIA Architecture & Assistive Navigation Suite', () => {
  const sampleStep: KioskStep = {
    id: 'step-confined-space',
    title: 'Confined Space Entry & Atmospheric Air Testing',
    type: 'content',
    order: 0,
    blocks: [
      {
        id: 'blk-text-1',
        type: 'text',
        order: 0,
        mediaReferences: {
          en: { textValue: 'Calibrate multi-gas detector before entering the tunnel sump.' }
        }
      }
    ],
    interaction: {
      type: 'yes_no'
    }
  };

  const sampleManifest: KioskDeviceManifest = {
    deviceId: 'HW-ACC-300',
    organizationId: 'org-mining-corp',
    launchMode: 'launcher',
    journeys: [
      {
        _id: 'jrn-confined-space',
        organizationId: 'org-mining-corp',
        title: 'Confined Space Safety Journey',
        description: 'Atmospheric oxygen and toxic fumes testing standard',
        priority: 0,
        isMandatory: true,
        status: 'published',
        version: 1,
        language: 'en',
        supportedLanguages: ['en'],
        steps: [sampleStep]
      }
    ]
  };

  const sampleEmergency: KioskEmergency = {
    broadcastId: 'emg-broadcast-99',
    type: 'fire',
    severity: 'critical',
    title: 'Active Structural Fire in Smelter Sector 4',
    description: 'Evacuate immediately via North Portal staircase to Muster Point Alpha.',
    musterPoint: 'Muster Point Alpha',
    evacuationRouteId: 'route-north-portal',
    primaryExitName: 'North Exit Gate 2',
    secondaryExitName: 'Emergency Bunker East',
    soundSiren: true,
    sirenPattern: 'hi_lo',
    flashingColor: '#ef4444',
    isActive: true,
    broadcastAt: '2026-10-02T02:00:00.000Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseKioskPlayer.mockReturnValue({
      journey: sampleManifest.journeys[0],
      currentStepIndex: 0,
      currentStep: sampleStep,
      isFirstStep: true,
      isLastStep: false,
      isRevoked: false,
      progressPercentage: 50,
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
      exitJourney: vi.fn()
    });
  });

  // =========================================================================
  // 1. ARIA Live Regions Architecture
  // =========================================================================
  describe('1. ARIA Live Regions Architecture (Polite & Assertive)', () => {
    it('renders polite live region with role="status" and aria-live="polite"', () => {
      const html = renderToString(
        <KioskLiveAnnouncer
          currentStepIndex={0}
          totalSteps={4}
          stepTitle="Confined Space Entry & Atmospheric Air Testing"
        />
      );

      expect(html).toContain('data-testid="kiosk-aria-live-polite"');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain('Screen 1 of 4: Confined Space Entry &amp; Atmospheric Air Testing');
    });

    it('emits deterministic step transition announcement on subsequent steps', () => {
      const html = renderToString(
        <KioskLiveAnnouncer
          currentStepIndex={2}
          totalSteps={5}
          stepTitle="Hazardous Chemical PPE Donning"
        />
      );

      expect(html).toContain('Screen 3 of 5: Hazardous Chemical PPE Donning');
    });

    it('renders assertive live region with role="alert" and aria-live="assertive"', () => {
      const html = renderToString(
        <KioskLiveAnnouncer
          currentStepIndex={0}
          totalSteps={4}
          isEmergency={true}
          emergencyTitle="Flash Toxic Gas Leak in Sector B"
        />
      );

      expect(html).toContain('data-testid="kiosk-aria-live-assertive"');
      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-live="assertive"');
      expect(html).toContain('aria-atomic="true"');
      expect(html).toContain('EMERGENCY PROTOCOL: Flash Toxic Gas Leak in Sector B');
    });

    it('emits assertive safety warning when viewing a warning step', () => {
      const html = renderToString(
        <KioskLiveAnnouncer
          currentStepIndex={1}
          totalSteps={4}
          stepTitle="High Voltage Electric Arc Flash Zone"
          isWarning={true}
        />
      );

      expect(html).toContain('SAFETY WARNING: High Voltage Electric Arc Flash Zone');
    });

    it('emits assertive security alert when client tampering is detected', () => {
      const html = renderToString(
        <KioskLiveAnnouncer
          currentStepIndex={0}
          totalSteps={4}
          tamperingDetected={true}
        />
      );

      expect(html).toContain('SECURITY ALERT: Unauthorized client-side modification detected');
    });

    it('includes sr-only class so announcements are audible to screen readers without visual clutter', () => {
      const html = renderToString(
        <KioskLiveAnnouncer
          currentStepIndex={0}
          totalSteps={3}
          stepTitle="Introduction"
        />
      );

      expect(html).toContain('sr-only');
    });
  });

  // =========================================================================
  // 2. Semantic HTML5 Landmarks
  // =========================================================================
  describe('2. Semantic HTML5 Landmarks', () => {
    it('verifies KioskPlayerHeader possesses role="banner"', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Electrical Lockout Standard"
          category="Safety"
        />
      );

      expect(html).toContain('role="banner"');
      expect(html).toContain('data-testid="kiosk-player-header"');
    });

    it('verifies KioskStepContainer possesses role="main"', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleStep}
          stepIndex={0}
          selectedLanguage="en"
        />
      );

      expect(html).toContain('role="main"');
      expect(html).toContain('data-testid="kiosk-step-container"');
    });

    it('verifies KioskActionFooter possesses role="contentinfo"', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={0}
          totalSteps={3}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
        />
      );

      expect(html).toContain('role="contentinfo"');
      expect(html).toContain('data-testid="kiosk-action-footer"');
    });

    it('verifies AccessibilityToolbar possesses role="navigation"', () => {
      const html = renderToString(
        <AccessibilityToolbar
          highContrast={false}
          onToggleHighContrast={vi.fn()}
        />
      );

      expect(html).toContain('role="navigation"');
      expect(html).toContain('data-testid="kiosk-accessibility-toolbar"');
    });

    it('verifies EmergencyEvacuationOverlay possesses role="alert" and aria-live="assertive"', () => {
      const html = renderToString(
        <EmergencyEvacuationOverlay
          emergency={sampleEmergency}
        />
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-live="assertive"');
    });
  });

  // =========================================================================
  // 3. Visible Focus Indicators
  // =========================================================================
  describe('3. Visible Focus Ring Indicators', () => {
    it('ensures primary navigation buttons possess explicit focus-visible ring classes', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={3}
          canGoBack={true}
          canGoNext={true}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
        />
      );

      expect(html).toContain('focus-visible:outline-4');
      expect(html).toContain('focus-visible:outline-sky-500');
      expect(html).toContain('focus-visible:ring-4');
      expect(html).toContain('focus-visible:ring-sky-500/30');
    });

    it('ensures AccessibilityToolbar buttons possess focus-visible ring classes', () => {
      const html = renderToString(
        <AccessibilityToolbar
          highContrast={false}
          onToggleHighContrast={vi.fn()}
          showSubtitles={true}
          onToggleSubtitles={vi.fn()}
          fontScale={100}
          onFontScaleChange={vi.fn()}
        />
      );

      expect(html).toContain('focus-visible:outline-4');
      expect(html).toContain('focus-visible:outline-sky-500');
      expect(html).toContain('focus-visible:ring-4');
    });

    it('ensures decision buttons in KioskStepContainer possess focus-visible ring classes', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleStep}
          stepIndex={0}
          selectedLanguage="en"
          onYesNoSelection={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="yes-btn"');
      expect(html).toContain('focus-visible:outline-4');
      expect(html).toContain('focus-visible:outline-sky-500');
    });
  });

  // =========================================================================
  // 4. Assistive Switch Device & Keyboard Navigation Hook
  // =========================================================================
  describe('4. Assistive Switch Device & Keyboard Navigation Hook', () => {
    it('advances on ArrowRight and Space keys when canGoNext is true', () => {
      const onNext = vi.fn();
      const preventDefault = vi.fn();

      // Trigger ArrowRight
      handleKioskKeyboardEvent(
        { key: 'ArrowRight', target: { tagName: 'BUTTON' }, preventDefault },
        { canGoNext: true, onNext }
      );
      expect(onNext).toHaveBeenCalledTimes(1);

      // Trigger Space
      handleKioskKeyboardEvent(
        { key: ' ', target: { tagName: 'BODY' }, preventDefault },
        { canGoNext: true, onNext }
      );
      expect(preventDefault).toHaveBeenCalled();
      expect(onNext).toHaveBeenCalledTimes(2);
    });

    it('does not advance on ArrowRight/Space if canGoNext is false', () => {
      const onNext = vi.fn();

      handleKioskKeyboardEvent(
        { key: 'ArrowRight', target: { tagName: 'BUTTON' } },
        { canGoNext: false, onNext }
      );
      expect(onNext).not.toHaveBeenCalled();

      handleKioskKeyboardEvent(
        { key: ' ', target: { tagName: 'BUTTON' } },
        { canGoNext: false, onNext }
      );
      expect(onNext).not.toHaveBeenCalled();
    });

    it('navigates backward on ArrowLeft key when canGoBack is true', () => {
      const onPrev = vi.fn();

      handleKioskKeyboardEvent(
        { key: 'ArrowLeft', target: { tagName: 'DIV' } },
        { canGoBack: true, onPrev }
      );
      expect(onPrev).toHaveBeenCalledTimes(1);

      // When canGoBack is false
      handleKioskKeyboardEvent(
        { key: 'ArrowLeft', target: { tagName: 'DIV' } },
        { canGoBack: false, onPrev }
      );
      expect(onPrev).toHaveBeenCalledTimes(1); // Still 1
    });

    it('dispatches Yes (1) and No (2) on yes_no interaction steps', () => {
      const onYesNo = vi.fn();

      // Press '1' -> Yes (true)
      handleKioskKeyboardEvent(
        { key: '1', target: { tagName: 'DIV' } },
        { onYesNo }
      );
      expect(onYesNo).toHaveBeenCalledWith(true);

      // Press '2' -> No (false)
      handleKioskKeyboardEvent(
        { key: '2', target: { tagName: 'DIV' } },
        { onYesNo }
      );
      expect(onYesNo).toHaveBeenCalledWith(false);
    });

    it('dispatches numbered options 1-9 to zero-indexed onOptionSelect handler', () => {
      const onOptionSelect = vi.fn();

      // Press '3' -> option index 2
      handleKioskKeyboardEvent(
        { key: '3', target: { tagName: 'DIV' } },
        { onOptionSelect }
      );
      expect(onOptionSelect).toHaveBeenCalledWith(2);

      // Press '1' -> option index 0
      handleKioskKeyboardEvent(
        { key: '1', target: { tagName: 'DIV' } },
        { onOptionSelect }
      );
      expect(onOptionSelect).toHaveBeenCalledWith(0);
    });

    it('cancels modal when Escape is pressed while a modal is open', () => {
      const onCancelModal = vi.fn();

      handleKioskKeyboardEvent(
        { key: 'Escape', target: { tagName: 'INPUT' } },
        { isModalOpen: true, onCancelModal }
      );
      expect(onCancelModal).toHaveBeenCalledTimes(1);

      // If modal is not open, Escape should not trigger modal cancel
      handleKioskKeyboardEvent(
        { key: 'Escape', target: { tagName: 'DIV' } },
        { isModalOpen: false, onCancelModal }
      );
      expect(onCancelModal).toHaveBeenCalledTimes(1); // Still 1
    });

    it('does not intercept regular typing when user is focused inside an input element', () => {
      const onNext = vi.fn();
      const onOptionSelect = vi.fn();

      // Space inside input
      handleKioskKeyboardEvent(
        { key: ' ', target: { tagName: 'INPUT' } },
        { canGoNext: true, onNext, onOptionSelect }
      );
      expect(onNext).not.toHaveBeenCalled();

      // Number 5 inside input
      handleKioskKeyboardEvent(
        { key: '5', target: { tagName: 'INPUT' } },
        { canGoNext: true, onNext, onOptionSelect }
      );
      expect(onOptionSelect).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. Full Player & Launcher ARIA Integration
  // =========================================================================
  describe('5. Full Player & Launcher Integration', () => {
    it('renders KioskPlayer with embedded KioskLiveAnnouncer announcing step information', () => {
      const html = renderToString(
        <KioskPlayer
          manifest={sampleManifest}
          onExit={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="kiosk-live-announcer"');
      expect(html).toContain('data-testid="kiosk-aria-live-polite"');
      expect(html).toContain('Screen 1 of 1: Confined Space Entry &amp; Atmospheric Air Testing');
      expect(html).toContain('role="banner"');
      expect(html).toContain('role="main"');
      expect(html).toContain('role="contentinfo"');
    });

    it('renders KioskHomeScreen with embedded KioskLiveAnnouncer announcing available briefings', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={sampleManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="kiosk-live-announcer"');
      expect(html).toContain('Terminal Launcher: 1 safety briefings available.');
      expect(html).toContain('role="banner"');
      expect(html).toContain('role="main"');
      expect(html).toContain('role="contentinfo"');
    });
  });
});
