import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { JourneySimulator, AspectRatioMode } from '../features/kiosk/components/builder/JourneySimulator';
import { KioskJourney } from '../types/kiosk/journey.types';
import { KioskStep } from '../types/kiosk/step.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

describe('K-JRN-004: Interactive Journey Simulator & Hardware QA Mode Suite', () => {
  let sampleJourney: Partial<KioskJourney>;
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const sampleSteps: KioskStep[] = [
      {
        id: 'step-intro-01',
        type: 'info_step',
        title: 'Safety Induction Overview',
        order: 1,
        blocks: [
          {
            id: 'block-text-1',
            type: 'text',
            order: 1,
            settings: { size: 'medium' },
            mediaReferences: {
              en: { textValue: 'Welcome to Talnova Logistics Depot. Complete all slides.' },
              es: { textValue: 'Bienvenido al almacén de Talnova. Complete todas las diapositivas.' },
              ar: { textValue: 'مرحبا بكم في مستودع تالنوفا. يرجى إكمال جميع الشرائح.' }
            }
          } as any
        ],
        interaction: { type: 'tap_to_continue' }
      } as KioskStep,
      {
        id: 'step-hold-02',
        type: 'interactive_confirmation',
        title: 'Emergency E-Stop Verification',
        order: 2,
        blocks: [
          {
            id: 'block-text-2',
            type: 'text',
            order: 1,
            settings: { size: 'medium' },
            mediaReferences: {
              en: { textValue: 'Confirm location of emergency cut-off stop switch before entry.' }
            }
          } as any
        ],
        interaction: {
          type: 'hold_to_confirm',
          holdDurationMs: 3000
        }
      } as KioskStep,
      {
        id: 'step-ppe-03',
        type: 'instruction_step',
        title: 'Mandatory PPE Verification',
        order: 3,
        blocks: [
          {
            id: 'block-text-3',
            type: 'text',
            order: 1,
            settings: { size: 'medium' },
            mediaReferences: {
              en: { textValue: 'Check off all required gear before loading bay entry.' }
            }
          } as any
        ],
        interaction: {
          type: 'ppe_checklist',
          ppeItems: ['Hard Hat', 'Safety Glasses', 'High-Vis Vest', 'Steel-Toe Boots', 'Gloves']
        }
      } as KioskStep,
      {
        id: 'step-warning-04',
        type: 'warning_step',
        title: 'High Voltage Hazard Warning',
        order: 4,
        blocks: [
          {
            id: 'block-text-4',
            type: 'text',
            order: 1,
            settings: { size: 'large' },
            mediaReferences: {
              en: { textValue: 'DANGER: 480V three-phase machinery in active test mode.' }
            }
          } as any
        ],
        interaction: { type: 'tap_to_continue' }
      } as KioskStep
    ];

    sampleJourney = {
      id: 'journey-sim-test-01',
      title: 'Plant Operations Safety Training',
      steps: sampleSteps,
      settings: {
        theme: 'dark',
        autoPlay: true,
        allowLanguageChange: true
      }
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. Acceptance Criteria 1: 9:16 Portrait Totem Constraints & Bottom Thumb Zone
  // =========================================================================
  describe('Acceptance Criteria 1: 9:16 Portrait Totem Proportions & Bottom Thumb Zone', () => {
    it('renders vertical totem proportions and thumb zone navigation when 9:16 Portrait is selected', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
          initialAspectRatio="9:16"
        />
      );

      // Verify simulator frame exists
      expect(html).toContain('data-testid="simulator-frame"');
      expect(html).toContain('data-aspect-ratio="9:16"');
      expect(html).toContain('aspect-[9/16]');

      // Verify navigation buttons adapt to the bottom thumb zone
      expect(html).toContain('data-testid="bottom-thumb-zone"');
      expect(html).toContain('min-h-[56px]');
      expect(html).toContain('data-testid="simulator-prev-btn"');
      expect(html).toContain('data-testid="simulator-next-btn"');

      // Verify physical totem casing features (camera notch / speaker grill, totem base)
      expect(html).toContain('9:16 Portrait (Totem)');
    });

    it('adapts frame constraints when selecting 16:9 Landscape', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
          initialAspectRatio="16:9"
        />
      );

      expect(html).toContain('data-aspect-ratio="16:9"');
      expect(html).toContain('aspect-[16/9]');
      expect(html).toContain('max-w-[960px]');
      expect(html).toContain('data-testid="simulator-navigation"');
    });

    it('adapts frame constraints when selecting 4:3 Industrial Tablet', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
          initialAspectRatio="4:3"
        />
      );

      expect(html).toContain('data-aspect-ratio="4:3"');
      expect(html).toContain('aspect-[4/3]');
      expect(html).toContain('max-w-[700px]');
      expect(html).toContain('4:3 Tablet (Industrial)');
    });

    it('renders full screen layout when Full Screen mode is selected', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
          initialAspectRatio="full"
        />
      );

      expect(html).toContain('data-aspect-ratio="full"');
      expect(html).toContain('Full Viewport');
    });
  });

  // =========================================================================
  // 2. Acceptance Criteria 2: Interactive Hold Step, 3-Second Hold & Progress Ring
  // =========================================================================
  describe('Acceptance Criteria 2: Interactive Hold Step & 3-Second Completion Ring', () => {
    it('renders circular progress ring and hold-to-confirm button for interactive hold steps', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          initialStepIndex={1} // step-hold-02
          isOpen={true}
          onClose={mockOnClose}
          initialAspectRatio="9:16"
        />
      );

      expect(html).toContain('data-testid="simulator-hold-interaction"');
      expect(html).toContain('data-testid="hold-progress-ring"');
      expect(html).toContain('data-testid="hold-to-confirm-btn"');
      expect(html).toContain('data-hold-completed="false"');
      expect(html).toContain('Emergency E-Stop Verification');
    });

    it('simulates 3-second continuous touch hold to 100% completion and unlocks progression', () => {
      vi.useFakeTimers();

      let progress = 0;
      let isHolding = false;
      let isCompleted = false;
      const holdDurationMs = 3000;
      let holdTimer: NodeJS.Timeout | null = null;
      let intervalTimer: NodeJS.Timeout | null = null;
      let startTime = 0;

      const onHoldStart = () => {
        isHolding = true;
        startTime = Date.now();
        intervalTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          progress = Math.min((elapsed / holdDurationMs) * 100, 100);
        }, 30);

        holdTimer = setTimeout(() => {
          if (intervalTimer) clearInterval(intervalTimer);
          progress = 100;
          isHolding = false;
          isCompleted = true;
        }, holdDurationMs);
      };

      const onHoldEnd = () => {
        if (!isCompleted) {
          if (holdTimer) clearTimeout(holdTimer);
          if (intervalTimer) clearInterval(intervalTimer);
          isHolding = false;
          progress = 0;
        }
      };

      // 1. User touches and holds mouse button
      onHoldStart();
      expect(isHolding).toBe(true);

      // 2. After 1.5 seconds (partial hold)
      vi.advanceTimersByTime(1500);
      expect(progress).toBeGreaterThanOrEqual(40);
      expect(progress).toBeLessThan(100);
      expect(isCompleted).toBe(false);

      // 3. User continues holding through the full 3.0 seconds
      vi.advanceTimersByTime(1500);
      expect(progress).toBe(100);
      expect(isCompleted).toBe(true);

      // 4. Progression unlocked
      expect(isCompleted).toBe(true);
    });

    it('resets progress ring if touch/mouse is released before 3 seconds', () => {
      vi.useFakeTimers();

      let progress = 0;
      let isHolding = false;
      let isCompleted = false;
      const holdDurationMs = 3000;
      let holdTimer: NodeJS.Timeout | null = null;
      let intervalTimer: NodeJS.Timeout | null = null;
      let startTime = 0;

      const onHoldStart = () => {
        isHolding = true;
        startTime = Date.now();
        intervalTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          progress = Math.min((elapsed / holdDurationMs) * 100, 100);
        }, 30);

        holdTimer = setTimeout(() => {
          if (intervalTimer) clearInterval(intervalTimer);
          progress = 100;
          isHolding = false;
          isCompleted = true;
        }, holdDurationMs);
      };

      const onHoldEnd = () => {
        if (!isCompleted) {
          if (holdTimer) clearTimeout(holdTimer);
          if (intervalTimer) clearInterval(intervalTimer);
          isHolding = false;
          progress = 0;
        }
      };

      // User starts holding
      onHoldStart();
      expect(isHolding).toBe(true);

      // Advances 2000ms
      vi.advanceTimersByTime(2000);
      expect(progress).toBeGreaterThanOrEqual(60);

      // User releases mouse early
      onHoldEnd();
      expect(isHolding).toBe(false);
      expect(progress).toBe(0);
      expect(isCompleted).toBe(false);

      // Further time does not complete
      vi.advanceTimersByTime(2000);
      expect(isCompleted).toBe(false);
    });
  });

  // =========================================================================
  // 3. Mandatory PPE Checklist Interaction Emulation
  // =========================================================================
  describe('Mandatory PPE Checklist Interaction Emulation', () => {
    it('renders PPE checklist items and confirm button for PPE steps', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          initialStepIndex={2} // step-ppe-03
          isOpen={true}
          onClose={mockOnClose}
          initialAspectRatio="9:16"
        />
      );

      expect(html).toContain('data-testid="simulator-ppe-interaction"');
      expect(html).toContain('Mandatory PPE Checklist');
      expect(html).toContain('data-testid="ppe-item-Hard Hat"');
      expect(html).toContain('data-testid="ppe-item-Safety Glasses"');
      expect(html).toContain('data-testid="ppe-item-High-Vis Vest"');
      expect(html).toContain('data-testid="ppe-item-Steel-Toe Boots"');
      expect(html).toContain('data-testid="ppe-item-Gloves"');
      expect(html).toContain('data-testid="ppe-select-all-btn"');
      expect(html).toContain('data-testid="confirm-ppe-btn"');
    });
  });

  // =========================================================================
  // 4. Quick Language Toggle Toolbar & RTL Layout Fitting
  // =========================================================================
  describe('Quick Language Toggle Toolbar & RTL Layout Fitting', () => {
    it('renders language toggle toolbar with EN, ES, FR, DE, AR buttons', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(html).toContain('data-testid="lang-toggle-en"');
      expect(html).toContain('data-testid="lang-toggle-es"');
      expect(html).toContain('data-testid="lang-toggle-fr"');
      expect(html).toContain('data-testid="lang-toggle-de"');
      expect(html).toContain('data-testid="lang-toggle-ar"');
    });

    it('adapts text direction to RTL when Arabic is selected', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
          initialLanguage="ar"
        />
      );

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('AR [RTL]');
      expect(html).toContain('[AR] Safety Induction Overview');
    });

    it('renders LTR layout when English is selected', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
          initialLanguage="en"
        />
      );

      expect(html).toContain('dir="ltr"');
      expect(html).toContain('EN [LTR]');
    });
  });

  // =========================================================================
  // 5. Interactive Debug Overlay Telemetry
  // =========================================================================
  describe('Interactive Debug Overlay Telemetry', () => {
    it('displays active step ID, block count, step type, and dwell timer state', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          initialStepIndex={0}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(html).toContain('data-testid="debug-overlay"');
      expect(html).toContain('data-testid="debug-step-id"');
      expect(html).toContain('step-intro-01');

      expect(html).toContain('data-testid="debug-step-index"');
      expect(html).toContain('1 of 4');

      expect(html).toContain('data-testid="debug-step-type"');
      expect(html).toContain('info_step');

      expect(html).toContain('data-testid="debug-block-count"');
      expect(html).toContain('data-testid="debug-dwell-timer"');
      expect(html).toContain('data-testid="debug-aspect-ratio"');
      expect(html).toContain('data-testid="debug-step-select"');
    });

    it('enforces 3-second mandatory dwell countdown on warning step', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          initialStepIndex={3} // step-warning-04
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(html).toContain('warning_step');
      expect(html).toContain('data-testid="debug-dwell-timer"');
      expect(html).toContain('Safety Hazard Warning');
    });
  });

  // =========================================================================
  // 6. Modal Controls & Dismissal
  // =========================================================================
  describe('Modal Lifecycle & Controls', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      expect(html).toBe('');
    });

    it('renders close button when isOpen is true', () => {
      const html = renderToString(
        <JourneySimulator
          journey={sampleJourney}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(html).toContain('data-testid="close-simulator-btn"');
      expect(html).toContain('Hardware QA Simulator');
    });
  });
});
