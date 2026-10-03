import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { normalizeCloudMediaUrl, MediaAssetPicker } from '../features/kiosk/components/builder/MediaAssetPicker';
import { StepTypeStudio } from '../features/kiosk/components/builder/StepTypeStudio';
import { KioskBuilderInner } from '../features/kiosk/components/KioskBuilder';
import { KioskStep } from '../types/kiosk/step.types';
import { KioskJourney } from '../types/kiosk/journey.types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultVal?: string | { defaultValue?: string }) => 
      typeof defaultVal === 'string' ? defaultVal : defaultVal?.defaultValue || _key,
    i18n: { language: 'en', changeLanguage: vi.fn() }
  })
}));

// Mock upload service
vi.mock('../services/upload.service', () => ({
  uploadService: {
    uploadFile: vi.fn().mockResolvedValue({
      uploadId: 'upload-test-mock-uuid',
      url: 'https://cdn.talnova.internal/assets/test.mp4'
    })
  }
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Mock useKioskBuilder context
const mockJourneyState = {
  _id: 'j-test-123',
  title: 'Warehouse Safety Induction',
  languages: ['en', 'es'],
  steps: [
    {
      id: 'step-intro-1',
      type: 'info_step',
      title: 'Welcome Slide',
      order: 0,
      blocks: [],
      interaction: { type: 'tap_to_continue' }
    }
  ],
  settings: { idleTimeoutSeconds: 60 }
};

vi.mock('../features/kiosk/context/KioskBuilderContext', () => ({
  useKioskBuilder: () => ({
    journey: mockJourneyState,
    activeStepId: 'step-intro-1',
    activeBlockId: null,
    validationErrorDetails: [],
    validationReport: { isValid: true },
    hasUnsavedChanges: false,
    isSaving: false,
    error: null,
    loadJourney: vi.fn(),
    addStep: vi.fn(),
    updateStep: vi.fn(),
    removeStep: vi.fn(),
    reorderSteps: vi.fn(),
    addBlockToStep: vi.fn(),
    updateBlockInStep: vi.fn(),
    removeBlockFromStep: vi.fn(),
    setActiveStepId: vi.fn(),
    setActiveBlockId: vi.fn(),
    updateJourneyDetails: vi.fn(),
    saveJourney: vi.fn(),
    publishJourney: vi.fn(),
    rollbackJourney: vi.fn(),
    listVersions: vi.fn().mockResolvedValue([]),
    validateJourney: vi.fn().mockReturnValue(true)
  }),
  KioskBuilderProvider: ({ children }: any) => <>{children}</>
}));

describe('K-UI-001: Kiosk Builder UI/UX Enhancements Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* =========================================================================
   * 1. CLOUD MEDIA URL NORMALIZATION TESTS
   * ========================================================================= */
  describe('Cloud Media Asset Normalization (YouTube, Google Drive, Dropbox, Vimeo, Loom)', () => {
    it('should transform standard YouTube watch URLs into privacy-enhanced embed links', () => {
      const result = normalizeCloudMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'video');
      expect(result.provider).toBe('youtube');
      expect(result.embedUrl).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1');
    });

    it('should transform short youtu.be links into embed links', () => {
      const result = normalizeCloudMediaUrl('https://youtu.be/dQw4w9WgXcQ', 'video');
      expect(result.provider).toBe('youtube');
      expect(result.embedUrl).toContain('dQw4w9WgXcQ');
    });

    it('should transform YouTube Shorts URLs into embed links', () => {
      const result = normalizeCloudMediaUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ', 'video');
      expect(result.provider).toBe('youtube');
      expect(result.embedUrl).toContain('dQw4w9WgXcQ');
    });

    it('should transform Google Drive video link to /preview stream URL', () => {
      const result = normalizeCloudMediaUrl('https://drive.google.com/file/d/1AbC2DeF3GhI/view?usp=sharing', 'video');
      expect(result.provider).toBe('google-drive');
      expect(result.embedUrl).toBe('https://drive.google.com/file/d/1AbC2DeF3GhI/preview');
    });

    it('should transform Google Drive image link to direct /uc?export=view export link', () => {
      const result = normalizeCloudMediaUrl('https://drive.google.com/file/d/1AbC2DeF3GhI/view', 'image');
      expect(result.provider).toBe('google-drive');
      expect(result.embedUrl).toBe('https://drive.google.com/uc?export=view&id=1AbC2DeF3GhI');
    });

    it('should transform Dropbox links from dl=0 to raw=1 for direct streaming', () => {
      const result = normalizeCloudMediaUrl('https://www.dropbox.com/s/sample123/safety_brief.mp4?dl=0', 'video');
      expect(result.provider).toBe('dropbox');
      expect(result.embedUrl).toBe('https://www.dropbox.com/s/sample123/safety_brief.mp4?raw=1');
    });

    it('should transform Vimeo video link into player.vimeo.com embed with privacy mode', () => {
      const result = normalizeCloudMediaUrl('https://vimeo.com/76979871', 'video');
      expect(result.provider).toBe('vimeo');
      expect(result.embedUrl).toBe('https://player.vimeo.com/video/76979871?dnt=1');
    });

    it('should transform Loom share links into loom.com/embed links', () => {
      const result = normalizeCloudMediaUrl('https://www.loom.com/share/9876543210abcdef', 'video');
      expect(result.provider).toBe('loom');
      expect(result.embedUrl).toBe('https://www.loom.com/embed/9876543210abcdef');
    });

    it('should preserve direct CDN and MP4/PNG URLs without mutation', () => {
      const directUrl = 'https://assets.talnova.internal/video/evac-guide.mp4';
      const result = normalizeCloudMediaUrl(directUrl, 'video');
      expect(result.provider).toBe('direct');
      expect(result.embedUrl).toBe(directUrl);
    });

    it('should return empty embed and none provider for blank URLs', () => {
      const result = normalizeCloudMediaUrl('   ', 'video');
      expect(result.provider).toBe('none');
      expect(result.embedUrl).toBe('');
    });
  });

  /* =========================================================================
   * 2. MEDIA ASSET PICKER COMPONENT TESTS
   * ========================================================================= */
  describe('MediaAssetPicker Drag & Drop and Cloud Importer UI', () => {
    it('should render upload dropzone, cloud link switcher, and file type guide', () => {
      const html = renderToString(
        <MediaAssetPicker
          mediaType="video"
          languageCode="en"
          label="Training Video"
          onAssetChange={vi.fn()}
        />
      );

      expect(html).toContain('Upload File');
      expect(html).toContain('Cloud Link');
      expect(html).toContain('Direct URL');
      expect(html).toContain('Direct upload to Cloudflare R2 / S3 storage');
    });

    it('should display active cloud asset preview when embedUrl is present', () => {
      const html = renderToString(
        <MediaAssetPicker
          mediaType="video"
          currentEmbedUrl="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0"
          languageCode="en"
          onAssetChange={vi.fn()}
        />
      );

      expect(html).toContain('Loaded');
      expect(html).toContain('dQw4w9WgXcQ');
      expect(html).toContain('iframe');
    });

    it('should render audio narration picker with microphone/music styling for audio type', () => {
      const html = renderToString(
        <MediaAssetPicker
          mediaType="audio"
          currentUploadId="upload-narration-01"
          languageCode="es"
          label="Spanish Voiceover"
          onAssetChange={vi.fn()}
        />
      );

      expect(html).toContain('Spanish Voiceover');
      expect(html).toContain('ID: upload-narration-01');
      expect(html).toContain('audio src="/api/v1/kiosk/uploads/upload-narration-01"');
    });
  });

  /* =========================================================================
   * 3. SPECIALIZED STEP-TYPE STUDIO TESTS
   * ========================================================================= */
  describe('StepTypeStudio: Context-Aware Specialized Step Editors', () => {
    const mockJourney: Partial<KioskJourney> = {
      languages: ['en', 'es'],
      settings: { idleTimeoutSeconds: 45 } as any
    };

    it('should render video step studio with autoplay toggle and watch threshold', () => {
      const videoStep: KioskStep = {
        id: 'step-video-1',
        type: 'video_step',
        title: 'Forklift Safety Reel',
        order: 0,
        blocks: [
          {
            id: 'block-vid-1',
            type: 'video',
            order: 0,
            settings: { autoplay: true, loop: false, aspect: '16:9' },
            mediaReferences: { en: { embedUrl: 'https://youtube.com/watch?v=123' } }
          } as any
        ],
        interaction: { type: 'tap_to_continue' }
      };

      const html = renderToString(
        <StepTypeStudio
          step={videoStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="video-step-studio"');
      expect(html).toContain('Video Presentation Asset');
      expect(html).toContain('Auto-Play on Slide Entry');
      expect(html).toContain('Minimum Watch-Through Requirement');
    });

    it('should render warning step studio with all 4 OSHA presets and dwell timer', () => {
      const warningStep: KioskStep = {
        id: 'step-warn-1',
        type: 'warning_step',
        title: '[WARNING] Pinch Point Hazard',
        order: 1,
        blocks: [],
        interaction: { type: 'hold_to_confirm', holdDurationMs: 4000 }
      };

      const html = renderToString(
        <StepTypeStudio
          step={warningStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="warning-step-studio"');
      expect(html).toContain('OSHA Safety Hazard Standard');
      expect(html).toContain('DANGER');
      expect(html).toContain('WARNING');
      expect(html).toContain('CAUTION');
      expect(html).toContain('NOTICE');
      expect(html).toContain('Mandatory Reading Dwell Timer');
      expect(html).toContain('Seconds');
    });

    it('should render interactive confirmation studio with hold duration slider and tactile test button', () => {
      const confirmStep: KioskStep = {
        id: 'step-confirm-1',
        type: 'interactive_confirmation',
        title: 'Safety Attestation',
        order: 2,
        blocks: [],
        interaction: { type: 'hold_to_confirm', holdDurationMs: 3000 }
      };

      const html = renderToString(
        <StepTypeStudio
          step={confirmStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="interactive-confirmation-studio"');
      expect(html).toContain('Hold-to-Confirm Dwell Duration');
      expect(html).toContain('Press');
      expect(html).toContain('Author Interactive Test');
      expect(html).toContain('Press &amp; Hold');
    });

    it('should render PPE checklist studio with quick-add badges and gear list', () => {
      const ppeStep: KioskStep = {
        id: 'step-ppe-1',
        type: 'ppe_checklist',
        title: 'PPE Verification',
        order: 3,
        blocks: [],
        interaction: {
          type: 'ppe_checklist',
          ppeItems: ['Hard Hat', 'Safety Glasses', 'Steel-Toe Boots']
        }
      };

      const html = renderToString(
        <StepTypeStudio
          step={ppeStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="ppe-checklist-studio"');
      expect(html).toContain('Standard PPE Gear Palette');
      expect(html).toContain('Hard Hat');
      expect(html).toContain('Safety Glasses');
      expect(html).toContain('Steel-Toe Boots');
      expect(html).toContain('Hi-Vis Vest');
      expect(html).toContain('Active Checklist Items');
    });

    it('should render knowledge quiz studio with passing score slider and question manager', () => {
      const quizStep: KioskStep = {
        id: 'step-quiz-1',
        type: 'knowledge_quiz',
        title: 'Comprehension Test',
        order: 4,
        blocks: [],
        interaction: {
          type: 'quiz',
          quiz: {
            passingScore: 85,
            questions: [
              {
                id: 'q1',
                question: 'Where is the primary emergency shutoff valve located?',
                options: ['Building A South Wall', 'Cafeteria Exit'],
                correctOptionIndex: 0
              }
            ]
          }
        }
      };

      const html = renderToString(
        <StepTypeStudio
          step={quizStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="knowledge-quiz-studio"');
      expect(html).toContain('Passing Score Threshold');
      expect(html).toContain('Passing');
      expect(html).toContain('Quiz Questions');
      expect(html).toContain('Where is the primary emergency shutoff valve located?');
    });

    it('should render emergency step studio with muster point and dispatch inputs', () => {
      const emergStep: KioskStep = {
        id: 'step-emerg-1',
        type: 'emergency_step',
        title: 'Evacuation Protocol',
        order: 5,
        blocks: [],
        interaction: {
          type: 'none',
          incorrectStepId: 'Muster Point Alpha',
          correctStepId: 'Ext. 911 / VHF Ch. 16'
        }
      };

      const html = renderToString(
        <StepTypeStudio
          step={emergStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="emergency-step-studio"');
      expect(html).toContain('Critical Emergency Evacuation Protocol');
      expect(html).toContain('Emergency Assembly / Muster Point');
      expect(html).toContain('Emergency Dispatch Hotline / Radio Channel');
    });

    it('should render supervisor gate studio with physical witness instructions', () => {
      const supStep: KioskStep = {
        id: 'step-sup-1',
        type: 'supervisor_gate',
        title: 'Witness Sign-off',
        order: 6,
        blocks: [],
        interaction: { type: 'supervisor_witness', requireSupervisorWitness: true }
      };

      const html = renderToString(
        <StepTypeStudio
          step={supStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="supervisor-gate-studio"');
      expect(html).toContain('Supervisor Physical Witness Requirement');
      expect(html).toContain('Co-Signature');
    });

    it('should render completion step studio with certificate and auto-reset preview', () => {
      const compStep: KioskStep = {
        id: 'step-comp-1',
        type: 'completion',
        title: 'All Modules Completed',
        order: 7,
        blocks: [],
        interaction: { type: 'tap_to_continue' }
      };

      const html = renderToString(
        <StepTypeStudio
          step={compStep}
          journey={mockJourney}
          onUpdateStep={vi.fn()}
          onAddBlock={vi.fn()}
          onUpdateBlock={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="completion-step-studio"');
      expect(html).toContain('Journey Completion &amp; Certificate');
      expect(html).toContain('idle timeout');
    });
  });

  /* =========================================================================
   * 4. KIOSK BUILDER ADJUSTABLE PANELS & ZEN MODE TESTS
   * ========================================================================= */
  describe('KioskBuilder Adjustable Split Panels and Zen Canvas Mode', () => {
    it('should render left and right resize handles and collapse toggle buttons', () => {
      const html = renderToString(
        <KioskBuilderInner journeyId="mock-journey-123" onExit={vi.fn()} />
      );

      // Verify draggable splitter handles exist
      expect(html).toContain('data-testid="left-resize-handle"');
      expect(html).toContain('data-testid="right-resize-handle"');

      // Verify collapse buttons exist on panel headers
      expect(html).toContain('data-testid="collapse-left-panel-btn"');
      expect(html).toContain('data-testid="collapse-right-panel-btn"');

      // Verify Zen Mode button exists in canvas header
      expect(html).toContain('data-testid="zen-mode-btn"');
    });

    it('should restore persisted panel layout from localStorage if present', () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
        removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
        clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
        key: vi.fn((i: number) => Object.keys(mockStorage)[i] || null),
        length: 0
      };
      Object.defineProperty(globalThis, 'localStorage', { value: storageMock, writable: true, configurable: true });
      if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true, configurable: true });
      }

      const testLayout = {
        leftWidth: 350,
        rightWidth: 490,
        leftCollapsed: false,
        rightCollapsed: false
      };
      
      storageMock.setItem('talnova_kiosk_builder_layout', JSON.stringify(testLayout));

      const html = renderToString(
        <KioskBuilderInner journeyId="mock-journey-123" onExit={vi.fn()} />
      );

      expect(html).toContain('width:350px');
      expect(html).toContain('width:490px');
    });

    it('should clamp out-of-range panel widths safely', () => {
      const mockStorage: Record<string, string> = {};
      const storageMock = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
        removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
        clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
        key: vi.fn((i: number) => Object.keys(mockStorage)[i] || null),
        length: 0
      };
      Object.defineProperty(globalThis, 'localStorage', { value: storageMock, writable: true, configurable: true });
      if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'localStorage', { value: storageMock, writable: true, configurable: true });
      }

      // Over the maximum limits
      const extremeLayout = {
        leftWidth: 9999,
        rightWidth: 9999,
        leftCollapsed: false,
        rightCollapsed: false
      };

      storageMock.setItem('talnova_kiosk_builder_layout', JSON.stringify(extremeLayout));

      const html = renderToString(
        <KioskBuilderInner journeyId="mock-journey-123" onExit={vi.fn()} />
      );

      // Left clamped to 450px, Right clamped to 650px
      expect(html).toContain('width:450px');
      expect(html).toContain('width:650px');
    });
  });
});

