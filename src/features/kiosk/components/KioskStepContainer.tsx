import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Hand,
  Check
} from 'lucide-react';
import { KioskStep } from '../../../types/kiosk/step.types';
import { KioskBlock } from '../../../types/kiosk/block.types';
import { KnowledgeQuizEngine } from './interactions/KnowledgeQuizEngine';

export interface KioskStepContainerProps {
  step: KioskStep | null;
  stepIndex: number;
  direction?: 'forward' | 'backward';
  selectedLanguage: string;
  highContrast?: boolean;
  videoCompleted?: boolean;
  onVideoComplete?: () => void;
  // Interaction handlers
  onYesNoSelection?: (response: boolean) => void;
  onHotspotClick?: (actionStepId: string, idx: number) => void;
  // Hold-to-confirm
  holdProgress?: number;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
  // PPE Checklist
  checkedPpe?: Set<string>;
  onTogglePpeItem?: (item: string) => void;
  onSelectAllPpe?: () => void;
  onSubmitPpe?: () => void;
  ppeSubmitted?: boolean;
  ppeResetCountdown?: number;
  ppeSubmitError?: string | null;
  // Quiz
  onQuizPass?: (score: number) => void;
  onQuizFail?: (score: number) => void;
  // Subtitles
  showSubtitles?: boolean;
  className?: string;
}

export const KioskStepContainer: React.FC<KioskStepContainerProps> = ({
  step,
  stepIndex,
  direction = 'forward',
  selectedLanguage,
  highContrast = false,
  videoCompleted = false,
  onVideoComplete,
  onYesNoSelection,
  onHotspotClick,
  holdProgress = 0,
  onHoldStart,
  onHoldEnd,
  checkedPpe = new Set(),
  onTogglePpeItem,
  onSelectAllPpe,
  onSubmitPpe,
  ppeSubmitted = false,
  ppeResetCountdown = 10,
  ppeSubmitError = null,
  onQuizPass,
  onQuizFail,
  showSubtitles = false,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  if (!step) {
    return (
      <div
        data-testid="kiosk-step-container"
        className="flex-1 flex items-center justify-center p-8 text-center"
      >
        <p className="text-slate-500">{t('player.noContentAvailable', { defaultValue: 'No content available for this step.' })}</p>
      </div>
    );
  }

  const renderContentBlock = (block: KioskBlock) => {
    const ref = block.mediaReferences?.[selectedLanguage] || block.mediaReferences?.['en'];
    if (!ref) return null;

    switch (block.type) {
      case 'text':
        return (
          <p
            key={block.id}
            className={`leading-relaxed font-normal ${
              block.settings?.size === 'large'
                ? 'text-2xl sm:text-3xl'
                : block.settings?.size === 'small'
                ? 'text-base sm:text-lg'
                : 'text-lg sm:text-xl'
            } ${
              highContrast
                ? 'text-white bg-black/60 p-4 rounded-xl border border-white/20'
                : block.settings?.contrastMode
                ? 'text-slate-100 bg-black/40 p-4 rounded-xl'
                : 'text-slate-200'
            }`}
          >
            {ref.textValue}
          </p>
        );

      case 'image': {
        const imageUrl = ref.embedUrl || (ref.uploadId ? `/api/v1/kiosk/uploads/${ref.uploadId}` : '');
        return (
          <div
            key={block.id}
            className={`relative overflow-hidden rounded-2xl border flex items-center justify-center ${
              highContrast
                ? 'border-white bg-black'
                : 'border-slate-800 bg-slate-900/60'
            }`}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={step.title || 'Instructional Step Visual'}
                className="max-h-[48vh] w-full object-contain p-2"
              />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-slate-600 font-mono text-sm">
                Visual Reference Asset
              </div>
            )}
          </div>
        );
      }

      case 'video': {
        const videoUrl = ref.embedUrl || (ref.uploadId ? `/api/v1/kiosk/uploads/${ref.uploadId}` : '');
        return (
          <div
            key={block.id}
            className="aspect-video w-full max-h-[50vh] overflow-hidden rounded-2xl bg-black border border-slate-900 relative shadow-2xl"
          >
            <video
              id="sop-video-player"
              src={videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'}
              autoPlay={block.settings?.autoplay}
              loop={block.settings?.loop}
              controls
              onEnded={onVideoComplete}
              className="h-full w-full object-cover"
            />
            {!videoCompleted && onVideoComplete && (
              <button
                id="sop-video-complete-btn"
                type="button"
                onClick={onVideoComplete}
                className="absolute bottom-4 right-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-sm min-h-[48px] shadow-lg flex items-center space-x-2 cursor-pointer z-10 active:scale-95 transition"
              >
                <span>{t('player.videoFinished', { defaultValue: 'Video Finished' })}</span>
                <CheckCircle2 className="w-5 h-5" />
              </button>
            )}
          </div>
        );
      }

      case 'icon':
        return (
          <div key={block.id} className="flex justify-center p-4">
            <div
              className={`p-6 rounded-full border-2 ${
                block.settings?.theme === 'danger'
                  ? 'text-rose-500 border-rose-500/30 bg-rose-950/20'
                  : block.settings?.theme === 'warning'
                  ? 'text-amber-500 border-amber-500/30 bg-amber-950/20'
                  : block.settings?.theme === 'mandatory'
                  ? 'text-sky-500 border-sky-500/30 bg-sky-950/20'
                  : 'text-emerald-500 border-emerald-500/30 bg-emerald-950/20'
              }`}
            >
              <AlertTriangle className="w-16 h-16" />
            </div>
          </div>
        );

      case 'animation':
        return (
          <div
            key={block.id}
            className="flex justify-center rounded-2xl bg-slate-900/50 p-8 border border-slate-800"
          >
            <div className="h-32 w-32 animate-bounce rounded-full bg-emerald-500/20 border-2 border-emerald-500/60 flex items-center justify-center">
              <span className="text-emerald-400 font-semibold text-lg">{t('player.animation', { defaultValue: 'Animated Demonstration' })}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isEmergency = step.type === 'emergency_step';
  const isWarning = step.type === 'warning_step';

  return (
    <main
      data-testid="kiosk-step-container"
      data-step-index={stepIndex}
      data-direction={direction}
      className={`relative flex-1 overflow-y-auto w-full flex flex-col justify-start px-4 sm:px-8 lg:px-12 py-6 transition-all duration-300 ease-out ${
        direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'
      } ${className}`}
    >
      <div className="w-full max-w-5xl mx-auto space-y-6 flex-1 flex flex-col justify-center">
        {/* Step-specific warning or emergency protocol header */}
        {(isEmergency || isWarning) && (
          <div
            className={`flex items-start space-x-4 border rounded-2xl p-6 ${
              isEmergency
                ? 'bg-rose-950/30 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-amber-950/30 border-amber-500/50 text-amber-300'
            }`}
          >
            {isEmergency ? (
              <ShieldAlert className="w-8 h-8 shrink-0 text-rose-400" />
            ) : (
              <AlertTriangle className="w-8 h-8 shrink-0 text-amber-400" />
            )}
            <div>
              <h3 className="text-xl font-black uppercase tracking-wider">
                {isEmergency ? 'Emergency Safety Protocol' : 'Attention / Hazard Warning'}
              </h3>
              <p className="text-sm opacity-90 mt-1">
                {isEmergency
                  ? 'Immediate action required. Please observe emergency procedures carefully.'
                  : 'Follow safe handling guidelines to prevent physical injury.'}
              </p>
            </div>
          </div>
        )}

        {/* Step Title */}
        {step.title && (
          <div className="space-y-1">
            <h2
              data-testid="kiosk-step-title"
              className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white"
            >
              {step.title}
            </h2>
          </div>
        )}

        {/* Media & Content Blocks */}
        {step.blocks && step.blocks.length > 0 && (
          <div className="space-y-6 w-full">
            {step.blocks.map(renderContentBlock)}
          </div>
        )}

        {/* Step Interactive Actions Area */}
        <div className="pt-2">
          {/* Interaction: Yes / No Decision */}
          {step.interaction?.type === 'yes_no' && onYesNoSelection && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4">
              <button
                type="button"
                data-testid="yes-btn"
                onClick={() => onYesNoSelection(true)}
                className="w-full sm:w-60 min-h-[64px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xl shadow-xl flex items-center justify-center space-x-2 transition"
              >
                <Check className="w-6 h-6 stroke-[3]" />
                <span>Yes / Confirmed</span>
              </button>
              <button
                type="button"
                data-testid="no-btn"
                onClick={() => onYesNoSelection(false)}
                className="w-full sm:w-60 min-h-[64px] rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-xl shadow-xl flex items-center justify-center space-x-2 transition"
              >
                <span>No / Unsafe</span>
              </button>
            </div>
          )}

          {/* Interaction: Circular Hold-to-Confirm */}
          {step.interaction?.type === 'hold_to_confirm' && (
            <div className="flex flex-col items-center justify-center space-y-4 py-4">
              <button
                type="button"
                data-testid="hold-to-confirm-btn"
                onMouseDown={onHoldStart}
                onMouseUp={onHoldEnd}
                onMouseLeave={onHoldEnd}
                onTouchStart={onHoldStart}
                onTouchEnd={onHoldEnd}
                className="relative h-28 w-28 rounded-full bg-slate-900 border-2 border-slate-800 hover:border-emerald-500/50 flex items-center justify-center active:scale-95 transition cursor-pointer shadow-2xl"
              >
                {/* SVG circular progress ring */}
                <svg className="absolute inset-0 h-full w-full -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-slate-800"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    className="stroke-emerald-400 transition-all duration-75"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - holdProgress / 100)}
                  />
                </svg>
                <Hand className="h-10 w-10 text-emerald-400 animate-pulse" />
              </button>
              <span className="text-slate-400 font-bold text-xs tracking-widest uppercase">
                Touch & Hold to Confirm
              </span>
            </div>
          )}

          {/* Interaction: PPE Checklist */}
          {step.interaction?.type === 'ppe_checklist' && (
            <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Mandatory PPE Verification Checklist</span>
                </h4>
                {onSelectAllPpe && (
                  <button
                    type="button"
                    onClick={onSelectAllPpe}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Select All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {(step.interaction.ppeItems || ['Hard Hat', 'Safety Glasses', 'High-Vis Vest', 'Steel Toe Boots', 'Gloves']).map(
                  (item: string) => {
                    const isChecked = checkedPpe.has(item);
                    const itemId = item.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    return (
                      <button
                        key={item}
                        type="button"
                        id={`ppe-check-${itemId}`}
                        data-testid={`ppe-check-${itemId}`}
                        onClick={() => onTogglePpeItem?.(item)}
                        className={`min-h-[52px] p-3.5 rounded-xl border text-left flex items-center justify-between font-semibold text-sm transition active:scale-98 ${
                          isChecked
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span>{item}</span>
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                            isChecked
                              ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>

              {onSubmitPpe && !ppeSubmitted && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    id="ppe-confirm-btn"
                    data-testid="ppe-confirm-btn"
                    onClick={onSubmitPpe}
                    className="min-h-[48px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition active:scale-95"
                  >
                    Verify & Record PPE Compliance
                  </button>
                </div>
              )}

              {ppeSubmitted && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>PPE compliance verified and recorded. Auto-reset in {ppeResetCountdown}s.</span>
                </div>
              )}

              {ppeSubmitError && (
                <p className="text-xs text-rose-400 font-semibold">{ppeSubmitError}</p>
              )}
            </div>
          )}

          {/* Interaction: Hotspots Overlay */}
          {step.interaction?.type === 'hotspot' && onHotspotClick && (
            <div className="absolute inset-0 pointer-events-none z-20">
              {(step.interaction.hotspots || []).map((hs, hsIdx) => (
                <button
                  key={hsIdx}
                  type="button"
                  onClick={() => onHotspotClick(hs.actionStepId, hsIdx)}
                  style={{
                    position: 'absolute',
                    left: `${hs.x}%`,
                    top: `${hs.y}%`,
                    width: `${hs.radius * 2}%`,
                    height: `${hs.radius * 2}%`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className="pointer-events-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 hover:bg-emerald-500/40 transition animate-pulse cursor-pointer shadow-lg shadow-emerald-500/25"
                  title="Interactive Hotspot"
                />
              ))}
            </div>
          )}

          {/* Interaction: Knowledge Check Quiz */}
          {(step.interaction?.type === 'quiz' || Boolean(step.interaction?.quiz || step.quiz)) && (
            <div className="w-full pt-4">
              <KnowledgeQuizEngine
                quiz={(step.interaction?.quiz || step.quiz)!}
                onPass={onQuizPass || (() => {})}
                onFail={onQuizFail}
                highContrast={highContrast}
              />
            </div>
          )}
        </div>
      </div>

      {/* Subtitles & Captions Overlay (pinned at bottom of step canvas) */}
      {showSubtitles && (
        <div className="w-full max-w-2xl mx-auto pt-4 flex justify-center text-center">
          {step.blocks.map((b) => {
            const ref = b.mediaReferences?.[selectedLanguage] || b.mediaReferences?.['en'];
            if (b.type === 'text' || !ref?.textValue) return null;
            return (
              <div
                key={b.id}
                className="w-full bg-black/85 border border-slate-800 rounded-xl px-6 py-3 text-slate-100 text-base sm:text-lg font-light tracking-wide shadow-2xl"
              >
                {ref.textValue}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default KioskStepContainer;
