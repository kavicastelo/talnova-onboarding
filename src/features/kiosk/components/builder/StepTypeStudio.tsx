import React, { useState } from 'react';
import { 
  Video, Music, Image as ImageIcon, AlertTriangle, ShieldCheck, Check, 
  Plus, Trash2, Sliders, Award, CheckCircle2, 
  Volume2, Shield, AlertOctagon,
  Clock, Info, ChevronDown, ChevronRight
} from 'lucide-react';
import { KioskStep } from '../../../../types/kiosk/step.types';
import { KioskJourney } from '../../../../types/kiosk/journey.types';
import { KioskBlock, KioskBlockType } from '../../../../types/kiosk/block.types';
import { MediaAssetPicker } from './MediaAssetPicker';

export interface StepTypeStudioProps {
  step: KioskStep;
  journey: Partial<KioskJourney>;
  onUpdateStep: (updates: Partial<KioskStep>) => void;
  onAddBlock: (type: KioskBlockType) => void;
  onUpdateBlock: (blockId: string, updates: Partial<KioskBlock>) => void;
  onSelectBlock?: (blockId: string) => void;
}

/**
 * Common quick-pick PPE gear items with safety icons and labels.
 */
const COMMON_PPE_ITEMS = [
  { id: 'hard_hat', label: 'Hard Hat', icon: '⛑️' },
  { id: 'safety_glasses', label: 'Safety Glasses', icon: '🥽' },
  { id: 'steel_boots', label: 'Steel-Toe Boots', icon: '🥾' },
  { id: 'hi_vis_vest', label: 'Hi-Vis Vest', icon: '🦺' },
  { id: 'ear_protection', label: 'Ear Protection', icon: '🎧' },
  { id: 'safety_gloves', label: 'Safety Gloves', icon: '🧤' },
  { id: 'face_shield', label: 'Face Shield', icon: '🛡️' },
  { id: 'fall_harness', label: 'Fall Harness', icon: '🪢' },
  { id: 'respirator', label: 'Dust / Gas Mask', icon: '😷' }
];

/**
 * OSHA Standard Safety Alert Presets.
 */
const OSHA_PRESETS = [
  {
    level: 'DANGER',
    badge: 'OSHA DANGER',
    color: 'bg-rose-600 text-white border-rose-500 shadow-rose-900/40',
    titlePrefix: '[DANGER] Extreme Hazard Area',
    desc: 'Indicates an imminent hazardous situation which will result in death or serious injury.',
    recommendedDwell: 5
  },
  {
    level: 'WARNING',
    badge: 'OSHA WARNING',
    color: 'bg-amber-600 text-white border-amber-500 shadow-amber-900/40',
    titlePrefix: '[WARNING] Machine Operating Zone',
    desc: 'Indicates a potentially hazardous situation which could result in death or serious injury.',
    recommendedDwell: 4
  },
  {
    level: 'CAUTION',
    badge: 'OSHA CAUTION',
    color: 'bg-yellow-500 text-slate-950 border-yellow-400 shadow-yellow-900/40',
    titlePrefix: '[CAUTION] Slip & Trip Precaution',
    desc: 'Indicates a potentially hazardous situation which may result in minor or moderate injury.',
    recommendedDwell: 3
  },
  {
    level: 'NOTICE',
    badge: 'OSHA NOTICE',
    color: 'bg-blue-600 text-white border-blue-500 shadow-blue-900/40',
    titlePrefix: '[NOTICE] Safety Hygiene Policy',
    desc: 'Indicates information considered important, but not directly hazard-related.',
    recommendedDwell: 2
  }
];

export const StepTypeStudio: React.FC<StepTypeStudioProps> = ({
  step,
  journey,
  onUpdateStep,
  onAddBlock,
  onUpdateBlock,
  onSelectBlock
}) => {
  const primaryLang = (journey.languages && journey.languages[0]) || 'en';

  // Find primary media block if one exists
  const primaryVideoBlock = step.blocks?.find(b => b.type === 'video');
  const primaryImageBlock = step.blocks?.find(b => b.type === 'image');
  const primaryAudioBlock = step.blocks?.find(b => b.type === 'audio');

  // Interactive hold button live simulation state
  const [testHolding, setTestHolding] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [testCompleted, setTestCompleted] = useState(false);

  // New custom PPE item input state
  const [customPpeName, setCustomPpeName] = useState('');

  // Quiz active accordion tab
  const [expandedQuestionIdx, setExpandedQuestionIdx] = useState<number | null>(0);

  // Handle hold-to-confirm live button test
  const handleHoldStart = () => {
    setTestHolding(true);
    setTestCompleted(false);
    const duration = step.interaction?.holdDurationMs || 3000;
    const intervalTime = 50;
    const stepIncrement = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setTestProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          setTestHolding(false);
          setTestCompleted(true);
          return 100;
        }
        return prev + stepIncrement;
      });
    }, intervalTime);

    const handleMouseUp = () => {
      clearInterval(timer);
      setTestHolding(false);
      setTestProgress(0);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
  };

  // Helper to ensure primary media block exists or create one
  const ensureMediaBlock = (type: 'video' | 'image' | 'audio') => {
    const existing = step.blocks?.find(b => b.type === type);
    if (!existing) {
      onAddBlock(type);
    } else if (onSelectBlock) {
      onSelectBlock(existing.id);
    }
  };

  /* =========================================================================
   * 1. VIDEO GUIDE STEP STUDIO
   * ========================================================================= */
  if (step.type === 'video_step') {
    const videoRef = primaryVideoBlock?.mediaReferences?.[primaryLang] || {};

    return (
      <div className="space-y-4 animate-fade-in" data-testid="video-step-studio">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Video className="w-4 h-4 text-emerald-400" />
              <span>Video Presentation Asset</span>
            </h5>
            {primaryVideoBlock && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Block #{primaryVideoBlock.id}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Upload an MP4/WebM video or import shareable video streams from YouTube, Vimeo, Google Drive, or Loom.
          </p>

          {primaryVideoBlock ? (
            <MediaAssetPicker
              mediaType="video"
              currentUploadId={videoRef.uploadId}
              currentEmbedUrl={videoRef.embedUrl}
              languageCode={primaryLang}
              label={`Primary Video (${primaryLang.toUpperCase()})`}
              helperText="Embeds interactive playback on the kiosk display"
              onAssetChange={({ uploadId, embedUrl }) => {
                const existingRefs = primaryVideoBlock.mediaReferences || {};
                onUpdateBlock(primaryVideoBlock.id, {
                  mediaReferences: {
                    ...existingRefs,
                    [primaryLang]: {
                      ...existingRefs[primaryLang],
                      uploadId: uploadId ?? existingRefs[primaryLang]?.uploadId,
                      embedUrl: embedUrl ?? existingRefs[primaryLang]?.embedUrl
                    }
                  }
                });
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => ensureMediaBlock('video')}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center justify-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Attach Video Player Block</span>
            </button>
          )}
        </div>

        {/* Video Playback Settings */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <h5 className="text-xs font-bold text-slate-300 flex items-center space-x-2">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Playback Behavior & Compliance</span>
          </h5>

          <div className="flex items-center justify-between text-xs pt-1">
            <div>
              <span className="text-slate-300 font-medium">Auto-Play on Slide Entry</span>
              <p className="text-[10px] text-slate-500">Starts video stream automatically when trainee lands on this step.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (primaryVideoBlock) {
                  const currentSettings = (primaryVideoBlock as any).settings || {};
                  onUpdateBlock(primaryVideoBlock.id, {
                    settings: {
                      ...currentSettings,
                      autoplay: !currentSettings.autoplay,
                      loop: currentSettings.loop ?? false,
                      aspect: currentSettings.aspect ?? '16:9'
                    }
                  } as any);
                }
              }}
              className={`w-9 h-5 rounded-full relative transition-colors ${
                (primaryVideoBlock as any)?.settings?.autoplay ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${
                (primaryVideoBlock as any)?.settings?.autoplay ? 'right-0.5' : 'left-0.5'
              }`} />
            </button>
          </div>

          <div className="pt-2 border-t border-slate-900">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Minimum Watch-Through Requirement
              </label>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {step.interaction?.holdDurationMs ? `${Math.round(step.interaction.holdDurationMs / 1000)}s Lock` : '90% (Mandatory)'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Terminal disables the 'Next' navigation button until the worker finishes watching the video stream.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 2. AUDIO ANNOUNCEMENT STEP STUDIO
   * ========================================================================= */
  if (step.type === 'audio_step') {
    const audioRef = primaryAudioBlock?.mediaReferences?.[primaryLang] || {};

    return (
      <div className="space-y-4 animate-fade-in" data-testid="audio-step-studio">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Music className="w-4 h-4 text-emerald-400" />
              <span>Audio Narration Broadcast</span>
            </h5>
            {primaryAudioBlock && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Block #{primaryAudioBlock.id}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Upload voice announcements, multilingual audio clips, or audio streams for high-noise plant environments.
          </p>

          {primaryAudioBlock ? (
            <MediaAssetPicker
              mediaType="audio"
              currentUploadId={audioRef.audioUploadId || audioRef.uploadId}
              currentEmbedUrl={audioRef.embedUrl}
              languageCode={primaryLang}
              label={`Audio Narration (${primaryLang.toUpperCase()})`}
              helperText="Auto-plays or streams through kiosk speakers or headset"
              onAssetChange={({ uploadId, embedUrl }) => {
                const existingRefs = primaryAudioBlock.mediaReferences || {};
                onUpdateBlock(primaryAudioBlock.id, {
                  mediaReferences: {
                    ...existingRefs,
                    [primaryLang]: {
                      ...existingRefs[primaryLang],
                      uploadId: uploadId ?? existingRefs[primaryLang]?.uploadId,
                      audioUploadId: uploadId ?? existingRefs[primaryLang]?.audioUploadId,
                      embedUrl: embedUrl ?? existingRefs[primaryLang]?.embedUrl
                    }
                  }
                });
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => ensureMediaBlock('audio')}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center justify-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Attach Audio Narration Block</span>
            </button>
          )}
        </div>

        {/* Audio Narration Behavior */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <h5 className="text-xs font-bold text-slate-300 flex items-center space-x-2">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Audio Playback Behavior</span>
          </h5>

          <div className="flex items-center justify-between text-xs pt-1">
            <div>
              <span className="text-slate-300 font-medium">Auto-Play Audio on Entry</span>
              <p className="text-[10px] text-slate-500">Initiates sound playback immediately upon step presentation.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (primaryAudioBlock) {
                  const currentSettings = (primaryAudioBlock as any).settings || {};
                  onUpdateBlock(primaryAudioBlock.id, {
                    settings: {
                      ...currentSettings,
                      autoplay: !currentSettings.autoplay,
                      loop: currentSettings.loop ?? false
                    }
                  } as any);
                }
              }}
              className={`w-9 h-5 rounded-full relative transition-colors ${
                (primaryAudioBlock as any)?.settings?.autoplay ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${
                (primaryAudioBlock as any)?.settings?.autoplay ? 'right-0.5' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 3. IMAGE / DIAGRAM STEP STUDIO
   * ========================================================================= */
  if (step.type === 'image_step') {
    const imageRef = primaryImageBlock?.mediaReferences?.[primaryLang] || {};

    return (
      <div className="space-y-4 animate-fade-in" data-testid="image-step-studio">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              <span>Safety Diagram or Schematic</span>
            </h5>
            {primaryImageBlock && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Block #{primaryImageBlock.id}
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400">
            Upload high-resolution safety blueprints, plant maps, or warning graphics (PNG, JPG, WebP, SVG).
          </p>

          {primaryImageBlock ? (
            <MediaAssetPicker
              mediaType="image"
              currentUploadId={imageRef.uploadId}
              currentEmbedUrl={imageRef.embedUrl}
              languageCode={primaryLang}
              label={`Primary Image (${primaryLang.toUpperCase()})`}
              helperText="Supports high-contrast and touchscreen pinch-to-zoom"
              onAssetChange={({ uploadId, embedUrl }) => {
                const existingRefs = primaryImageBlock.mediaReferences || {};
                onUpdateBlock(primaryImageBlock.id, {
                  mediaReferences: {
                    ...existingRefs,
                    [primaryLang]: {
                      ...existingRefs[primaryLang],
                      uploadId: uploadId ?? existingRefs[primaryLang]?.uploadId,
                      embedUrl: embedUrl ?? existingRefs[primaryLang]?.embedUrl
                    }
                  }
                });
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => ensureMediaBlock('image')}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center justify-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Attach Image Frame Block</span>
            </button>
          )}
        </div>

        {/* Image Display Settings */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <h5 className="text-xs font-bold text-slate-300 flex items-center space-x-2">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>Display Controls</span>
          </h5>

          <div className="flex items-center justify-between text-xs pt-1">
            <div>
              <span className="text-slate-300 font-medium">Pinch to Zoom & Pan</span>
              <p className="text-[10px] text-slate-500">Allows touchscreen workers to inspect fine details on blueprints.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (primaryImageBlock) {
                  const currentSettings = (primaryImageBlock as any).settings || {};
                  onUpdateBlock(primaryImageBlock.id, {
                    settings: {
                      ...currentSettings,
                      zoomable: !currentSettings.zoomable,
                      contrastMode: currentSettings.contrastMode ?? false
                    }
                  } as any);
                }
              }}
              className={`w-9 h-5 rounded-full relative transition-colors ${
                (primaryImageBlock as any)?.settings?.zoomable ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${
                (primaryImageBlock as any)?.settings?.zoomable ? 'right-0.5' : 'left-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-900">
            <div>
              <span className="text-slate-300 font-medium">High-Contrast Glare Mode</span>
              <p className="text-[10px] text-slate-500">Enhances visibility under direct warehouse sunlight or shop lighting.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (primaryImageBlock) {
                  const currentSettings = (primaryImageBlock as any).settings || {};
                  onUpdateBlock(primaryImageBlock.id, {
                    settings: {
                      ...currentSettings,
                      zoomable: currentSettings.zoomable ?? true,
                      contrastMode: !currentSettings.contrastMode
                    }
                  } as any);
                }
              }}
              className={`w-9 h-5 rounded-full relative transition-colors ${
                (primaryImageBlock as any)?.settings?.contrastMode ? 'bg-emerald-500' : 'bg-slate-800'
              }`}
            >
              <div className={`w-3.5 h-3.5 bg-slate-950 rounded-full absolute top-0.5 transition-all ${
                (primaryImageBlock as any)?.settings?.contrastMode ? 'right-0.5' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 4. WARNING STEP STUDIO (OSHA Safety Warning Template)
   * ========================================================================= */
  if (step.type === 'warning_step') {
    const currentDwellSec = Math.max(1, Math.round((step.interaction?.holdDurationMs || 3000) / 1000));

    return (
      <div className="space-y-4 animate-fade-in" data-testid="warning-step-studio">
        {/* OSHA Standard Severity Presets */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
              <AlertTriangle className="w-4 h-4" />
              <span>OSHA Safety Hazard Standard</span>
            </h5>
            <span className="text-[10px] font-mono text-slate-400 uppercase">1910.145 Compliant</span>
          </div>

          <p className="text-[11px] text-slate-400">
            Select an OSHA compliance preset to automatically format severity colors and header styling:
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {OSHA_PRESETS.map((preset) => {
              const isActive = step.title?.toUpperCase().includes(preset.level);

              return (
                <button
                  key={preset.level}
                  type="button"
                  onClick={() => {
                    const cleanTitle = step.title.replace(/^\[(DANGER|WARNING|CAUTION|NOTICE)\]\s*/i, '');
                    onUpdateStep({
                      title: `[${preset.level}] ${cleanTitle || 'Safety Hazard Precaution'}`,
                      interaction: {
                        ...step.interaction,
                        type: 'hold_to_confirm',
                        holdDurationMs: preset.recommendedDwell * 1000
                      }
                    });
                  }}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                    isActive
                      ? `${preset.color} ring-2 ring-white/20 shadow-md`
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider">{preset.level}</span>
                    {isActive && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[9px] text-slate-400 line-clamp-1 mt-1 font-mono">
                    {preset.recommendedDwell}s mandatory hold
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reading Dwell Slider */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Mandatory Reading Dwell Timer</span>
            </label>
            <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {currentDwellSec} {currentDwellSec === 1 ? 'Second' : 'Seconds'}
            </span>
          </div>

          <p className="text-[10px] text-slate-400">
            Kiosk screen locks the advance trigger for this duration to ensure the worker thoroughly reviews the hazard protocol.
          </p>

          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={currentDwellSec}
            onChange={(e) => {
              const sec = Number(e.target.value);
              onUpdateStep({
                interaction: {
                  ...step.interaction,
                  type: 'hold_to_confirm',
                  holdDurationMs: sec * 1000
                }
              });
            }}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
          />

          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>1s (Quick notice)</span>
            <span>5s (Standard)</span>
            <span>10s (High danger)</span>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 5. EMERGENCY STEP STUDIO (Critical Protocol & Strobe)
   * ========================================================================= */
  if (step.type === 'emergency_step') {
    return (
      <div className="space-y-4 animate-fade-in" data-testid="emergency-step-studio">
        <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-rose-400 flex items-center space-x-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-500 animate-pulse" />
              <span>Critical Emergency Evacuation Protocol</span>
            </h5>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-500 text-slate-950 px-2 py-0.5 rounded">
              High Priority
            </span>
          </div>

          <p className="text-[11px] text-slate-300">
            Emergency protocol slides bypass standard timeouts and display high-visibility alerts on kiosk screens.
          </p>

          <div className="space-y-2 pt-1">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Emergency Assembly / Muster Point
              </label>
              <input
                type="text"
                placeholder="e.g. Muster Point Bravo - North Parking Gate #3"
                value={step.interaction?.incorrectStepId || ''}
                onChange={(e) => {
                  onUpdateStep({
                    interaction: {
                      ...step.interaction,
                      incorrectStepId: e.target.value
                    }
                  });
                }}
                className="w-full rounded-lg border border-slate-900 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Emergency Dispatch Hotline / Radio Channel
              </label>
              <input
                type="text"
                placeholder="e.g. Ext. 9911 / VHF Channel 16"
                value={step.interaction?.correctStepId || ''}
                onChange={(e) => {
                  onUpdateStep({
                    interaction: {
                      ...step.interaction,
                      correctStepId: e.target.value
                    }
                  });
                }}
                className="w-full rounded-lg border border-slate-900 bg-slate-950 p-2.5 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 6. INTERACTIVE CONFIRMATION STEP STUDIO (Hold-to-Confirm)
   * ========================================================================= */
  if (step.type === 'interactive_confirmation') {
    const holdMs = step.interaction?.holdDurationMs || 3000;
    const holdSec = (holdMs / 1000).toFixed(1);

    return (
      <div className="space-y-4 animate-fade-in" data-testid="interactive-confirmation-studio">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Hold-to-Confirm Dwell Duration</span>
            </h5>
            <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {holdSec}s Press
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Worker must physically press and hold the capacitive touchscreen button to prevent accidental tap-throughs.
          </p>

          <input
            type="range"
            min={1000}
            max={5000}
            step={500}
            value={holdMs}
            onChange={(e) => {
              onUpdateStep({
                interaction: {
                  ...step.interaction,
                  type: 'hold_to_confirm',
                  holdDurationMs: Number(e.target.value)
                }
              });
            }}
            className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
          />

          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>1.0s (Light)</span>
            <span>3.0s (Recommended)</span>
            <span>5.0s (Critical)</span>
          </div>
        </div>

        {/* Live Interactive Simulator for Author */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800 space-y-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Author Interactive Test
          </span>

          <div className="pt-1">
            <button
              type="button"
              onMouseDown={handleHoldStart}
              onTouchStart={handleHoldStart}
              className={`w-full py-4 rounded-xl font-bold text-sm relative overflow-hidden transition select-none ${
                testCompleted
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                  : testHolding
                  ? 'bg-slate-900 border-2 border-emerald-500 text-white'
                  : 'bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300'
              }`}
            >
              {/* Animated Progress Fill Bar */}
              <div
                style={{ width: `${testProgress}%` }}
                className="absolute inset-y-0 left-0 bg-emerald-500/30 transition-all pointer-events-none"
              />

              <span className="relative z-10 flex items-center justify-center space-x-2">
                {testCompleted ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-slate-950" />
                    <span>Hold Verified ({holdSec}s)</span>
                  </>
                ) : (
                  <>
                    <Clock className={`w-4 h-4 ${testHolding ? 'animate-spin' : ''}`} />
                    <span>{testHolding ? `Holding... (${Math.round(testProgress)}%)` : `Press & Hold (${holdSec}s)`}</span>
                  </>
                )}
              </span>
            </button>
          </div>

          <p className="text-[10px] text-slate-500">
            {testCompleted ? 'Passed simulation! Re-press to test again.' : 'Click and hold above button to test tactile timing.'}
          </p>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 7. PPE CHECKLIST STEP STUDIO
   * ========================================================================= */
  if (step.type === 'ppe_checklist') {
    const currentPpeItems = (step.interaction?.ppeItems && step.interaction.ppeItems.length > 0)
      ? [...step.interaction.ppeItems]
      : ['Hard Hat', 'Safety Glasses', 'Steel-Toe Boots'];

    const togglePpePreset = (label: string) => {
      let updated: string[];
      if (currentPpeItems.includes(label)) {
        updated = currentPpeItems.filter(item => item !== label);
      } else {
        updated = [...currentPpeItems, label];
      }
      onUpdateStep({
        interaction: {
          ...step.interaction,
          type: 'ppe_checklist',
          ppeItems: updated
        }
      });
    };

    const addCustomPpe = () => {
      const trimmed = customPpeName.trim();
      if (!trimmed) return;
      if (!currentPpeItems.includes(trimmed)) {
        onUpdateStep({
          interaction: {
            ...step.interaction,
            type: 'ppe_checklist',
            ppeItems: [...currentPpeItems, trimmed]
          }
        });
      }
      setCustomPpeName('');
    };

    return (
      <div className="space-y-4 animate-fade-in" data-testid="ppe-checklist-studio">
        {/* Quick-Add Palette */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Standard PPE Gear Palette</span>
            </h5>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {currentPpeItems.length} Required
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Click any standard safety equipment badge to toggle it in this terminal inspection list:
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            {COMMON_PPE_ITEMS.map((gear) => {
              const isSelected = currentPpeItems.includes(gear.label);

              return (
                <button
                  key={gear.id}
                  type="button"
                  onClick={() => togglePpePreset(gear.label)}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-sm shadow-emerald-950'
                      : 'bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span>{gear.icon}</span>
                  <span>{gear.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Item Adder & Active List */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <h5 className="text-xs font-bold text-slate-300">Active Checklist Items ({currentPpeItems.length})</h5>

          <div className="flex space-x-2">
            <input
              type="text"
              value={customPpeName}
              onChange={(e) => setCustomPpeName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustomPpe(); }}
              placeholder="e.g. Cut-Resistant Kevlar Sleeves"
              className="flex-1 rounded-lg border border-slate-900 bg-slate-950 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={addCustomPpe}
              className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition"
            >
              + Add
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1">
            {currentPpeItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-900 text-xs text-slate-300">
                <div className="flex items-center space-x-2">
                  <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                    {idx + 1}
                  </span>
                  <span>{item}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const filtered = currentPpeItems.filter((_, i) => i !== idx);
                    onUpdateStep({
                      interaction: {
                        ...step.interaction,
                        type: 'ppe_checklist',
                        ppeItems: filtered
                      }
                    });
                  }}
                  className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 8. KNOWLEDGE QUIZ STEP STUDIO
   * ========================================================================= */
  if (step.type === 'knowledge_quiz') {
    const currentQuiz = step.interaction?.quiz || {
      passingScore: 80,
      questions: [
        {
          id: 'q1',
          question: 'I have read and agree to comply with plant safety requirements.',
          options: ['I agree and will comply', 'I have questions or need assistance'],
          correctOptionIndex: 0
        }
      ]
    };

    return (
      <div className="space-y-4 animate-fade-in" data-testid="knowledge-quiz-studio">
        {/* Passing Score Threshold */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Passing Score Threshold</span>
            </h5>
            <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {currentQuiz.passingScore}% Passing
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
            Pre-Publish Rule 4 mandates at least 50% passing threshold for all comprehension quizzes.
          </p>

          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={currentQuiz.passingScore}
            onChange={(e) => {
              const val = Number(e.target.value);
              onUpdateStep({
                interaction: {
                  ...step.interaction,
                  type: 'quiz',
                  quiz: { ...currentQuiz, passingScore: val }
                }
              });
            }}
            className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
          />

          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>50% (Minimum)</span>
            <span>80% (Standard)</span>
            <span>100% (Strict)</span>
          </div>
        </div>

        {/* Questions Manager */}
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-slate-300">
              Quiz Questions ({currentQuiz.questions.length})
            </h5>
            <button
              type="button"
              onClick={() => {
                const newQ = {
                  id: `q-${Date.now()}`,
                  question: `Comprehension Question ${currentQuiz.questions.length + 1}`,
                  options: ['Correct Option', 'Incorrect Option'],
                  correctOptionIndex: 0
                };
                onUpdateStep({
                  interaction: {
                    ...step.interaction,
                    type: 'quiz',
                    quiz: {
                      ...currentQuiz,
                      questions: [...currentQuiz.questions, newQ]
                    }
                  }
                });
                setExpandedQuestionIdx(currentQuiz.questions.length);
              }}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition"
            >
              + Add Question
            </button>
          </div>

          <div className="space-y-2">
            {currentQuiz.questions.map((q, qIdx) => {
              const isExpanded = expandedQuestionIdx === qIdx;

              return (
                <div key={q.id || qIdx} className="bg-slate-950 border border-slate-900 rounded-lg overflow-hidden">
                  <div
                    onClick={() => setExpandedQuestionIdx(isExpanded ? null : qIdx)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-900/50 transition"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        Q{qIdx + 1}
                      </span>
                      <span className="text-xs font-medium text-slate-300 truncate">{q.question}</span>
                    </div>
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  </div>

                  {isExpanded && (
                    <div className="p-3 pt-0 space-y-3 border-t border-slate-900 mt-2">
                      <div>
                        <label className="block text-[9px] font-bold uppercase text-slate-500 mb-1">Question Prompt</label>
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => {
                            const updated = [...currentQuiz.questions];
                            updated[qIdx] = { ...q, question: e.target.value };
                            onUpdateStep({
                              interaction: {
                                ...step.interaction,
                                type: 'quiz',
                                quiz: { ...currentQuiz, questions: updated }
                              }
                            });
                          }}
                          className="w-full rounded border border-slate-900 bg-slate-900/50 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                        />
                      </div>

                      {/* Options */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-bold uppercase text-slate-500">
                          Options & Correct Answer
                        </label>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`correct-q-${qIdx}`}
                              checked={q.correctOptionIndex === optIdx}
                              onChange={() => {
                                const updated = [...currentQuiz.questions];
                                updated[qIdx] = { ...q, correctOptionIndex: optIdx };
                                onUpdateStep({
                                  interaction: {
                                    ...step.interaction,
                                    type: 'quiz',
                                    quiz: { ...currentQuiz, questions: updated }
                                  }
                                });
                              }}
                              className="accent-emerald-500"
                              title="Set as correct answer"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const updated = [...currentQuiz.questions];
                                const opts = [...q.options];
                                opts[optIdx] = e.target.value;
                                updated[qIdx] = { ...q, options: opts };
                                onUpdateStep({
                                  interaction: {
                                    ...step.interaction,
                                    type: 'quiz',
                                    quiz: { ...currentQuiz, questions: updated }
                                  }
                                });
                              }}
                              className="flex-1 rounded border border-slate-900 bg-slate-900/30 p-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...currentQuiz.questions];
                                  const opts = q.options.filter((_, i) => i !== optIdx);
                                  let newCorrect = q.correctOptionIndex;
                                  if (newCorrect >= opts.length) newCorrect = 0;
                                  updated[qIdx] = { ...q, options: opts, correctOptionIndex: newCorrect };
                                  onUpdateStep({
                                    interaction: {
                                      ...step.interaction,
                                      type: 'quiz',
                                      quiz: { ...currentQuiz, questions: updated }
                                    }
                                  });
                                }}
                                className="p-1 text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-900/60">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...currentQuiz.questions];
                            const opts = [...q.options, `Option ${q.options.length + 1}`];
                            updated[qIdx] = { ...q, options: opts };
                            onUpdateStep({
                              interaction: {
                                ...step.interaction,
                                type: 'quiz',
                                quiz: { ...currentQuiz, questions: updated }
                              }
                            });
                          }}
                          className="text-[10px] text-emerald-400 hover:underline"
                        >
                          + Add Option
                        </button>
                        {currentQuiz.questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = currentQuiz.questions.filter((_, i) => i !== qIdx);
                              onUpdateStep({
                                interaction: {
                                  ...step.interaction,
                                  type: 'quiz',
                                  quiz: { ...currentQuiz, questions: updated }
                                }
                              });
                            }}
                            className="text-[10px] text-rose-400 hover:underline"
                          >
                            Delete Question
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 9. SUPERVISOR GATE STEP STUDIO
   * ========================================================================= */
  if (step.type === 'supervisor_gate') {
    return (
      <div className="space-y-4 animate-fade-in" data-testid="supervisor-gate-studio">
        <div className="bg-indigo-950/20 border border-indigo-500/30 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-indigo-300 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Supervisor Physical Witness Requirement</span>
            </h5>
            <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
              Co-Signature
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-relaxed">
            When a worker reaches this slide on the physical terminal, the kiosk freezes progression and triggers a witness verification modal. A designated safety supervisor must enter their 4-digit PIN to release the completion lock.
          </p>

          <div className="pt-2 border-t border-indigo-500/20 flex items-center justify-between text-xs">
            <span className="text-slate-300">Witness Requirement Status</span>
            <span className="text-emerald-400 font-bold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5" />
              <span>Active on Step & Journey</span>
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 10. COMPLETION GATE STEP STUDIO
   * ========================================================================= */
  if (step.type === 'completion') {
    const idleSeconds = journey.settings?.idleTimeoutSeconds || 60;

    return (
      <div className="space-y-4 animate-fade-in" data-testid="completion-step-studio">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <Award className="w-6 h-6" />
          </div>

          <div>
            <h5 className="text-sm font-bold text-white">Journey Completion & Certificate</h5>
            <p className="text-[11px] text-slate-400 mt-1">
              Final milestone reached by worker. Logs completion record in the compliance audit trail.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-900 text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Terminal Auto-Reset:</span>
              <span className="text-emerald-400 font-mono font-bold">{idleSeconds}s idle timeout</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Completion Record:</span>
              <span className="text-slate-200 font-mono">Immutable Log Hash</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
   * 11. GENERAL INFO STEP (Default fallback)
   * ========================================================================= */
  return (
    <div className="space-y-4 animate-fade-in" data-testid="info-step-studio">
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-bold text-slate-200 flex items-center space-x-2">
            <Info className="w-4 h-4 text-emerald-400" />
            <span>Information Slide Composition</span>
          </h5>
          <span className="text-[10px] font-mono text-slate-500">
            {step.blocks?.length || 0} Blocks
          </span>
        </div>

        <p className="text-[11px] text-slate-400">
          Combine rich text, safety warning symbols, illustrations, or diagrams to deliver instructions clearly.
        </p>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={() => onAddBlock('text')}
            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300 text-xs flex flex-col items-center space-y-1 transition"
          >
            <span className="font-mono text-emerald-400 font-bold">¶</span>
            <span className="text-[10px]">Add Text</span>
          </button>
          <button
            type="button"
            onClick={() => onAddBlock('image')}
            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300 text-xs flex flex-col items-center space-y-1 transition"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px]">Add Image</span>
          </button>
          <button
            type="button"
            onClick={() => onAddBlock('icon')}
            className="p-2.5 rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300 text-xs flex flex-col items-center space-y-1 transition"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[10px]">Add Icon</span>
          </button>
        </div>
      </div>
    </div>
  );
};
