import React, { createContext, useContext, useState } from 'react';
import { KioskJourney } from '../../../types/kiosk/journey.types';
import { KioskStep, KioskStepType } from '../../../types/kiosk/step.types';
import { KioskBlock, KioskBlockType } from '../../../types/kiosk/block.types';
import { kioskService } from '../services/kiosk.service';

interface KioskBuilderContextProps {
  journey: Partial<KioskJourney> | null;
  originalJourney: KioskJourney | null;
  hasUnsavedChanges: boolean;
  activeStepId: string | null;
  activeBlockId: string | null;
  validationErrors: string[];
  isSaving: boolean;
  error: string | null;

  loadJourney: (journeyId: string) => Promise<void>;
  updateJourneyDetails: (details: Partial<KioskJourney>) => void;
  saveJourney: () => Promise<void>;
  publishJourney: () => Promise<KioskJourney | null>;
  
  // Step Actions
  setActiveStepId: (stepId: string | null) => void;
  addStep: (type: KioskStepType) => void;
  updateStep: (stepId: string, updatedStep: Partial<KioskStep>) => void;
  removeStep: (stepId: string) => void;
  reorderSteps: (startIndex: number, endIndex: number) => void;

  // Block Actions
  setActiveBlockId: (blockId: string | null) => void;
  addBlockToStep: (stepId: string, type: KioskBlockType) => void;
  updateBlockInStep: (stepId: string, blockId: string, updatedBlock: Partial<KioskBlock>) => void;
  removeBlockFromStep: (stepId: string, blockId: string) => void;
  reorderBlocksInStep: (stepId: string, startIndex: number, endIndex: number) => void;
  
  validateJourney: () => boolean;
}

const KioskBuilderContext = createContext<KioskBuilderContextProps | undefined>(undefined);

const generateId = () => Math.random().toString(36).substring(2, 9);

export const KioskBuilderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [journey, setJourney] = useState<Partial<KioskJourney> | null>(null);
  const [originalJourney, setOriginalJourney] = useState<KioskJourney | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadJourney = async (journeyId: string) => {
    setError(null);
    try {
      const data = await kioskService.getJourney(journeyId);
      setJourney(data);
      setOriginalJourney(data);
      setHasUnsavedChanges(false);
      setValidationErrors([]);
      if (data.steps && data.steps.length > 0) {
        setActiveStepId(data.steps[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load kiosk journey');
      setJourney(null);
      setOriginalJourney(null);
    }
  };

  const updateJourneyDetails = (details: Partial<KioskJourney>) => {
    if (!journey) return;
    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, ...details };
    });
    setHasUnsavedChanges(true);
  };

  const saveJourney = async () => {
    if (!journey || !journey._id) return;
    setIsSaving(true);
    setError(null);
    try {
      // Validate structure before pushing to backend
      validateJourney();
      
      const updated = await kioskService.updateJourney(journey._id, journey);
      setJourney(updated);
      setOriginalJourney(updated);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save kiosk journey');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const publishJourney = async (): Promise<KioskJourney | null> => {
    if (!journey || !journey._id) return null;
    setError(null);
    
    // First perform full local validation
    const isValid = validateJourney();
    if (!isValid) {
      setError('Cannot publish: Journey has validation errors.');
      return null;
    }

    try {
      if (hasUnsavedChanges) {
        await saveJourney();
      }
      const published = await kioskService.publishJourney(journey._id);
      setJourney(published);
      setOriginalJourney(published);
      setHasUnsavedChanges(false);
      return published;
    } catch (err: any) {
      setError(err?.message || 'Failed to publish kiosk journey');
      return null;
    }
  };

  // --- Step Handlers ---

  const addStep = (type: KioskStepType) => {
    if (!journey) return;
    const steps = [...(journey.steps || [])];
    
    const newStep: KioskStep = {
      id: `step-${generateId()}`,
      type,
      title: `New ${type.replace('_step', '').charAt(0).toUpperCase() + type.replace('_step', '').slice(1)} Step`,
      order: steps.length,
      blocks: [],
      interaction: {
        type: type === 'interactive_confirmation' ? 'hold_to_confirm' : 'tap_to_continue'
      }
    };

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps: [...steps, newStep] };
    });
    setActiveStepId(newStep.id);
    setHasUnsavedChanges(true);
  };

  const updateStep = (stepId: string, updatedStep: Partial<KioskStep>) => {
    if (!journey) return;
    const steps = (journey.steps || []).map((step) => {
      if (step.id === stepId) {
        return { ...step, ...updatedStep };
      }
      return step;
    });

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps };
    });
    setHasUnsavedChanges(true);
  };

  const removeStep = (stepId: string) => {
    if (!journey) return;
    const steps = (journey.steps || [])
      .filter((step) => step.id !== stepId)
      .map((step, idx) => ({ ...step, order: idx })); // Recalculate order

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps };
    });
    if (activeStepId === stepId) {
      setActiveStepId(steps.length > 0 ? steps[0].id : null);
    }
    setHasUnsavedChanges(true);
  };

  const reorderSteps = (startIndex: number, endIndex: number) => {
    if (!journey) return;
    const steps = [...(journey.steps || [])];
    const [removed] = steps.splice(startIndex, 1);
    steps.splice(endIndex, 0, removed);

    const reordered = steps.map((step, idx) => ({ ...step, order: idx }));

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps: reordered };
    });
    setHasUnsavedChanges(true);
  };

  // --- Block Handlers ---

  const addBlockToStep = (stepId: string, type: KioskBlockType) => {
    if (!journey) return;

    const createDefaultBlock = (blockType: KioskBlockType, order: number): KioskBlock => {
      const base = {
        id: `block-${generateId()}`,
        type: blockType,
        order,
        mediaReferences: {
          en: { textValue: "" }
        }
      };

      switch (blockType) {
        case 'text':
          return {
            ...base,
            type: 'text',
            settings: { size: 'medium', contrastMode: false }
          } as KioskBlock;
        case 'image':
          return {
            ...base,
            type: 'image',
            settings: { zoomable: false, contrastMode: false }
          } as KioskBlock;
        case 'audio':
          return {
            ...base,
            type: 'audio',
            settings: { autoplay: false, loop: false, controls: true }
          } as KioskBlock;
        case 'video':
          return {
            ...base,
            type: 'video',
            settings: { autoplay: false, loop: false, aspect: 'landscape' }
          } as KioskBlock;
        case 'animation':
          return {
            ...base,
            type: 'animation',
            settings: { autoplay: true, loop: true }
          } as KioskBlock;
        case 'icon':
          return {
            ...base,
            type: 'icon',
            settings: { iconName: 'info', size: 'medium', theme: 'info' }
          } as KioskBlock;
        case 'illustration':
          return {
            ...base,
            type: 'illustration',
            settings: { contrastMode: false }
          } as KioskBlock;
        default:
          throw new Error(`Unsupported block type: ${blockType}`);
      }
    };

    const steps = (journey.steps || []).map((step) => {
      if (step.id === stepId) {
        const blocks = [...(step.blocks || [])];
        const newBlock = createDefaultBlock(type, blocks.length);
        return {
          ...step,
          blocks: [...blocks, newBlock]
        };
      }
      return step;
    });

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps };
    });
    setHasUnsavedChanges(true);
  };

  const updateBlockInStep = (stepId: string, blockId: string, updatedBlock: Partial<KioskBlock>) => {
    if (!journey) return;
    const steps = (journey.steps || []).map((step) => {
      if (step.id === stepId) {
        const blocks = (step.blocks || []).map((block) => {
          if (block.id === blockId) {
            return { ...block, ...updatedBlock } as KioskBlock;
          }
          return block;
        });
        return { ...step, blocks };
      }
      return step;
    });

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps };
    });
    setHasUnsavedChanges(true);
  };

  const removeBlockFromStep = (stepId: string, blockId: string) => {
    if (!journey) return;
    const steps = (journey.steps || []).map((step) => {
      if (step.id === stepId) {
        const blocks = (step.blocks || [])
          .filter((block) => block.id !== blockId)
          .map((block, idx) => ({ ...block, order: idx } as KioskBlock));
        return { ...step, blocks };
      }
      return step;
    });

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps };
    });
    if (activeBlockId === blockId) {
      setActiveBlockId(null);
    }
    setHasUnsavedChanges(true);
  };

  const reorderBlocksInStep = (stepId: string, startIndex: number, endIndex: number) => {
    if (!journey) return;
    const steps = (journey.steps || []).map((step) => {
      if (step.id === stepId) {
        const blocks = [...(step.blocks || [])];
        const [removed] = blocks.splice(startIndex, 1);
        blocks.splice(endIndex, 0, removed);
        const reordered = blocks.map((block, idx) => ({ ...block, order: idx } as KioskBlock));
        return { ...step, blocks: reordered };
      }
      return step;
    });

    setJourney((prev) => {
      if (!prev) return null;
      return { ...prev, steps };
    });
    setHasUnsavedChanges(true);
  };

  // --- Client Side Validation ---

  const validateJourney = (): boolean => {
    const errors: string[] = [];
    if (!journey) return false;

    if (!journey.title || journey.title.trim() === "") {
      errors.push("Journey title is required.");
    }

    if (!journey.languages || journey.languages.length === 0) {
      errors.push("At least one language must be selected.");
    }

    const steps = journey.steps || [];
    if (steps.length === 0) {
      errors.push("Journey must contain at least one step.");
    }

    steps.forEach((step, idx) => {
      if (!step.title || step.title.trim() === "") {
        errors.push(`Step ${idx + 1} is missing a title.`);
      }

      // Check step destinations exist
      const stepIds = steps.map((s) => s.id);
      
      if (step.interaction?.correctStepId && !stepIds.includes(step.interaction.correctStepId)) {
        errors.push(`Step "${step.title}" references an invalid destination step for correct path.`);
      }
      if (step.interaction?.incorrectStepId && !stepIds.includes(step.interaction.incorrectStepId)) {
        errors.push(`Step "${step.title}" references an invalid destination step for incorrect path.`);
      }

      if (step.interaction?.hotspots) {
        step.interaction.hotspots.forEach((hs, hsIdx) => {
          if (!stepIds.includes(hs.actionStepId)) {
            errors.push(`Step "${step.title}" hotspot ${hsIdx + 1} references an invalid destination step.`);
          }
        });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  return (
    <KioskBuilderContext.Provider
      value={{
        journey,
        originalJourney,
        hasUnsavedChanges,
        activeStepId,
        activeBlockId,
        validationErrors,
        isSaving,
        error,
        loadJourney,
        updateJourneyDetails,
        saveJourney,
        publishJourney,
        setActiveStepId,
        addStep,
        updateStep,
        removeStep,
        reorderSteps,
        setActiveBlockId,
        addBlockToStep,
        updateBlockInStep,
        removeBlockFromStep,
        reorderBlocksInStep,
        validateJourney
      }}
    >
      {children}
    </KioskBuilderContext.Provider>
  );
};

export const useKioskBuilder = () => {
  const context = useContext(KioskBuilderContext);
  if (!context) {
    throw new Error('useKioskBuilder must be used within a KioskBuilderProvider');
  }
  return context;
};
