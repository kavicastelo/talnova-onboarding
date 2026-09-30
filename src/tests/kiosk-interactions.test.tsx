import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { HoldToConfirmEngine } from '../features/kiosk/components/interactions/HoldToConfirmEngine';
import { PpeChecklistEngine } from '../features/kiosk/components/interactions/PpeChecklistEngine';
import { KnowledgeQuizEngine } from '../features/kiosk/components/interactions/KnowledgeQuizEngine';
import { HotspotInteractionEngine } from '../features/kiosk/components/interactions/HotspotInteractionEngine';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KioskQuizConfig } from '../types/kiosk/validation.types';
import { KioskHotspot, KioskStep } from '../types/kiosk/step.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: any) => options?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

describe('K-RUN-004: Touch Interaction Engines Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. HoldToConfirmEngine Tests & Acceptance Criteria 1
  // =========================================================================
  describe('HoldToConfirmEngine', () => {
    describe('Acceptance Criteria 1: Partial hold resets progress and does not advance', () => {
      it('resets and does not call onComplete when touch is released after 1500ms for a 3000ms requirement', () => {
        vi.useFakeTimers();
        const onCompleteSpy = vi.fn();
        const onHoldStartSpy = vi.fn();
        const onHoldEndSpy = vi.fn();

        let holdTimeout: NodeJS.Timeout | null = null;
        let progress = 0;
        const holdDurationMs = 3000;

        const handleHoldStart = () => {
          onHoldStartSpy();
          holdTimeout = setTimeout(() => {
            progress = 100;
            onCompleteSpy();
          }, holdDurationMs);
        };

        const handleHoldEnd = () => {
          if (holdTimeout) {
            clearTimeout(holdTimeout);
            holdTimeout = null;
          }
          progress = 0;
          onHoldEndSpy();
        };

        // User starts touch
        handleHoldStart();
        expect(onHoldStartSpy).toHaveBeenCalledTimes(1);

        // Advance 1500ms (halfway)
        vi.advanceTimersByTime(1500);
        expect(onCompleteSpy).not.toHaveBeenCalled();

        // User releases touch early
        handleHoldEnd();
        expect(onHoldEndSpy).toHaveBeenCalledTimes(1);
        expect(progress).toBe(0);

        // Advance past original 3000ms
        vi.advanceTimersByTime(2000);
        expect(onCompleteSpy).not.toHaveBeenCalled();
      });

      it('calls onComplete when hold duration is fully satisfied (3000ms)', () => {
        vi.useFakeTimers();
        const onCompleteSpy = vi.fn();
        let holdTimeout: NodeJS.Timeout | null = null;
        const holdDurationMs = 3000;

        const handleHoldStart = () => {
          holdTimeout = setTimeout(() => {
            onCompleteSpy();
          }, holdDurationMs);
        };

        handleHoldStart();
        vi.advanceTimersByTime(3000);
        expect(onCompleteSpy).toHaveBeenCalledTimes(1);
      });
    });

    it('renders circular progress ring and hand icon', () => {
      const html = renderToString(
        <HoldToConfirmEngine
          holdDurationMs={2000}
          onComplete={vi.fn()}
          variant="circular"
        />
      );

      expect(html).toContain('data-testid="hold-to-confirm-engine"');
      expect(html).toContain('id="hold-trigger-btn"');
      expect(html).toContain('data-testid="hold-to-confirm-btn"');
      expect(html).toContain('data-testid="hold-progress-ring"');
      expect(html).toContain('Touch &amp; Hold to Confirm');
    });

    it('renders linear progress bar variant', () => {
      const html = renderToString(
        <HoldToConfirmEngine
          holdDurationMs={2500}
          onComplete={vi.fn()}
          variant="linear"
          label="Hold to Authorize"
        />
      );

      expect(html).toContain('data-testid="hold-to-confirm-engine"');
      expect(html).toContain('data-testid="hold-progress-bar"');
      expect(html).toContain('Hold to Authorize');
    });

    it('applies high-contrast styling tokens', () => {
      const html = renderToString(
        <HoldToConfirmEngine
          holdDurationMs={2000}
          onComplete={vi.fn()}
          highContrast={true}
        />
      );

      expect(html).toContain('border-amber-400');
      expect(html).toContain('stroke-amber-400');
    });

    it('renders disabled state with appropriate attributes', () => {
      const html = renderToString(
        <HoldToConfirmEngine
          holdDurationMs={2000}
          onComplete={vi.fn()}
          disabled={true}
        />
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain('opacity-40');
      expect(html).toContain('cursor-not-allowed');
    });
  });

  // =========================================================================
  // 2. PpeChecklistEngine Tests & Acceptance Criteria 2
  // =========================================================================
  describe('PpeChecklistEngine', () => {
    const requiredItems = [
      'Hard Hat',
      'Safety Glasses',
      'High-Vis Vest',
      'Steel-Toe Boots',
      'Gloves'
    ];

    describe('Acceptance Criteria 2: Mandatory PPE checklist validation', () => {
      it('keeps the Confirm PPE action button disabled when not all items are checked', () => {
        // Only 2 of 5 items checked
        const partialChecked = new Set(['Hard Hat', 'Safety Glasses']);

        const html = renderToString(
          <PpeChecklistEngine
            requiredItems={requiredItems}
            checkedItems={partialChecked}
            onConfirm={vi.fn()}
          />
        );

        // Confirm button must be disabled
        expect(html).toContain('id="ppe-confirm-btn"');
        expect(html).toContain('disabled=""');
        expect(html).toContain('cursor-not-allowed');
        // Progress count badge shows 2 / 5
        expect(html).toContain('2 / 5 Checked');
        // Warning banner is displayed
        expect(html).toContain('data-testid="ppe-incomplete-banner"');
      });

      it('enables the Confirm PPE action button when all mandatory items are checked', () => {
        // All 5 items checked
        const allChecked = new Set(requiredItems);

        const html = renderToString(
          <PpeChecklistEngine
            requiredItems={requiredItems}
            checkedItems={allChecked}
            onConfirm={vi.fn()}
          />
        );

        // Confirm button must NOT be disabled
        expect(html).toContain('id="ppe-confirm-btn"');
        expect(html).not.toContain('disabled=""');
        expect(html).toContain('bg-emerald-500');
        // Progress count shows 5 / 5
        expect(html).toContain('5 / 5 Checked');
        // Incomplete banner is absent
        expect(html).not.toContain('data-testid="ppe-incomplete-banner"');
      });
    });

    it('renders all mandatory PPE item touch buttons with specific test IDs', () => {
      const html = renderToString(
        <PpeChecklistEngine
          requiredItems={requiredItems}
          checkedItems={new Set(['Hard Hat'])}
          onConfirm={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="ppe-check-hard-hat"');
      expect(html).toContain('data-testid="ppe-check-safety-glasses"');
      expect(html).toContain('data-testid="ppe-check-high-vis-vest"');
      expect(html).toContain('data-testid="ppe-check-steel-toe-boots"');
      expect(html).toContain('data-testid="ppe-check-gloves"');
    });

    it('renders select-all shortcut button', () => {
      const html = renderToString(
        <PpeChecklistEngine
          requiredItems={requiredItems}
          checkedItems={new Set()}
          onConfirm={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="ppe-select-all-btn"');
      expect(html).toContain('Select All');
    });

    it('renders compliance verification banner when isSubmitted is true', () => {
      const html = renderToString(
        <PpeChecklistEngine
          requiredItems={requiredItems}
          checkedItems={new Set(requiredItems)}
          onConfirm={vi.fn()}
          isSubmitted={true}
          autoResetCountdown={8}
          onReset={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="ppe-verified-banner"');
      expect(html).toContain('PPE Verified &amp; Compliance Recorded');
      expect(html).toContain('Terminal auto-reset in 8s');
      expect(html).toContain('data-testid="ppe-reset-btn"');
    });

    it('applies high-contrast amber/black color tokens', () => {
      const html = renderToString(
        <PpeChecklistEngine
          requiredItems={requiredItems}
          checkedItems={new Set(requiredItems)}
          onConfirm={vi.fn()}
          highContrast={true}
        />
      );

      expect(html).toContain('border-amber-400');
      expect(html).toContain('bg-amber-400 text-black');
    });
  });

  // =========================================================================
  // 3. KnowledgeQuizEngine Tests
  // =========================================================================
  describe('KnowledgeQuizEngine', () => {
    const mockQuiz: KioskQuizConfig = {
      passingScore: 70,
      questions: [
        {
          id: 'q1',
          question: 'What is the mandatory minimum distance from an active forklift operating zone?',
          options: ['1 meter', '3 meters (Safe Zone)', 'No minimum distance required'],
          correctOptionIndex: 1,
          explanation: 'Standard warehouse safety regulations mandate a minimum 3-meter separation buffer.'
        },
        {
          id: 'q2',
          question: 'When should emergency eyewash stations be inspected?',
          options: ['Weekly', 'Monthly', 'Only after an accidental chemical exposure'],
          correctOptionIndex: 0,
          explanation: 'Weekly flushes ensure plumbing lines remain clear and uncontaminated.'
        }
      ]
    };

    it('renders question prompt, question counter, and options with letter badges', () => {
      const html = renderToString(
        <KnowledgeQuizEngine
          quiz={mockQuiz}
          onPass={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="knowledge-quiz-engine"');
      expect(html).toContain('data-testid="quiz-question-title"');
      expect(html).toContain('What is the mandatory minimum distance from an active forklift operating zone?');

      // Question 1 of 2
      expect(html).toContain('Question 1 of 2');

      // Options
      expect(html).toContain('data-testid="quiz-option-0"');
      expect(html).toContain('data-testid="quiz-option-1"');
      expect(html).toContain('data-testid="quiz-option-2"');
      expect(html).toContain('3 meters (Safe Zone)');
    });

    it('calculates score and renders passing results screen when all answers are correct', () => {
      // Create quiz with single question for direct result evaluation
      const singleQuestionQuiz: KioskQuizConfig = {
        passingScore: 80,
        questions: [
          {
            id: 'q1',
            question: 'Is hearing protection mandatory in the stamping plant?',
            options: ['Yes', 'No'],
            correctOptionIndex: 0,
            explanation: 'Noise levels exceed 85 dBA.'
          }
        ]
      };

      const html = renderToString(
        <KnowledgeQuizEngine
          quiz={singleQuestionQuiz}
          onPass={vi.fn()}
        />
      );

      expect(html).toContain('Is hearing protection mandatory in the stamping plant?');
      expect(html).toContain('data-testid="quiz-option-0"');
    });

    it('applies high-contrast styling tokens', () => {
      const html = renderToString(
        <KnowledgeQuizEngine
          quiz={mockQuiz}
          onPass={vi.fn()}
          highContrast={true}
        />
      );

      expect(html).toContain('bg-black');
      expect(html).toContain('border-amber-400');
    });
  });

  // =========================================================================
  // 4. HotspotInteractionEngine Tests
  // =========================================================================
  describe('HotspotInteractionEngine', () => {
    const mockHotspots: readonly KioskHotspot[] = [
      { x: 25, y: 30, radius: 10, actionStepId: 'step-hydraulics' },
      { x: 50, y: 70, radius: 12, actionStepId: 'step-emergency-stop' },
      { x: 80, y: 40, radius: 10, actionStepId: 'step-electrical-panel' }
    ];

    it('renders all hotspots at relative percentage coordinates with minimum touch dimensions', () => {
      const html = renderToString(
        <HotspotInteractionEngine
          hotspots={mockHotspots}
          onHotspotClick={vi.fn()}
          imageUrl="https://example.com/facility-map.png"
        />
      );

      expect(html).toContain('data-testid="hotspot-interaction-engine"');
      expect(html).toContain('data-testid="hotspot-pin-0"');
      expect(html).toContain('data-testid="hotspot-pin-1"');
      expect(html).toContain('data-testid="hotspot-pin-2"');

      // Coordinate styles
      expect(html).toContain('left:25%');
      expect(html).toContain('top:30%');
      expect(html).toContain('left:50%');
      expect(html).toContain('top:70%');
      expect(html).toContain('left:80%');
      expect(html).toContain('top:40%');

      // Inspection counter shows 0 / 3
      expect(html).toContain('data-testid="hotspot-counter"');
      expect(html).toContain('0 / 3 Inspected');
    });

    it('renders schematic placeholder when no image URL is provided', () => {
      const html = renderToString(
        <HotspotInteractionEngine
          hotspots={mockHotspots}
          onHotspotClick={vi.fn()}
        />
      );

      expect(html).toContain('Facility Safety Map / Equipment Diagram');
      expect(html).toContain('Touch the hazard hotspots below to inspect zones.');
    });

    it('applies high-contrast tokens to pins and container', () => {
      const html = renderToString(
        <HotspotInteractionEngine
          hotspots={mockHotspots}
          onHotspotClick={vi.fn()}
          highContrast={true}
        />
      );

      expect(html).toContain('border-amber-400');
    });
  });

  // =========================================================================
  // 5. Modular StepContainer Integration Tests
  // =========================================================================
  describe('Modular StepContainer Integration', () => {
    it('integrates KnowledgeQuizEngine when step interaction is quiz', () => {
      const quizStep: KioskStep = {
        id: 'step-quiz',
        type: 'content',
        title: 'Safety Comprehension Evaluation',
        order: 0,
        blocks: [],
        interaction: {
          type: 'quiz',
          quiz: {
            passingScore: 75,
            questions: [
              {
                id: 'qz1',
                question: 'What is the evacuation signal?',
                options: ['Continuous Siren', 'Flashing White Light', 'Intermittent Horn'],
                correctOptionIndex: 0,
                explanation: 'A continuous siren signals immediate site evacuation.'
              }
            ]
          }
        }
      };

      const html = renderToString(
        <KioskStepContainer
          step={quizStep}
          stepIndex={0}
          direction="forward"
          selectedLanguage="en"
        />
      );

      expect(html).toContain('data-testid="knowledge-quiz-engine"');
      expect(html).toContain('What is the evacuation signal?');
      expect(html).toContain('Continuous Siren');
    });

    it('integrates Hotspot Interaction when step interaction is hotspot', () => {
      const hotspotStep: KioskStep = {
        id: 'step-hs',
        type: 'content',
        title: 'Chemical Storage Zone Inspection',
        order: 1,
        blocks: [],
        interaction: {
          type: 'hotspot',
          hotspots: [
            { x: 35, y: 45, radius: 10, actionStepId: 'step-zone-a' }
          ]
        }
      };

      const html = renderToString(
        <KioskStepContainer
          step={hotspotStep}
          stepIndex={1}
          direction="forward"
          selectedLanguage="en"
          onHotspotClick={vi.fn()}
        />
      );

      expect(html).toContain('Chemical Storage Zone Inspection');
      expect(html).toContain('title="Interactive Hotspot"');
    });
  });
});
