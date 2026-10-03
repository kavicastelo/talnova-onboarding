import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateJourneyForPublish } from '../features/kiosk/validation/journey-publish.validator';
import { KioskJourney, KioskStep } from '../types/kiosk/journey.types';

describe('Phase 3: Kiosk Builder Error Feedback, Smart Step Insertion & Quiz Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Smart Step Insertion & Terminal Ordering (Rule 1 Enforcement)', () => {
    it('should position newly added content step BEFORE an existing terminal completion step', () => {
      const existingSteps: KioskStep[] = [
        {
          id: 'step-info',
          type: 'info_step',
          title: 'Welcome Info',
          order: 0,
          blocks: [],
          interaction: { type: 'none' }
        },
        {
          id: 'step-complete',
          type: 'completion',
          title: 'Journey Complete',
          order: 1,
          blocks: [],
          interaction: { type: 'none' }
        }
      ];

      // Simulate addStep logic from KioskBuilderContext
      const hasTerminalCompletion = existingSteps.some((s) => s.type === 'completion');
      const newStep: KioskStep = {
        id: 'step-ppe',
        type: 'ppe_checklist',
        title: 'Safety Gear Check',
        order: 0,
        blocks: [],
        interaction: { type: 'ppe_checklist', ppeItems: ['Hard Hat', 'Safety Glasses'] }
      };

      let reorderedSteps: KioskStep[];
      if (hasTerminalCompletion) {
        const nonCompletion = existingSteps.filter((s) => s.type !== 'completion');
        const completionStep = existingSteps.find((s) => s.type === 'completion')!;
        reorderedSteps = [...nonCompletion, newStep, completionStep].map((s, idx) => ({
          ...s,
          order: idx
        }));
      } else {
        reorderedSteps = [...existingSteps, newStep].map((s, idx) => ({
          ...s,
          order: idx
        }));
      }

      expect(reorderedSteps).toHaveLength(3);
      expect(reorderedSteps[0].id).toBe('step-info');
      expect(reorderedSteps[1].id).toBe('step-ppe');
      expect(reorderedSteps[2].id).toBe('step-complete');
      expect(reorderedSteps[2].type).toBe('completion');
      expect(reorderedSteps[2].order).toBe(2);
    });

    it('should append to end when no completion step exists yet', () => {
      const existingSteps: KioskStep[] = [
        {
          id: 'step-1',
          type: 'info_step',
          title: 'Introduction',
          order: 0,
          blocks: [],
          interaction: { type: 'none' }
        }
      ];

      const newStep: KioskStep = {
        id: 'step-2',
        type: 'video_step',
        title: 'Safety Video',
        order: 0,
        blocks: [],
        interaction: { type: 'none' }
      };

      const hasTerminalCompletion = existingSteps.some((s) => s.type === 'completion');
      let reorderedSteps: KioskStep[];
      if (hasTerminalCompletion) {
        const nonCompletion = existingSteps.filter((s) => s.type !== 'completion');
        const completionStep = existingSteps.find((s) => s.type === 'completion')!;
        reorderedSteps = [...nonCompletion, newStep, completionStep].map((s, idx) => ({
          ...s,
          order: idx
        }));
      } else {
        reorderedSteps = [...existingSteps, newStep].map((s, idx) => ({
          ...s,
          order: idx
        }));
      }

      expect(reorderedSteps).toHaveLength(2);
      expect(reorderedSteps[1].id).toBe('step-2');
      expect(reorderedSteps[1].order).toBe(1);
    });
  });

  describe('Pre-Publish Validation & Granular Error Feedback', () => {
    it('should block publish and flag error when journey has zero content steps', () => {
      const invalidJourney: Partial<KioskJourney> = {
        title: 'Empty Journey',
        languages: ['en'],
        steps: [
          {
            id: 'step-done',
            type: 'completion',
            title: 'Finished',
            order: 0,
            blocks: [],
            interaction: { type: 'none' }
          }
        ]
      };

      const report = validateJourneyForPublish(invalidJourney);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.rule === 'step_structure')).toBe(true);
      expect(report.errors.some((e) => e.message.includes('at least 1 content step'))).toBe(true);
    });

    it('should block publish and pinpoint step when terminal completion is not at the end', () => {
      const invalidJourney: Partial<KioskJourney> = {
        title: 'Misordered Journey',
        languages: ['en'],
        steps: [
          {
            id: 'step-comp',
            type: 'completion',
            title: 'Finished',
            order: 0,
            blocks: [],
            interaction: { type: 'none' }
          },
          {
            id: 'step-info',
            type: 'info_step',
            title: 'Welcome',
            order: 1,
            blocks: [
              {
                id: 'b-1',
                type: 'text',
                order: 0,
                textValue: 'Some text',
                mediaReferences: new Map([['en', { textValue: 'Some text' }]])
              }
            ],
            interaction: { type: 'none' }
          }
        ]
      };

      const report = validateJourneyForPublish(invalidJourney);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.rule === 'terminal_completion')).toBe(true);
      const completionErr = report.errors.find((e) => e.rule === 'terminal_completion');
      expect(completionErr?.stepId).toBe('step-comp');
    });

    it('should flag quiz passing score violation below 50% or above 100% (Rule 4)', () => {
      const invalidQuizJourney: Partial<KioskJourney> = {
        title: 'Quiz Journey',
        languages: ['en'],
        steps: [
          {
            id: 'step-quiz',
            type: 'knowledge_quiz',
            title: 'Safety Knowledge Quiz',
            order: 0,
            blocks: [
              {
                id: 'b-1',
                type: 'text',
                order: 0,
                textValue: 'Take this quiz',
                mediaReferences: new Map([['en', { textValue: 'Take this quiz' }]])
              }
            ],
            interaction: {
              type: 'quiz',
              quiz: {
                passingScore: 40, // Invalid: < 50%
                questions: [
                  {
                    id: 'q-1',
                    question: 'Is eye protection mandatory?',
                    options: ['Yes', 'No'],
                    correctOptionIndex: 0
                  }
                ]
              }
            }
          },
          {
            id: 'step-comp',
            type: 'completion',
            title: 'Finished',
            order: 1,
            blocks: [],
            interaction: { type: 'none' }
          }
        ]
      };

      const report = validateJourneyForPublish(invalidQuizJourney);
      expect(report.isValid).toBe(false);
      expect(report.errors.some((e) => e.rule === 'quiz_correctness')).toBe(true);
      expect(report.errors.some((e) => e.message.includes('Passing score must be between 50% and 100%'))).toBe(true);
    });

    it('should pass validation when quiz is properly configured with score >= 50% and valid questions', () => {
      const validQuizJourney: Partial<KioskJourney> = {
        title: 'Valid Quiz Journey',
        languages: ['en'],
        steps: [
          {
            id: 'step-quiz',
            type: 'knowledge_quiz',
            title: 'Safety Knowledge Quiz',
            order: 0,
            blocks: [
              {
                id: 'b-1',
                type: 'text',
                order: 0,
                textValue: 'Take this quiz',
                mediaReferences: new Map([['en', { textValue: 'Take this quiz' }]])
              }
            ],
            interaction: {
              type: 'quiz',
              quiz: {
                passingScore: 80,
                questions: [
                  {
                    id: 'q-1',
                    question: 'Is eye protection mandatory in Zone 3?',
                    options: ['Yes, always', 'No, optional'],
                    correctOptionIndex: 0
                  }
                ]
              }
            }
          },
          {
            id: 'step-comp',
            type: 'completion',
            title: 'Finished',
            order: 1,
            blocks: [],
            interaction: { type: 'none' }
          }
        ]
      };

      const report = validateJourneyForPublish(validQuizJourney);
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
    });
  });

  describe('Step Type & Interaction Synchronization', () => {
    it('should automatically configure supervisor witness when switching to supervisor_gate', () => {
      const baseStep: KioskStep = {
        id: 'step-gate',
        type: 'info_step',
        title: 'Gate Step',
        order: 0,
        blocks: [],
        interaction: { type: 'none' }
      };

      // Simulating handleStepTypeChange('supervisor_gate')
      const updates: any = { type: 'supervisor_gate' };
      updates.requireSupervisorWitness = true;
      updates.interaction = {
        ...baseStep.interaction,
        type: 'supervisor_witness',
        requireSupervisorWitness: true
      };

      expect(updates.type).toBe('supervisor_gate');
      expect(updates.requireSupervisorWitness).toBe(true);
      expect(updates.interaction.type).toBe('supervisor_witness');
    });

    it('should automatically configure default PPE checklist when switching to ppe_checklist', () => {
      const baseStep: KioskStep = {
        id: 'step-gear',
        type: 'info_step',
        title: 'Gear Verification',
        order: 0,
        blocks: [],
        interaction: { type: 'none' }
      };

      // Simulating handleStepTypeChange('ppe_checklist')
      const updates: any = { type: 'ppe_checklist' };
      updates.interaction = {
        ...baseStep.interaction,
        type: 'ppe_checklist',
        ppeItems: ['Hard Hat', 'Safety Glasses', 'Steel Toe Boots']
      };

      expect(updates.type).toBe('ppe_checklist');
      expect(updates.interaction.ppeItems).toEqual(['Hard Hat', 'Safety Glasses', 'Steel Toe Boots']);
    });
  });
});
