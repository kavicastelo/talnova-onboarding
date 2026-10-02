import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KioskActionFooter } from '../features/kiosk/components/KioskActionFooter';
import { KioskPlayerHeader } from '../features/kiosk/components/KioskPlayerHeader';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { KioskDeviceManifest } from '../types/kiosk/device.types';
import { KioskJourney } from '../types/kiosk/journey.types';
import { KioskStep } from '../types/kiosk/step.types';
import {
  WORKFORCE_LANGUAGES,
  WORKFORCE_LANGUAGE_MAP,
  isRtlLanguage,
  getLanguageDirection,
  RTL_LANGUAGES
} from '../features/kiosk/constants/language.constants';

// Mock react-i18next
let activeMockLanguage = 'en';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options?.defaultValue) return options.defaultValue;
      return key;
    },
    i18n: {
      get language() {
        return activeMockLanguage;
      },
      changeLanguage: vi.fn((lang: string) => {
        activeMockLanguage = lang;
      })
    }
  })
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => ({
  deviceIdentityService: {
    isRevoked: vi.fn(() => false),
    clearRevocationStatus: vi.fn(),
    getOrCreateHardwareGuid: vi.fn(async () => 'HW-RTL-001'),
    getHardwareGuidSync: vi.fn(() => 'HW-RTL-001'),
    getEmployeeUser: vi.fn(() => null),
    setEmployeeSession: vi.fn(),
    clearEmployeeSession: vi.fn(),
    setDeviceCredentials: vi.fn()
  }
}));

// Mock useBarcodeScanner
vi.mock('../features/kiosk/hooks/useBarcodeScanner', () => ({
  useBarcodeScanner: vi.fn()
}));

// Mock useKioskPlayer context hook
const mockUseKioskPlayer = vi.fn();
vi.mock('../features/kiosk/context/KioskPlayerContext', () => ({
  useKioskPlayer: () => mockUseKioskPlayer(),
  KioskPlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const mockManifest: KioskDeviceManifest = {
  deviceId: 'kiosk-rtl-terminal',
  organizationId: 'org-test',
  device: {
    name: 'RTL Terminal Hub 1',
    location: 'Assembly Area 3',
    status: 'online',
    lastHeartbeat: new Date().toISOString()
  },
  journeys: [
    {
      _id: 'journey-rtl-01',
      title: 'Chemical Safety Handling',
      description: 'Hazard identification and eyewash station procedures.',
      organizationId: 'org-test',
      languages: ['en', 'ar', 'he', 'ur'],
      isMandatory: true,
      category: 'safety',
      steps: [],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        autoReturnHome: true,
        hideNavigation: false,
        disableExit: false,
        security: { protectionType: 'open' }
      },
      publishing: {
        status: 'published',
        version: 1,
        publishedAt: new Date().toISOString()
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'admin',
      isDeleted: false
    }
  ],
  syncedAt: new Date().toISOString(),
  serverTime: new Date().toISOString()
};

const sampleJourney: KioskJourney = {
  _id: 'journey-rtl-active',
  title: 'Hazard Briefing (RTL)',
  organizationId: 'org-test',
  languages: ['en', 'ar', 'he', 'ur'],
  isMandatory: true,
  category: 'safety',
  steps: [
    {
      id: 'step-1',
      title: 'Safety Overview',
      type: 'content',
      order: 0,
      blocks: [
        {
          id: 'b1',
          type: 'text',
          order: 0,
          mediaReferences: {
            en: { textValue: 'Welcome to safety training.' },
            ar: { textValue: 'مرحبًا بك في التدريب على السلامة.' }
          }
        }
      ],
      interaction: { type: 'tap_to_continue' }
    },
    {
      id: 'step-2',
      title: 'PPE Verification',
      type: 'content',
      order: 1,
      blocks: [
        {
          id: 'b2',
          type: 'text',
          order: 0,
          mediaReferences: {
            en: { textValue: 'Put on required PPE.' },
            ar: { textValue: 'ارتدِ معدات الوقاية الشخصية المطلوبة.' }
          }
        }
      ],
      interaction: { type: 'tap_to_continue' }
    }
  ],
  settings: {
    autoPlay: false,
    loopForever: false,
    idleTimeoutSeconds: 60,
    autoReturnHome: true,
    hideNavigation: false,
    disableExit: false,
    security: { protectionType: 'open' }
  },
  publishing: {
    status: 'published',
    version: 1,
    publishedAt: new Date().toISOString()
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'admin',
  isDeleted: false
};

describe('K-LOC-002: Right-to-Left (RTL) Layout Engine Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeMockLanguage = 'en';
  });

  describe('1. RTL Language Detection & Locale Mapping', () => {
    it('accurately identifies RTL locales: Arabic (ar), Hebrew (he), and Urdu (ur)', () => {
      expect(isRtlLanguage('ar')).toBe(true);
      expect(isRtlLanguage('he')).toBe(true);
      expect(isRtlLanguage('ur')).toBe(true);
    });

    it('accurately identifies LTR locales as non-RTL', () => {
      expect(isRtlLanguage('en')).toBe(false);
      expect(isRtlLanguage('es')).toBe(false);
      expect(isRtlLanguage('fr')).toBe(false);
      expect(isRtlLanguage('de')).toBe(false);
      expect(isRtlLanguage('hi')).toBe(false);
      expect(isRtlLanguage('zh')).toBe(false);
      expect(isRtlLanguage(undefined)).toBe(false);
      expect(isRtlLanguage('')).toBe(false);
    });

    it('returns correct direction via getLanguageDirection', () => {
      expect(getLanguageDirection('ar')).toBe('rtl');
      expect(getLanguageDirection('he')).toBe('rtl');
      expect(getLanguageDirection('ur')).toBe('rtl');
      expect(getLanguageDirection('en')).toBe('ltr');
      expect(getLanguageDirection('es')).toBe('ltr');
      expect(getLanguageDirection(undefined)).toBe('ltr');
    });

    it('includes Hebrew and Urdu in WORKFORCE_LANGUAGES with RTL direction', () => {
      const hebrew = WORKFORCE_LANGUAGE_MAP['he'];
      const urdu = WORKFORCE_LANGUAGE_MAP['ur'];
      const arabic = WORKFORCE_LANGUAGE_MAP['ar'];

      expect(hebrew).toBeDefined();
      expect(hebrew.direction).toBe('rtl');
      expect(hebrew.autonym).toBe('עברית');

      expect(urdu).toBeDefined();
      expect(urdu.direction).toBe('rtl');
      expect(urdu.autonym).toBe('اردو');

      expect(arabic).toBeDefined();
      expect(arabic.direction).toBe('rtl');
      expect(arabic.autonym).toBe('العربية');
    });
  });

  describe('2. KioskActionFooter Acceptance Criteria: RTL Navigation Inversion & Mirrored Chevrons', () => {
    it('Acceptance Criteria: Given Arabic language selected, Next is on bottom left and Back is on bottom right with mirrored arrow icons', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={4}
          canGoBack={true}
          canGoNext={true}
          isLastStep={false}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
          selectedLanguage="ar"
        />
      );

      // 1. Container has dir="rtl"
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('data-dir="rtl"');

      // 2. Next button is positioned on the bottom left (data-position="bottom-left")
      expect(html).toContain('id="kiosk-btn-next"');
      expect(html).toContain('data-position="bottom-left"');

      // 3. Back button is positioned on the bottom right (data-position="bottom-right")
      expect(html).toContain('id="kiosk-btn-prev"');
      expect(html).toContain('data-position="bottom-right"');

      // 4. Mirrored arrow icons:
      // In RTL, Next points LEFT (ArrowLeft) and Back points RIGHT (ArrowRight)
      expect(html).toContain('data-testid="next-arrow-icon"');
      expect(html).toContain('data-testid="back-arrow-icon"');

      // 5. In RTL slot hierarchy: Back is inside footer-right-slot, Next is inside footer-left-slot
      const rightSlotIndex = html.indexOf('data-testid="footer-right-slot"');
      const leftSlotIndex = html.indexOf('data-testid="footer-left-slot"');
      const backBtnIndex = html.indexOf('id="kiosk-btn-prev"');
      const nextBtnIndex = html.indexOf('id="kiosk-btn-next"');

      // footer-right-slot appears first in DOM order for natural RTL flow (right side of screen)
      expect(rightSlotIndex).toBeLessThan(leftSlotIndex);
      expect(backBtnIndex).toBeGreaterThan(rightSlotIndex);
      expect(backBtnIndex).toBeLessThan(leftSlotIndex);
      expect(nextBtnIndex).toBeGreaterThan(leftSlotIndex);
    });

    it('LTR standard layout: Given English selected, Next is on bottom right and Back is on bottom left', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={4}
          canGoBack={true}
          canGoNext={true}
          isLastStep={false}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
          selectedLanguage="en"
        />
      );

      // Container has dir="ltr"
      expect(html).toContain('dir="ltr"');
      expect(html).toContain('data-dir="ltr"');

      // In LTR: Next is on bottom right, Back is on bottom left
      expect(html).toContain('id="kiosk-btn-next"');
      expect(html).toContain('data-position="bottom-right"');
      expect(html).toContain('id="kiosk-btn-prev"');
      expect(html).toContain('data-position="bottom-left"');
    });

    it('positions Finish button on the bottom left in RTL mode on the final step', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={3}
          totalSteps={4}
          canGoBack={true}
          canGoNext={true}
          isLastStep={true}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
          selectedLanguage="ar"
        />
      );

      expect(html).toContain('id="kiosk-btn-finish"');
      expect(html).toContain('data-position="bottom-left"');
    });

    it('mirrors navigation directions when Hebrew (he) or Urdu (ur) is active', () => {
      const htmlHebrew = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={3}
          canGoBack={true}
          canGoNext={true}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
          selectedLanguage="he"
        />
      );
      expect(htmlHebrew).toContain('dir="rtl"');
      expect(htmlHebrew).toContain('data-position="bottom-left"');
      expect(htmlHebrew).toContain('data-position="bottom-right"');

      const htmlUrdu = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={3}
          canGoBack={true}
          canGoNext={true}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
          selectedLanguage="ur"
        />
      );
      expect(htmlUrdu).toContain('dir="rtl"');
      expect(htmlUrdu).toContain('data-position="bottom-left"');
      expect(htmlUrdu).toContain('data-position="bottom-right"');
    });

    it('ensures Hold-to-Confirm progress fill bar anchors to the right (right-0) in RTL mode', () => {
      const htmlRtl = renderToString(
        <KioskActionFooter
          currentStepIndex={0}
          totalSteps={2}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
          isHoldToConfirm={true}
          holdProgress={45}
          selectedLanguage="ar"
        />
      );

      expect(htmlRtl).toContain('data-testid="kiosk-btn-hold"');
      expect(htmlRtl).toContain('data-position="bottom-left"');
      expect(htmlRtl).toContain('data-testid="hold-progress-fill"');
      expect(htmlRtl).toContain('right-0');

      const htmlLtr = renderToString(
        <KioskActionFooter
          currentStepIndex={0}
          totalSteps={2}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
          isHoldToConfirm={true}
          holdProgress={45}
          selectedLanguage="en"
        />
      );

      expect(htmlLtr).toContain('data-testid="hold-progress-fill"');
      expect(htmlLtr).toContain('left-0');
    });
  });

  describe('3. KioskPlayerHeader RTL Progress Bar & Shell Layout', () => {
    it('renders header with dir="rtl" and animates progress bar from right in RTL mode', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Forklift Daily Inspection"
          currentStepIndex={1}
          totalSteps={4}
          selectedLanguage="ar"
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
        />
      );

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('data-dir="rtl"');
      expect(html).toContain('data-testid="kiosk-progress-bar"');
      expect(html).toContain('float-right');
      expect(html).toContain('data-rtl="true"');
    });

    it('renders header with dir="ltr" and animates progress bar from left in LTR mode', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Forklift Daily Inspection"
          currentStepIndex={1}
          totalSteps={4}
          selectedLanguage="en"
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
        />
      );

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('data-dir="ltr"');
      expect(html).toContain('data-testid="kiosk-progress-bar"');
      expect(html).toContain('float-left');
      expect(html).toContain('data-rtl="false"');
    });
  });

  describe('4. KioskStepContainer RTL Canvas & Transitions', () => {
    const mockStep: KioskStep = {
      id: 'step-test-rtl',
      title: 'Hazard Identification Protocol',
      type: 'content',
      order: 0,
      blocks: [
        {
          id: 'b-txt',
          type: 'text',
          order: 0,
          mediaReferences: {
            en: { textValue: 'Ensure chemical apron is secure.' },
            ar: { textValue: 'تأكد من تأمين مريلة المواد الكيميائية.' }
          }
        }
      ],
      interaction: { type: 'tap_to_continue' }
    };

    it('renders step canvas with dir="rtl" and inverted slide-in transition in RTL mode', () => {
      const html = renderToString(
        <KioskStepContainer
          step={mockStep}
          stepIndex={0}
          direction="forward"
          selectedLanguage="ar"
        />
      );

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('data-dir="rtl"');
      expect(html).toContain('data-rtl="true"');
      expect(html).toContain('animate-slide-in-left');
    });

    it('renders step canvas with dir="ltr" and standard slide-in transition in LTR mode', () => {
      const html = renderToString(
        <KioskStepContainer
          step={mockStep}
          stepIndex={0}
          direction="forward"
          selectedLanguage="en"
        />
      );

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('data-dir="ltr"');
      expect(html).toContain('data-rtl="false"');
      expect(html).toContain('animate-slide-in-right');
    });
  });

  describe('5. KioskPlayer Shell Full RTL Integration', () => {
    it('renders player shell with dir="rtl" when Arabic is active', () => {
      mockUseKioskPlayer.mockReturnValue({
        journey: sampleJourney,
        journeyId: sampleJourney._id,
        currentStepIndex: 0,
        totalSteps: sampleJourney.steps.length,
        activeStep: sampleJourney.steps[0],
        canGoNext: true,
        isFirstStep: true,
        isLastStep: false,
        isYesNoStep: false,
        isHoldStep: false,
        holdProgress: 0,
        selectedLanguage: 'ar',
        isMuted: false,
        showSubtitles: false,
        supervisorWitness: null,
        isSupervisorWitnessRequired: false,
        handleNextStep: vi.fn(),
        handlePrevStep: vi.fn(),
        handleResetJourney: vi.fn(),
        handleFinish: vi.fn(),
        handleLanguageChange: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        recordInteraction: vi.fn(),
        handleHoldStart: vi.fn(),
        handleHoldEnd: vi.fn(),
        handleYesNoSelection: vi.fn(),
        handleHotspotClick: vi.fn(),
        handlePpeConfirm: vi.fn(),
        checkedPpe: new Set(),
        setCheckedPpe: vi.fn(),
        ppeSubmitted: false,
        ppeResetCountdown: 0,
        ppeSubmitError: null,
        activeEmergency: null,
        tamperingDetected: false,
        videoCompleted: false,
        setVideoCompleted: vi.fn(),
        showPinOverlay: false,
        setShowPinOverlay: vi.fn()
      });

      const html = renderToString(
        <KioskPlayer journeyId={sampleJourney._id} />
      );

      // Verify the player shell root has dir="rtl"
      expect(html).toContain('id="kiosk-player-shell"');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('data-dir="rtl"');
      expect(html).toContain('data-rtl="true"');
    });

    it('renders player shell with dir="ltr" when English is active', () => {
      mockUseKioskPlayer.mockReturnValue({
        journey: sampleJourney,
        journeyId: sampleJourney._id,
        currentStepIndex: 0,
        totalSteps: sampleJourney.steps.length,
        activeStep: sampleJourney.steps[0],
        canGoNext: true,
        isFirstStep: true,
        isLastStep: false,
        isYesNoStep: false,
        isHoldStep: false,
        holdProgress: 0,
        selectedLanguage: 'en',
        isMuted: false,
        showSubtitles: false,
        supervisorWitness: null,
        isSupervisorWitnessRequired: false,
        handleNextStep: vi.fn(),
        handlePrevStep: vi.fn(),
        handleResetJourney: vi.fn(),
        handleFinish: vi.fn(),
        handleLanguageChange: vi.fn(),
        toggleMuted: vi.fn(),
        toggleSubtitles: vi.fn(),
        recordInteraction: vi.fn(),
        handleHoldStart: vi.fn(),
        handleHoldEnd: vi.fn(),
        handleYesNoSelection: vi.fn(),
        handleHotspotClick: vi.fn(),
        handlePpeConfirm: vi.fn(),
        checkedPpe: new Set(),
        setCheckedPpe: vi.fn(),
        ppeSubmitted: false,
        ppeResetCountdown: 0,
        ppeSubmitError: null,
        activeEmergency: null,
        tamperingDetected: false,
        videoCompleted: false,
        setVideoCompleted: vi.fn(),
        showPinOverlay: false,
        setShowPinOverlay: vi.fn()
      });

      const html = renderToString(
        <KioskPlayer journeyId={sampleJourney._id} />
      );

      expect(html).toContain('id="kiosk-player-shell"');
      expect(html).toContain('dir="ltr"');
      expect(html).toContain('data-dir="ltr"');
      expect(html).toContain('data-rtl="false"');
    });
  });

  describe('6. KioskHomeScreen Launcher RTL Architecture & Logical Properties', () => {
    it('renders launcher container with dir="rtl" and utilizes logical properties for search input', () => {
      activeMockLanguage = 'ar';

      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      // Launcher root has dir="rtl"
      expect(html).toContain('data-testid="kiosk-home-launcher"');
      expect(html).toContain('dir="rtl"');
      expect(html).toContain('data-dir="rtl"');

      // Search input uses Tailwind logical properties (ps-10 pe-12, start-3.5)
      expect(html).toContain('data-testid="touch-search-input"');
      expect(html).toContain('ps-10');
      expect(html).toContain('pe-12');
      expect(html).toContain('start-3.5');
    });

    it('renders launcher container with dir="ltr" when English is active', () => {
      activeMockLanguage = 'en';

      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="kiosk-home-launcher"');
      expect(html).toContain('dir="ltr"');
      expect(html).toContain('data-dir="ltr"');
    });
  });
});
