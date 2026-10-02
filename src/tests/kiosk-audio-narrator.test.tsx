import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  KioskAudioNarrator,
  resolveStepAudioSource
} from '../features/kiosk/components/player/KioskAudioNarrator';
import { KioskPlayerHeader } from '../features/kiosk/components/KioskPlayerHeader';
import { KioskStep } from '../types/kiosk/step.types';

// Mock Audio in Node test environment
class MockAudio {
  src = '';
  loop = false;
  muted = false;
  volume = 1;
  duration = 120;
  currentTime = 0;
  onloadedmetadata: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();

  constructor(src?: string) {
    if (src) this.src = src;
  }
}
(globalThis as any).Audio = MockAudio;

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (options?.defaultValue) return options.defaultValue;
      return key;
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn()
    }
  })
}));

describe('K-LOC-003: Synchronized Localized Audio Narration Suite', () => {
  const sampleStepWithBilingualAudio: KioskStep = {
    id: 'step-audio-01',
    title: 'Forklift Pre-Operation Inspection',
    type: 'content',
    order: 0,
    blocks: [
      {
        id: 'block-text-01',
        type: 'text',
        order: 0,
        mediaReferences: {
          en: {
            textValue: 'Inspect forklift tires and hydraulic fluid levels before operation.',
            audioUploadId: 'audio-upload-en-101'
          },
          es: {
            textValue: 'Inspeccione los neumáticos del montacargas y los niveles de líquido hidráulico antes de la operación.',
            audioUploadId: 'audio-upload-es-202'
          },
          ar: {
            textValue: 'افحص إطارات رافعة شوكية ومستويات السوائل الهيدروليكية قبل التشغيل.',
            audioUploadId: 'audio-upload-ar-303'
          }
        }
      }
    ],
    interaction: { type: 'tap_to_continue' }
  };

  const sampleStepWithOnlyEnglishAudio: KioskStep = {
    id: 'step-audio-02',
    title: 'Emergency Evacuation Map',
    type: 'content',
    order: 1,
    blocks: [
      {
        id: 'block-text-02',
        type: 'text',
        order: 0,
        mediaReferences: {
          en: {
            textValue: 'Locate the nearest primary and secondary emergency exits.',
            audioUploadId: 'audio-upload-en-exit'
          }
        }
      }
    ],
    interaction: { type: 'tap_to_continue' }
  };

  const sampleStepWithoutAudio: KioskStep = {
    id: 'step-audio-03',
    title: 'Silent Checklist',
    type: 'content',
    order: 2,
    blocks: [
      {
        id: 'block-text-03',
        type: 'text',
        order: 0,
        mediaReferences: {
          en: { textValue: 'Read and confirm items manually.' }
        }
      }
    ],
    interaction: { type: 'tap_to_continue' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Audio Source Resolution & Fallback Logic', () => {
    it('Acceptance Criteria 1: Resolves Spanish audio upload when employee selects Spanish', () => {
      const resolved = resolveStepAudioSource(sampleStepWithBilingualAudio, 'es', 'en');

      expect(resolved.hasAudio).toBe(true);
      expect(resolved.language).toBe('es');
      expect(resolved.audioUploadId).toBe('audio-upload-es-202');
      expect(resolved.audioUrl).toBe('/api/v1/kiosk/uploads/audio-upload-es-202');
      expect(resolved.isFallback).toBe(false);
    });

    it('Resolves English audio upload when employee selects English', () => {
      const resolved = resolveStepAudioSource(sampleStepWithBilingualAudio, 'en', 'en');

      expect(resolved.hasAudio).toBe(true);
      expect(resolved.language).toBe('en');
      expect(resolved.audioUploadId).toBe('audio-upload-en-101');
      expect(resolved.audioUrl).toBe('/api/v1/kiosk/uploads/audio-upload-en-101');
      expect(resolved.isFallback).toBe(false);
    });

    it('Gracefully falls back to default language (en) when target language audio is absent', () => {
      // Step only has English audio, employee selected French ('fr')
      const resolved = resolveStepAudioSource(sampleStepWithOnlyEnglishAudio, 'fr', 'en');

      expect(resolved.hasAudio).toBe(true);
      expect(resolved.language).toBe('en');
      expect(resolved.audioUploadId).toBe('audio-upload-en-exit');
      expect(resolved.audioUrl).toBe('/api/v1/kiosk/uploads/audio-upload-en-exit');
      expect(resolved.isFallback).toBe(true);
    });

    it('Handles steps without audio narration gracefully', () => {
      const resolved = resolveStepAudioSource(sampleStepWithoutAudio, 'es', 'en');

      expect(resolved.hasAudio).toBe(false);
      expect(resolved.audioUrl).toBeNull();
      expect(resolved.audioUploadId).toBeNull();
    });

    it('Handles direct http/https/blob/data URLs without prepending uploads endpoint', () => {
      const stepWithDirectUrl: KioskStep = {
        id: 'step-direct-url',
        title: 'Direct URL Step',
        type: 'content',
        order: 0,
        blocks: [
          {
            id: 'b-url',
            type: 'audio',
            order: 0,
            mediaReferences: {
              es: { audioUploadId: 'https://cdn.example.com/audio/narration-es.mp3' }
            }
          }
        ]
      };

      const resolved = resolveStepAudioSource(stepWithDirectUrl, 'es', 'en');
      expect(resolved.audioUrl).toBe('https://cdn.example.com/audio/narration-es.mp3');
      expect(resolved.isFallback).toBe(false);
    });
  });

  describe('2. KioskAudioNarrator Component Rendering & Visual Waveform', () => {
    it('renders audio narrator with Spanish badge and controls when Spanish is selected', () => {
      const html = renderToString(
        <KioskAudioNarrator
          step={sampleStepWithBilingualAudio}
          selectedLanguage="es"
          defaultLanguage="en"
          autoPlay={true}
          isMuted={false}
          volume={0.8}
        />
      );

      // Verify narrator container
      expect(html).toContain('id="kiosk-audio-narrator"');
      expect(html).toContain('data-testid="kiosk-audio-narrator"');

      // Verify language badge displays Spanish
      expect(html).toContain('data-testid="audio-language-badge"');
      expect(html).toContain('Español');

      // Verify controls
      expect(html).toContain('data-testid="audio-play-pause-btn"');
      expect(html).toContain('data-testid="audio-restart-btn"');

      // Verify animated waveform container
      expect(html).toContain('data-testid="audio-waveform"');

      // Verify audio scrubber
      expect(html).toContain('data-testid="audio-scrubber"');
    });

    it('renders fallback badge when playing default language narration', () => {
      const html = renderToString(
        <KioskAudioNarrator
          step={sampleStepWithOnlyEnglishAudio}
          selectedLanguage="fr"
          defaultLanguage="en"
        />
      );

      expect(html).toContain('data-testid="audio-fallback-badge"');
      expect(html).toContain('Default Language');
    });

    it('returns null and renders nothing when step has no audio narration', () => {
      const html = renderToString(
        <KioskAudioNarrator
          step={sampleStepWithoutAudio}
          selectedLanguage="en"
        />
      );

      expect(html).toBe('');
    });

    it('applies RTL layout and float-right scrubber progression when Arabic is active', () => {
      const html = renderToString(
        <KioskAudioNarrator
          step={sampleStepWithBilingualAudio}
          selectedLanguage="ar"
          defaultLanguage="en"
        />
      );

      expect(html).toContain('dir="rtl"');
      expect(html).toContain('data-testid="audio-scrubber"');
      expect(html).toContain('float-right');
    });
  });

  describe('3. Acceptance Criteria 2: Player Header Volume Slider & Instant Mute Toggle', () => {
    it('renders volume slider (0-100%) and instant mute toggle in player header', () => {
      const handleToggleMute = vi.fn();
      const handleVolumeChange = vi.fn();

      const html = renderToString(
        <KioskPlayerHeader
          title="Daily Safety Briefing"
          currentStepIndex={0}
          totalSteps={3}
          selectedLanguage="es"
          isMuted={false}
          onToggleMuted={handleToggleMute}
          volume={0.8}
          onVolumeChange={handleVolumeChange}
          showSubtitles={true}
          onToggleSubtitles={vi.fn()}
        />
      );

      // Verify volume control container
      expect(html).toContain('data-testid="player-volume-control"');

      // Verify instant mute toggle button
      expect(html).toContain('data-testid="toggle-mute-btn"');

      // Verify volume slider (0-100%)
      expect(html).toContain('data-testid="volume-slider"');
      expect(html).toContain('value="80"');
      expect(html).toContain('data-testid="volume-percentage"');
      expect(html).toContain('80%');
    });

    it('reflects muted state (0%) and VolumeX icon when isMuted is true', () => {
      const html = renderToString(
        <KioskPlayerHeader
          title="Daily Safety Briefing"
          currentStepIndex={0}
          totalSteps={3}
          selectedLanguage="en"
          isMuted={true}
          onToggleMuted={vi.fn()}
          volume={0.8}
          onVolumeChange={vi.fn()}
          showSubtitles={true}
          onToggleSubtitles={vi.fn()}
        />
      );

      // When muted, volume slider displays 0%
      expect(html).toContain('value="0"');
      expect(html).toContain('0%');
    });
  });
});
