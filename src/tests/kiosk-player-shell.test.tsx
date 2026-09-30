import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { KioskPlayerHeader } from '../features/kiosk/components/KioskPlayerHeader';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KioskActionFooter } from '../features/kiosk/components/KioskActionFooter';
import { KioskPlayer } from '../features/kiosk/components/KioskPlayer';
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
    clearRevocationStatus: vi.fn()
  }
}));

// Mock useKioskPlayer context hook
const mockUseKioskPlayer = vi.fn();
vi.mock('../features/kiosk/context/KioskPlayerContext', () => ({
  useKioskPlayer: () => mockUseKioskPlayer(),
  KioskPlayerProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('K-RUN-003: Responsive Player Shell & Modular Sub-components Suite', () => {
  const sampleSteps: KioskStep[] = [
    {
      id: 'step-01',
      title: 'Facility Safety Introduction',
      type: 'content',
      order: 0,
      blocks: [
        {
          id: 'b1',
          type: 'text',
          order: 0,
          mediaReferences: {
            en: { textValue: 'Welcome to the facility. Please review safety rules.' }
          }
        },
        {
          id: 'b2',
          type: 'image',
          order: 1,
          mediaReferences: {
            en: { embedUrl: 'https://example.com/safety-map.png' }
          }
        }
      ],
      interaction: {
        type: 'tap_to_continue'
      }
    },
    {
      id: 'step-02',
      title: 'Hazard Alert & Emergency Exits',
      type: 'warning_step',
      order: 1,
      blocks: [
        {
          id: 'b3',
          type: 'video',
          order: 0,
          mediaReferences: {
            en: { embedUrl: 'https://example.com/hazard-video.mp4' }
          }
        }
      ],
      interaction: {
        type: 'yes_no'
      }
    },
    {
      id: 'step-03',
      title: 'PPE Gear Verification',
      type: 'content',
      order: 2,
      blocks: [
        {
          id: 'b4',
          type: 'icon',
          order: 0,
          settings: { theme: 'mandatory' },
          mediaReferences: { en: {} }
        }
      ],
      interaction: {
        type: 'ppe_checklist',
        ppeItems: ['Hard Hat', 'Safety Glasses', 'High-Vis Vest', 'Steel Toe Boots']
      }
    },
    {
      id: 'step-04',
      title: 'Shift Clearance Confirmation',
      type: 'content',
      order: 3,
      blocks: [
        {
          id: 'b5',
          type: 'animation',
          order: 0,
          mediaReferences: { en: {} }
        }
      ],
      interaction: {
        type: 'hold_to_confirm',
        holdDurationMs: 2000
      }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseKioskPlayer.mockReturnValue({
      journey: {
        _id: 'journey-101',
        title: 'Warehouse Safety & Hazardous Chemical Handling',
        languages: ['en', 'es', 'pl'],
        steps: sampleSteps,
        settings: {
          idleTimeoutSeconds: 120,
          autoPlay: false,
          security: { protectionType: 'none' }
        }
      },
      currentStepIndex: 0,
      selectedLanguage: 'en',
      isMuted: false,
      showSubtitles: false,
      isLoading: false,
      error: null,
      loadJourney: vi.fn(),
      setStepIndex: vi.fn(),
      nextStep: vi.fn(),
      prevStep: vi.fn(),
      changeLanguage: vi.fn(),
      setPlayingAudio: vi.fn(),
      toggleMuted: vi.fn(),
      toggleSubtitles: vi.fn(),
      startSession: vi.fn(),
      recordInteraction: vi.fn(),
      completeSession: vi.fn(),
      abortSession: vi.fn(),
      recordPpeCompliance: vi.fn()
    });
  });

  // =========================================================================
  // Acceptance Criteria 1: Responsive Layout & Pinned Bars
  // =========================================================================
  describe('Acceptance Criteria 1: Portrait/Landscape Responsive Shell Layout & Pinned Bars', () => {
    it('renders the complete KioskPlayer shell containing pinned header, step canvas, and pinned 96px footer', () => {
      const html = renderToString(
        <KioskPlayer journeyId="journey-101" />
      );

      // Shell root container
      expect(html).toContain('id="kiosk-player-shell"');
      expect(html).toContain('data-testid="kiosk-player-shell"');
      expect(html).toContain('h-screen');
      expect(html).toContain('overflow-hidden');

      // Pinned Header
      expect(html).toContain('data-testid="kiosk-player-header"');
      expect(html).toContain('sticky top-0');

      // Scrollable step content canvas
      expect(html).toContain('data-testid="kiosk-step-container"');
      expect(html).toContain('overflow-y-auto');

      // Pinned Footer (pinned to 96px)
      expect(html).toContain('data-testid="kiosk-action-footer"');
      expect(html).toContain('sticky bottom-0');
      expect(html).toContain('h-24');
      expect(html).toContain('min-h-[96px]');
      expect(html).toContain('max-h-[96px]');
    });

    it('enforces vertical stacking and responsive fluid scaling without clipping', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[0]}
          stepIndex={0}
          direction="forward"
          selectedLanguage="en"
          className="w-full max-w-5xl mx-auto"
        />
      );

      // Flex column layout that stacks vertically and scrolls smoothly
      expect(html).toContain('flex-1');
      expect(html).toContain('overflow-y-auto');
      expect(html).toContain('max-w-5xl');
      expect(html).toContain('mx-auto');
      // Content is present
      expect(html).toContain('Facility Safety Introduction');
      expect(html).toContain('Welcome to the facility. Please review safety rules.');
      expect(html).toContain('https://example.com/safety-map.png');
    });
  });

  // =========================================================================
  // Acceptance Criteria 2: Active Step Navigation & Directional Animations
  // =========================================================================
  describe('Acceptance Criteria 2: Step Directional Transitions & Animations', () => {
    it('applies animate-slide-in-right when navigating forward', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[1]}
          stepIndex={1}
          direction="forward"
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-direction="forward"');
      expect(html).toContain('animate-slide-in-right');
      expect(html).toContain('data-step-index="1"');
    });

    it('applies animate-slide-in-left when navigating backward', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[0]}
          stepIndex={0}
          direction="backward"
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-direction="backward"');
      expect(html).toContain('animate-slide-in-left');
      expect(html).toContain('data-step-index="0"');
    });
  });

  // =========================================================================
  // Modular Component 1: KioskPlayerHeader
  // =========================================================================
  describe('KioskPlayerHeader Component', () => {
    it('renders journey title, step progress bar, language selector, and accessibility controls', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Forklift & Loading Dock Protocols"
          currentStepIndex={1}
          totalSteps={4}
          languages={['en', 'es', 'de']}
          selectedLanguage="en"
          onLanguageChange={vi.fn()}
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={true}
          onToggleSubtitles={vi.fn()}
          highContrast={false}
          onToggleHighContrast={vi.fn()}
          canExit={true}
          onExit={vi.fn()}
        />
      );

      // Title
      expect(html).toContain('data-testid="kiosk-player-title"');
      expect(html).toContain('Forklift &amp; Loading Dock Protocols');

      // Progress bar at 50% (step 2 of 4)
      expect(html).toContain('data-testid="kiosk-progress-bar"');
      expect(html).toContain('style="width:50%"');

      // Accessibility controls
      expect(html).toContain('data-testid="toggle-contrast-btn"');
      expect(html).toContain('data-testid="toggle-subtitles-btn"');
      expect(html).toContain('data-testid="toggle-mute-btn"');
      expect(html).toContain('data-testid="player-language-switcher"');

      // Language buttons
      expect(html).toContain('data-testid="lang-btn-en"');
      expect(html).toContain('data-testid="lang-btn-es"');
      expect(html).toContain('data-testid="lang-btn-de"');

      // Exit button
      expect(html).toContain('data-testid="kiosk-btn-exit"');
    });

    it('calculates progress accurately for first and last steps', () => {
      // Step 0 of 4 = 25%
      const firstStepHtml = renderToString(
        <KioskPlayerHeader
          title="Test"
          currentStepIndex={0}
          totalSteps={4}
          selectedLanguage="en"
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
        />
      );
      expect(firstStepHtml).toContain('style="width:25%"');

      // Step 3 of 4 = 100%
      const lastStepHtml = renderToString(
        <KioskPlayerHeader
          title="Test"
          currentStepIndex={3}
          totalSteps={4}
          selectedLanguage="en"
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
        />
      );
      expect(lastStepHtml).toContain('style="width:100%"');
    });

    it('renders in high-contrast mode with yellow/amber tokens and bold contrast borders', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="High Contrast Safety"
          currentStepIndex={0}
          totalSteps={2}
          selectedLanguage="en"
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
          highContrast={true}
        />
      );

      expect(html).toContain('bg-black');
      expect(html).toContain('border-amber-400');
    });
  });

  // =========================================================================
  // Modular Component 2: KioskActionFooter
  // =========================================================================
  describe('KioskActionFooter Component', () => {
    it('pins footer to 96px with universal thumb reachability touch targets', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={0}
          totalSteps={4}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
        />
      );

      // Pinned 96px height constraints
      expect(html).toContain('h-24');
      expect(html).toContain('min-h-[96px]');
      expect(html).toContain('max-h-[96px]');

      // Thumb reachability minimum touch target height
      expect(html).toContain('min-h-[56px]');

      // Step 0 renders "Begin Briefing"
      expect(html).toContain('data-testid="kiosk-btn-next"');
      expect(html).toContain('Begin Briefing');

      // Step counter displays Screen 1 of 4
      expect(html).toContain('data-testid="kiosk-step-counter"');
      expect(html).toContain('Screen');
      expect(html).toContain('1');
      expect(html).toContain('of');
      expect(html).toContain('4');
    });

    it('renders Back and Next buttons on intermediate steps', () => {
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
        />
      );

      expect(html).toContain('data-testid="kiosk-btn-prev"');
      expect(html).toContain('data-testid="kiosk-btn-next"');
      expect(html).toContain('Next');
      expect(html).not.toContain('data-testid="kiosk-btn-finish"');
    });

    it('renders Finish button on final step', () => {
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
        />
      );

      expect(html).toContain('data-testid="kiosk-btn-prev"');
      expect(html).not.toContain('data-testid="kiosk-btn-next"');
      expect(html).toContain('data-testid="kiosk-btn-finish"');
      expect(html).toContain('Finish');
    });

    it('renders Hold-to-Confirm button with progress bar when enabled', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={3}
          totalSteps={4}
          isHoldToConfirm={true}
          holdProgress={65}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="kiosk-btn-hold"');
      expect(html).toContain('Hold to Confirm');
      expect(html).toContain('style="width:65%"');
    });

    it('renders high-contrast styling tokens on buttons and container', () => {
      const html = renderToString(
        <KioskActionFooter
          currentStepIndex={1}
          totalSteps={3}
          highContrast={true}
          onPrev={vi.fn()}
          onNext={vi.fn()}
          onRestart={vi.fn()}
          onFinish={vi.fn()}
        />
      );

      expect(html).toContain('bg-black');
      expect(html).toContain('border-amber-400');
      expect(html).toContain('bg-amber-400 text-black');
    });
  });

  // =========================================================================
  // Modular Component 3: KioskStepContainer
  // =========================================================================
  describe('KioskStepContainer Component', () => {
    it('renders warning protocol banner when step type is warning_step', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[1]}
          stepIndex={1}
          direction="forward"
          selectedLanguage="en"
        />
      );

      expect(html).toContain('Attention / Hazard Warning');
      expect(html).toContain('Follow safe handling guidelines');
      expect(html).toContain('Hazard Alert &amp; Emergency Exits');
    });

    it('renders emergency protocol banner when step type is emergency_step', () => {
      const emergencyStep: KioskStep = {
        id: 'step-em',
        title: 'Chemical Spill Evacuation Protocol',
        type: 'emergency_step',
        order: 0,
        blocks: [],
        interaction: { type: 'tap_to_continue' }
      };

      const html = renderToString(
        <KioskStepContainer
          step={emergencyStep}
          stepIndex={0}
          direction="forward"
          selectedLanguage="en"
        />
      );

      expect(html).toContain('Emergency Safety Protocol');
      expect(html).toContain('Immediate action required');
    });

    it('renders Yes/No interactive decision buttons', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[1]}
          stepIndex={1}
          direction="forward"
          selectedLanguage="en"
          onYesNoSelection={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="yes-btn"');
      expect(html).toContain('Yes / Confirmed');
      expect(html).toContain('data-testid="no-btn"');
      expect(html).toContain('No / Unsafe');
    });

    it('renders PPE checklist items and submit action button', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[2]}
          stepIndex={2}
          direction="forward"
          selectedLanguage="en"
          checkedPpe={new Set(['Hard Hat', 'Safety Glasses'])}
          onTogglePpeItem={vi.fn()}
          onSubmitPpe={vi.fn()}
        />
      );

      expect(html).toContain('Mandatory PPE Verification Checklist');
      expect(html).toContain('data-testid="ppe-check-hard-hat"');
      expect(html).toContain('data-testid="ppe-check-safety-glasses"');
      expect(html).toContain('data-testid="ppe-check-high-vis-vest"');
      expect(html).toContain('data-testid="ppe-check-steel-toe-boots"');
      expect(html).toContain('data-testid="ppe-confirm-btn"');
    });

    it('renders circular hold-to-confirm touch target on step canvas', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[3]}
          stepIndex={3}
          direction="forward"
          selectedLanguage="en"
          holdProgress={45}
        />
      );

      expect(html).toContain('data-testid="hold-to-confirm-btn"');
      expect(html).toContain('Touch &amp; Hold to Confirm');
    });

    it('renders subtitles overlay when showSubtitles is true', () => {
      const html = renderToString(
        <KioskStepContainer
          step={sampleSteps[0]}
          stepIndex={0}
          direction="forward"
          selectedLanguage="en"
          showSubtitles={true}
        />
      );

      // Subtitle box contains text value
      expect(html).toContain('Welcome to the facility. Please review safety rules.');
    });
  });

  // =========================================================================
  // Integrated KioskPlayer Shell Verification
  // =========================================================================
  describe('Integrated KioskPlayer Shell Architecture', () => {
    it('seamlessly synchronizes state across Header, StepContainer, and Footer', () => {
      const html = renderToString(
        <KioskPlayer journeyId="journey-101" />
      );

      // Header reflects journey title
      expect(html).toContain('Warehouse Safety &amp; Hazardous Chemical Handling');
      // StepContainer reflects active step title
      expect(html).toContain('Facility Safety Introduction');
      // Footer reflects initial briefing step
      expect(html).toContain('Begin Briefing');
      expect(html).toContain('Screen');
      expect(html).toContain('1');
      expect(html).toContain('4');
    });

    it('renders loading indicator when player is loading', () => {
      mockUseKioskPlayer.mockReturnValueOnce({
        isLoading: true,
        loadJourney: vi.fn()
      });

      const html = renderToString(
        <KioskPlayer journeyId="journey-101" />
      );

      expect(html).toContain('Loading Kiosk Screen...');
    });

    it('renders error overlay when journey fails to load', () => {
      mockUseKioskPlayer.mockReturnValueOnce({
        isLoading: false,
        error: 'Terminal offline or session token expired',
        journey: null,
        loadJourney: vi.fn()
      });

      const html = renderToString(
        <KioskPlayer journeyId="journey-101" />
      );

      expect(html).toContain('id="kiosk-error-container"');
      expect(html).toContain('Terminal offline or session token expired');
    });
  });
});
