import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LanguageSelectorModal } from '../features/kiosk/components/localization/LanguageSelectorModal';
import { KioskStepContainer } from '../features/kiosk/components/KioskStepContainer';
import { KioskPlayerHeader } from '../features/kiosk/components/KioskPlayerHeader';
import { KioskHomeScreen } from '../features/kiosk/components/launcher/KioskHomeScreen';
import { KioskDeviceManifest } from '../types/kiosk/device.types';
import { KioskStep } from '../types/kiosk/step.types';
import {
  WORKFORCE_LANGUAGES,
  WORKFORCE_LANGUAGE_MAP,
  getLanguageDisplayName,
  getLanguageAutonym,
  getLanguageDirection
} from '../features/kiosk/constants/language.constants';

// Mock react-i18next
const mockChangeLanguage = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options?.defaultValue) return options.defaultValue;
      return key;
    },
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage
    }
  })
}));

// Mock deviceIdentityService
vi.mock('../features/kiosk/services/device-identity.service', () => ({
  deviceIdentityService: {
    isRevoked: vi.fn(() => false),
    clearRevocationStatus: vi.fn(),
    getOrCreateHardwareGuid: vi.fn(async () => 'HW-LOC-001'),
    getHardwareGuidSync: vi.fn(() => 'HW-LOC-001'),
    getEmployeeUser: vi.fn(() => null),
    setEmployeeSession: vi.fn(),
    clearEmployeeSession: vi.fn(),
    setDeviceCredentials: vi.fn()
  }
}));

// Mock barcode scanner hook
vi.mock('../features/kiosk/hooks/useBarcodeScanner', () => ({
  useBarcodeScanner: vi.fn()
}));

const mockManifest: KioskDeviceManifest = {
  deviceId: 'kiosk-loc-test',
  organizationId: 'org-test',
  device: {
    name: 'Logistics Bay Terminal 4',
    location: 'Warehouse Gate B',
    status: 'online',
    lastHeartbeat: new Date().toISOString()
  },
  journeys: [
    {
      _id: 'journey-safety-01',
      title: 'Forklift Safety Induction',
      description: 'Pre-shift forklift inspection and pedestrian corridor protocols.',
      organizationId: 'org-test',
      languages: ['en', 'es', 'si', 'ta'],
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

describe('K-LOC-001: Multi-Language Switcher & Instant Localization Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Workforce Language Autonyms & Helper Utilities', () => {
    it('verifies workforce language catalog contains required workforce languages', () => {
      const codes = WORKFORCE_LANGUAGES.map((l) => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('es');
      expect(codes).toContain('ar');
      expect(codes).toContain('fr');
      expect(codes).toContain('de');
      expect(codes).toContain('vi');
      expect(codes).toContain('hi');
      expect(codes).toContain('si');
      expect(codes).toContain('ta');
      expect(codes).toContain('fi');
    });

    it('formats "English / Autonym" display names correctly', () => {
      expect(getLanguageDisplayName('es')).toBe('Spanish / Español');
      expect(getLanguageDisplayName('ar')).toBe('Arabic / العربية');
      expect(getLanguageDisplayName('fr')).toBe('French / Français');
      expect(getLanguageDisplayName('de')).toBe('German / Deutsch');
      expect(getLanguageDisplayName('vi')).toBe('Vietnamese / Tiếng Việt');
      expect(getLanguageDisplayName('hi')).toBe('Hindi / हिन्दी');
      expect(getLanguageDisplayName('si')).toBe('Sinhala / සිංහල');
      expect(getLanguageDisplayName('ta')).toBe('Tamil / தமிழ்');
      expect(getLanguageDisplayName('fi')).toBe('Finnish / Suomi');
      // When englishName and autonym match (English)
      expect(getLanguageDisplayName('en')).toBe('English');
    });

    it('returns native autonym correctly', () => {
      expect(getLanguageAutonym('es')).toBe('Español');
      expect(getLanguageAutonym('ar')).toBe('العربية');
      expect(getLanguageAutonym('si')).toBe('සිංහල');
      expect(getLanguageAutonym('ta')).toBe('தமிழ்');
    });

    it('identifies script direction (LTR vs RTL for Arabic)', () => {
      expect(getLanguageDirection('ar')).toBe('rtl');
      expect(getLanguageDirection('es')).toBe('ltr');
      expect(getLanguageDirection('en')).toBe('ltr');
    });
  });

  describe('2. LanguageSelectorModal Rendering & Touch Targets', () => {
    it('renders language cards with both English names and native autonyms when open', () => {
      const html = renderToString(
        <LanguageSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          selectedLanguage="en"
          onSelectLanguage={vi.fn()}
        />
      );

      // Verify modal header & title
      expect(html).toContain('data-testid="language-selector-modal"');
      expect(html).toContain('data-testid="language-modal-title"');
      expect(html).toContain('Select Terminal Language');

      // Verify cards with both English and autonyms
      expect(html).toContain('data-testid="language-card-es"');
      expect(html).toContain('Spanish');
      expect(html).toContain('Español');

      expect(html).toContain('data-testid="language-card-ar"');
      expect(html).toContain('Arabic');
      expect(html).toContain('العربية');
      expect(html).toContain('dir="rtl"');

      expect(html).toContain('data-testid="language-card-fr"');
      expect(html).toContain('French');
      expect(html).toContain('Français');

      expect(html).toContain('data-testid="language-card-de"');
      expect(html).toContain('German');
      expect(html).toContain('Deutsch');

      expect(html).toContain('data-testid="language-card-vi"');
      expect(html).toContain('Vietnamese');
      expect(html).toContain('Tiếng Việt');

      expect(html).toContain('data-testid="language-card-hi"');
      expect(html).toContain('Hindi');
      expect(html).toContain('हिन्दी');

      expect(html).toContain('data-testid="language-card-si"');
      expect(html).toContain('Sinhala');
      expect(html).toContain('සිංහල');

      expect(html).toContain('data-testid="language-card-ta"');
      expect(html).toContain('Tamil');
      expect(html).toContain('தமிழ்');
    });

    it('marks selected language card with data-selected="true" and aria-selected="true"', () => {
      const html = renderToString(
        <LanguageSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          selectedLanguage="es"
          onSelectLanguage={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="language-card-es" data-selected="true" aria-selected="true"');
      expect(html).toContain('data-testid="language-card-en" data-selected="false" aria-selected="false"');
    });

    it('does not render markup when isOpen is false', () => {
      const html = renderToString(
        <LanguageSelectorModal
          isOpen={false}
          onClose={vi.fn()}
          selectedLanguage="en"
          onSelectLanguage={vi.fn()}
        />
      );

      expect(html).toBe('');
    });

    it('meets WCAG 2.2 AA touch target standards (minimum 64px card height, 48px controls)', () => {
      const html = renderToString(
        <LanguageSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          selectedLanguage="en"
          onSelectLanguage={vi.fn()}
        />
      );

      // Search input minimum 48px height (h-14 / min-h-[48px])
      expect(html).toContain('data-testid="language-search-input"');
      expect(html).toContain('min-h-[48px]');

      // Close button minimum 48px
      expect(html).toContain('data-testid="close-language-modal-btn"');
      expect(html).toContain('min-h-[48px] min-w-[48px]');

      // Language cards minimum 64px touch target
      expect(html).toContain('min-h-[64px]');
    });

    it('renders high contrast mode styling (WCAG AAA ratio > 7:1) when highContrast is true', () => {
      const html = renderToString(
        <LanguageSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          selectedLanguage="es"
          onSelectLanguage={vi.fn()}
          highContrast={true}
        />
      );

      expect(html).toContain('high-contrast-mode');
      expect(html).toContain('bg-black');
      expect(html).toContain('border-amber-400');
    });
  });

  describe('3. Header Control Integration (KioskHomeScreen & KioskPlayerHeader)', () => {
    it('renders language switcher trigger button in KioskHomeScreen header', () => {
      const html = renderToString(
        <KioskHomeScreen
          manifest={mockManifest}
          onLaunchJourney={vi.fn()}
        />
      );

      expect(html).toContain('data-testid="language-switcher"');
      expect(html).toContain('Switch Language');
      expect(html).toContain('en');
    });

    it('renders language modal trigger button and quick switcher in KioskPlayerHeader', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Pre-Shift Safety Briefing"
          currentStepIndex={0}
          totalSteps={5}
          languages={['en', 'es', 'si']}
          selectedLanguage="en"
          onLanguageChange={vi.fn()}
          isMuted={false}
          onToggleMuted={vi.fn()}
          showSubtitles={false}
          onToggleSubtitles={vi.fn()}
        />
      );

      // Dedicated modal trigger button
      expect(html).toContain('data-testid="player-language-modal-btn"');
      // Inline quick switcher buttons
      expect(html).toContain('data-testid="player-language-switcher"');
      expect(html).toContain('data-testid="lang-btn-en"');
      expect(html).toContain('data-testid="lang-btn-es"');
      expect(html).toContain('data-testid="lang-btn-si"');
    });
  });

  describe('4. Journey Step Content & Settings Translations Resolution', () => {
    it('renders Spanish instructions from block.settings.translations.es when selectedLanguage is "es"', () => {
      const stepWithSettingsTranslation: KioskStep = {
        id: 'step-safety-1',
        title: 'Safety Eyewear Check',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'block-text-1',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Put on certified ANSI Z87.1 safety glasses before entering zone.' }
            },
            settings: {
              size: 'medium',
              translations: {
                es: { textValue: 'Colóquese gafas de seguridad certificadas ANSI Z87.1 antes de ingresar a la zona.' }
              }
            } as any
          }
        ]
      };

      // English render
      const enHtml = renderToString(
        <KioskStepContainer
          step={stepWithSettingsTranslation}
          stepIndex={0}
          selectedLanguage="en"
          defaultLanguage="en"
        />
      );
      expect(enHtml).toContain('Put on certified ANSI Z87.1 safety glasses before entering zone.');
      expect(enHtml).not.toContain('Colóquese gafas de seguridad');

      // Spanish render
      const esHtml = renderToString(
        <KioskStepContainer
          step={stepWithSettingsTranslation}
          stepIndex={0}
          selectedLanguage="es"
          defaultLanguage="en"
        />
      );
      expect(esHtml).toContain('Colóquese gafas de seguridad certificadas ANSI Z87.1 antes de ingresar a la zona.');
      expect(esHtml).not.toContain('Put on certified ANSI Z87.1 safety glasses');
      // No fallback notice because translation was found
      expect(esHtml).not.toContain('translation-fallback-notice-block-text-1');
    });

    it('renders Spanish instructions from block.settings.translations.es as string', () => {
      const stepWithStringTranslation: KioskStep = {
        id: 'step-string-trans',
        title: 'Forklift Warning',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'block-str-1',
            type: 'text',
            order: 0,
            mediaReferences: { en: { textValue: 'Yield to heavy forklifts.' } },
            settings: {
              size: 'medium',
              translations: {
                es: 'Ceda el paso a las carretillas elevadoras pesadas.'
              }
            } as any
          }
        ]
      };

      const html = renderToString(
        <KioskStepContainer
          step={stepWithStringTranslation}
          stepIndex={0}
          selectedLanguage="es"
          defaultLanguage="en"
        />
      );

      expect(html).toContain('Ceda el paso a las carretillas elevadoras pesadas.');
      expect(html).not.toContain('Yield to heavy forklifts.');
    });

    it('renders translated step title when step.translations.es.title exists', () => {
      const stepWithTitleTranslation: KioskStep = {
        id: 'step-title-test',
        title: 'Emergency Evacuation Route',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'b-1',
            type: 'text',
            order: 0,
            mediaReferences: { en: { textValue: 'Proceed to exit.' } },
            settings: { size: 'medium' }
          }
        ],
        ...({
          translations: {
            es: { title: 'Ruta de Evacuación de Emergencia' }
          }
        } as any)
      };

      const html = renderToString(
        <KioskStepContainer
          step={stepWithTitleTranslation}
          stepIndex={0}
          selectedLanguage="es"
          defaultLanguage="en"
        />
      );

      expect(html).toContain('data-testid="kiosk-step-title"');
      expect(html).toContain('Ruta de Evacuación de Emergencia');
    });

    it('renders localized content from block.mediaReferences[selectedLanguage]', () => {
      const stepWithMediaReferences: KioskStep = {
        id: 'step-media-ref',
        title: 'Hand Protection',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'b-media-1',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Wear cut-resistant Kevlar gloves.' },
              es: { textValue: 'Use guantes de Kevlar resistentes a cortes.' }
            },
            settings: { size: 'medium' }
          }
        ]
      };

      const html = renderToString(
        <KioskStepContainer
          step={stepWithMediaReferences}
          stepIndex={0}
          selectedLanguage="es"
          defaultLanguage="en"
        />
      );

      expect(html).toContain('Use guantes de Kevlar resistentes a cortes.');
      expect(html).not.toContain('Wear cut-resistant Kevlar gloves.');
    });
  });

  describe('5. Graceful Fallback Handling & Informational Notice', () => {
    it('gracefully falls back to default language ("en") and displays informational notice when translation is missing', () => {
      const stepMissingSpanish: KioskStep = {
        id: 'step-untranslated-1',
        title: 'Chemical Spill Protocol',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'block-chemical-1',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Contain solvent spill with absorbent pads immediately.' }
            },
            settings: { size: 'large' }
          }
        ]
      };

      const html = renderToString(
        <KioskStepContainer
          step={stepMissingSpanish}
          stepIndex={0}
          selectedLanguage="es"
          defaultLanguage="en"
        />
      );

      // Falls back to English text
      expect(html).toContain('Contain solvent spill with absorbent pads immediately.');

      // Displays accessible untranslated notice badge
      expect(html).toContain('data-testid="translation-fallback-notice-block-chemical-1"');
      expect(html).toContain('role="status"');
      expect(html).toContain('Translation unavailable for Spanish / Español');
      expect(html).toContain('English');
    });

    it('does not display fallback notice when selectedLanguage matches defaultLanguage', () => {
      const stepInEnglish: KioskStep = {
        id: 'step-eng-1',
        title: 'English Briefing',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'b-eng',
            type: 'text',
            order: 0,
            mediaReferences: {
              en: { textValue: 'Standard English instruction.' }
            },
            settings: { size: 'medium' }
          }
        ]
      };

      const html = renderToString(
        <KioskStepContainer
          step={stepInEnglish}
          stepIndex={0}
          selectedLanguage="en"
          defaultLanguage="en"
        />
      );

      expect(html).toContain('Standard English instruction.');
      expect(html).not.toContain('translation-fallback-notice-b-eng');
    });
  });

  describe('6. Audio Narration Resolution Logic', () => {
    it('resolves audio asset for selected language when available', () => {
      const stepWithAudio: KioskStep = {
        id: 'step-audio-1',
        title: 'Audio Demonstration',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'block-audio-1',
            type: 'audio',
            order: 0,
            mediaReferences: {
              en: { uploadId: 'audio-upload-en-123' },
              es: { uploadId: 'audio-upload-es-456' }
            },
            settings: { autoplay: true, loop: false, controls: true }
          }
        ]
      };

      // Helper function matching KioskPlayer audio resolution logic
      const resolveAudioUrl = (step: KioskStep, selectedLang: string, defaultLang: string) => {
        const audioBlock = step.blocks.find((b) => b.type === 'audio');
        const getAudioForLang = (lang: string) => {
          if (audioBlock) {
            const ref = audioBlock.mediaReferences?.[lang];
            if (ref?.embedUrl) return ref.embedUrl;
            if (ref?.audioUploadId || ref?.uploadId) {
              return `/api/v1/kiosk/uploads/${ref.audioUploadId || ref.uploadId}`;
            }
          }
          return '';
        };

        let url = getAudioForLang(selectedLang);
        if (!url && selectedLang !== defaultLang) {
          url = getAudioForLang(defaultLang);
        }
        return url;
      };

      const esAudioUrl = resolveAudioUrl(stepWithAudio, 'es', 'en');
      expect(esAudioUrl).toBe('/api/v1/kiosk/uploads/audio-upload-es-456');

      const enAudioUrl = resolveAudioUrl(stepWithAudio, 'en', 'en');
      expect(enAudioUrl).toBe('/api/v1/kiosk/uploads/audio-upload-en-123');
    });

    it('falls back to default language audio narration when selectedLanguage audio is missing', () => {
      const stepMissingSpanishAudio: KioskStep = {
        id: 'step-audio-fallback',
        title: 'Audio Fallback',
        type: 'instructional_step',
        order: 0,
        interaction: { type: 'none' },
        blocks: [
          {
            id: 'b-audio',
            type: 'audio',
            order: 0,
            mediaReferences: {
              en: { uploadId: 'audio-upload-en-default' }
            },
            settings: { autoplay: false, loop: false, controls: true }
          }
        ]
      };

      const resolveAudioUrl = (step: KioskStep, selectedLang: string, defaultLang: string) => {
        const audioBlock = step.blocks.find((b) => b.type === 'audio');
        const getAudioForLang = (lang: string) => {
          if (audioBlock) {
            const ref = audioBlock.mediaReferences?.[lang];
            if (ref?.embedUrl) return ref.embedUrl;
            if (ref?.audioUploadId || ref?.uploadId) {
              return `/api/v1/kiosk/uploads/${ref.audioUploadId || ref.uploadId}`;
            }
          }
          return '';
        };

        let url = getAudioForLang(selectedLang);
        if (!url && selectedLang !== defaultLang) {
          url = getAudioForLang(defaultLang);
        }
        return url;
      };

      // Requesting Spanish falls back to English narration
      const esAudioUrl = resolveAudioUrl(stepMissingSpanishAudio, 'es', 'en');
      expect(esAudioUrl).toBe('/api/v1/kiosk/uploads/audio-upload-en-default');
    });
  });
});
