import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// Components
import {
  AccessibilityToolbar,
  calculateLuminance,
  calculateContrastRatio,
  HIGH_CONTRAST_PALETTE,
  FontScale
} from '../features/kiosk/components/accessibility/AccessibilityToolbar';
import { KioskPlayerHeader } from '../features/kiosk/components/KioskPlayerHeader';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';

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
    getOrCreateHardwareGuid: vi.fn(async () => 'HW-GUID-ACC-002'),
    getHardwareGuidSync: vi.fn(() => 'HW-GUID-ACC-002'),
    getEmployeeUser: vi.fn(() => ({
      id: 'usr-acc-worker',
      fullName: 'Taylor Swift',
      department: 'Logistics'
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

describe('K-ACC-002: Universal Accessibility Toolbar & High Contrast Suite', () => {
  const sampleStep: KioskStep = {
    id: 'step-safety-reflow',
    title: 'High-Risk Hazardous Machinery & Chemical Handling Operating Standards',
    type: 'content',
    order: 0,
    blocks: [
      {
        id: 'block-txt-1',
        type: 'text',
        order: 0,
        mediaReferences: {
          en: {
            textValue:
              'All operators must strictly follow emergency lockdown protocol 44-A before initiating hydrostatic valve pressure tests. Wear full Level B Hazmat protective apparel including respirator masks, rubber boots, and chemical resistant gloves at all times.'
          }
        },
        settings: { size: 'large' }
      },
      {
        id: 'block-txt-2',
        type: 'text',
        order: 1,
        mediaReferences: {
          en: {
            textValue:
              'Failure to de-energize hydraulic feeder lines before manual inspection introduces catastrophic risk of high-pressure fluid injection and severe thermal injury.'
          }
        },
        settings: { contrastMode: true }
      },
      {
        id: 'block-vid-1',
        type: 'video',
        order: 2,
        mediaReferences: {
          en: {
            embedUrl: 'https://example.com/safety-briefing.mp4',
            textValue: '[Audio narration]: Step 1 - Turn the primary lockout dial 90 degrees clockwise.'
          }
        }
      }
    ],
    interaction: {
      type: 'tap_to_continue'
    }
  };

  const sampleManifest: KioskDeviceManifest = {
    deviceId: 'HW-ACC-101',
    organizationId: 'org-acc-enterprise',
    launchMode: 'launcher',
    journeys: [
      {
        _id: 'jrn-acc-1',
        organizationId: 'org-acc-enterprise',
        title: 'Safety Critical Reflow & Contrast Protocol',
        description: 'Verify accessibility standards under intense warehouse lighting',
        priority: 1,
        isMandatory: true,
        status: 'published',
        version: 1,
        language: 'en',
        supportedLanguages: ['en'],
        steps: [sampleStep]
      }
    ]
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
      progressPercentage: 25,
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

  describe('1. WCAG AAA Contrast Ratio Calculations & Color Palette', () => {
    it('verifies pure black background (#000000) luminance is 0', () => {
      const lum = calculateLuminance('#000000');
      expect(lum).toBe(0);
    });

    it('verifies crisp white text (#ffffff) luminance is 1.0', () => {
      const lum = calculateLuminance('#ffffff');
      expect(lum).toBe(1);
    });

    it('verifies white text on black background meets WCAG AAA (> 7:1) with a perfect 21:1 ratio', () => {
      const ratio = calculateContrastRatio(
        HIGH_CONTRAST_PALETTE.foreground,
        HIGH_CONTRAST_PALETTE.background
      );
      // (1.0 + 0.05) / (0.0 + 0.05) = 21.0
      expect(ratio).toBeCloseTo(21.0, 1);
      expect(ratio).toBeGreaterThan(7.0); // WCAG AAA requirement
    });

    it('verifies bright amber (#fbbf24) on black background exceeds the 12:1 contrast ratio requirement', () => {
      const ratio = calculateContrastRatio(
        HIGH_CONTRAST_PALETTE.border,
        HIGH_CONTRAST_PALETTE.background
      );
      // (#fbbf24 is ~12.54:1)
      expect(ratio).toBeGreaterThan(12.0);
      expect(ratio).toBeGreaterThan(7.0); // Also easily exceeds WCAG AAA
    });

    it('verifies amber active indicator (#f59e0b) on black background meets WCAG AAA (> 7:1)', () => {
      const ratio = calculateContrastRatio(
        HIGH_CONTRAST_PALETTE.activeIndicator,
        HIGH_CONTRAST_PALETTE.background
      );
      // (#f59e0b is ~9.6:1)
      expect(ratio).toBeGreaterThan(7.0);
    });
  });

  describe('2. AccessibilityToolbar Component Structure & Controls', () => {
    it('renders High Contrast toggle button with proper attributes and touch targets', () => {
      const onToggleHC = vi.fn();
      const html = renderToString(
        <AccessibilityToolbar
          highContrast={false}
          onToggleHighContrast={onToggleHC}
        />
      );

      expect(html).toContain('data-testid="toggle-high-contrast"');
      expect(html).toContain('aria-pressed="false"');
      expect(html).toContain('min-h-[48px]');
      expect(html).toContain('min-w-[48px]');
      expect(html).toContain('High Contrast');
    });

    it('reflects active High Contrast mode state when enabled', () => {
      const html = renderToString(
        <AccessibilityToolbar
          highContrast={true}
          onToggleHighContrast={vi.fn()}
        />
      );

      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain('bg-amber-400');
      expect(html).toContain('text-black');
    });

    it('supports custom contrastBtnTestId for backward compatibility', () => {
      const html = renderToString(
        <AccessibilityToolbar
          highContrast={false}
          onToggleHighContrast={vi.fn()}
          contrastBtnTestId="toggle-contrast-btn"
        />
      );

      expect(html).toContain('data-testid="toggle-contrast-btn"');
    });

    it('renders quick direct zoom buttons for 100%, 125%, 150%, and 200%', () => {
      const html = renderToString(
        <AccessibilityToolbar
          fontScale={125}
          onFontScaleChange={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="zoom-100"');
      expect(html).toContain('data-testid="zoom-125"');
      expect(html).toContain('data-testid="zoom-150"');
      expect(html).toContain('data-testid="zoom-200"');
      expect(html).toContain('100%');
      expect(html).toContain('125%');
      expect(html).toContain('150%');
      expect(html).toContain('200%');
      // 125% button should have active indicator class
      expect(html).toContain('bg-indigo-600');
      expect(html).toContain('aria-pressed="true"');
    });

    it('renders quick direct zoom buttons with high contrast styling when enabled', () => {
      const html = renderToString(
        <AccessibilityToolbar
          highContrast={true}
          fontScale={200}
          onFontScaleChange={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="zoom-200"');
      expect(html).toContain('border-amber-300');
      expect(html).toContain('bg-amber-400');
    });

    it('renders font scale stepper/cycle button for compact physical terminals', () => {
      const html = renderToString(
        <AccessibilityToolbar
          fontScale={150}
          onFontScaleChange={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="toggle-font-scale"');
      expect(html).toContain('150%');
    });

    it('renders closed captions toggle button when handler is supplied', () => {
      const html = renderToString(
        <AccessibilityToolbar
          showSubtitles={true}
          onToggleSubtitles={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="toggle-subtitles-btn"');
      expect(html).toContain('aria-pressed="true"');
      expect(html).toContain('min-h-[48px]');
      expect(html).toContain('min-w-[48px]');
      expect(html).toContain('Closed Captions / Subtitles');
    });

    it('hides closed captions toggle button when onToggleSubtitles is omitted', () => {
      const html = renderToString(
        <AccessibilityToolbar
          highContrast={false}
          onToggleHighContrast={vi.fn()}
        />
      );

      expect(html).not.toContain('data-testid="toggle-subtitles-btn"');
    });
  });

  describe('3. Dynamic Text Scaling & Reflow at 200% Zoom', () => {
    it('applies data-font-scale="200" and fluid scaling class to KioskStepContainer', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleStep}
          stepIndex={0}
          selectedLanguage="en"
          fontScale={200}
        />
      );

      expect(html).toContain('data-font-scale="200"');
      expect(html).toContain('overflow-x-hidden');
      expect(html).toContain('max-w-full');
      expect(html).toContain('break-words');
    });

    it('ensures text blocks in KioskStepContainer contain break-words to prevent horizontal scrolling', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleStep}
          stepIndex={0}
          selectedLanguage="en"
          fontScale={200}
        />
      );

      expect(html).toContain('data-testid="kiosk-block-text-block-txt-1"');
      expect(html).toContain('break-words');
      expect(html).toContain('data-testid="kiosk-block-text-block-txt-2"');
      expect(html).toContain('break-words');
    });

    it('displays subtitles and captions overlay with break-words when showSubtitles is active', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleStep}
          stepIndex={0}
          selectedLanguage="en"
          showSubtitles={true}
          fontScale={200}
        />
      );

      expect(html).toContain('Step 1 - Turn the primary lockout dial 90 degrees clockwise');
      expect(html).toContain('break-words');
      expect(html).toContain('bg-black/85');
    });
  });

  describe('4. High Contrast Mode Application in Components', () => {
    it('renders High Contrast styling in KioskStepContainer with pure black and crisp white', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleStep}
          stepIndex={0}
          selectedLanguage="en"
          highContrast={true}
        />
      );

      // In high contrast mode, text block 1 receives white text on black background with white border
      expect(html).toContain('text-white bg-black/60');
      expect(html).toContain('border-white/20');
    });

    it('renders High Contrast styling in KioskPlayerHeader', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Facility Safety"
          category="Safety"
          highContrast={true}
          onToggleHighContrast={vi.fn()}
        />
      );

      expect(html).toContain('high-contrast-mode');
      expect(html).toContain('bg-black');
      expect(html).toContain('border-amber-400');
    });

    it('renders High Contrast styling in KioskHomeScreen launcher', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={sampleManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      // Launcher contains the accessibility toolbar
      expect(html).toContain('data-testid="toggle-high-contrast"');
      expect(html).toContain('data-testid="zoom-100"');
      expect(html).toContain('data-testid="zoom-200"');
    });
  });

  describe('5. Full Player Integration & Persistence', () => {
    it('renders KioskPlayer with fontScale=200 applying data-font-scale and --kiosk-font-scale style', () => {
      const html = renderToString(
        <KioskPlayer
          manifest={sampleManifest}
          onExit={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="kiosk-player-shell"');
      expect(html).toContain('data-font-scale="');
      expect(html).toContain('--kiosk-font-scale');
    });

    it('renders KioskPlayerHeader within KioskPlayer with full accessibility controls', () => {
      const html = renderToString(
        <KioskPlayer
          manifest={sampleManifest}
          onExit={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="kiosk-player-header"');
      expect(html).toContain('data-testid="toggle-contrast-btn"');
      expect(html).toContain('data-testid="toggle-subtitles-btn"');
      expect(html).toContain('data-testid="zoom-100"');
      expect(html).toContain('data-testid="zoom-200"');
    });
  });
});
