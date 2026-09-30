import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Crosshair, MapPin, Sparkles } from 'lucide-react';
import { KioskHotspot } from '../../../../types/kiosk/step.types';

export interface HotspotInteractionEngineProps {
  hotspots: readonly KioskHotspot[];
  onHotspotClick: (actionStepId: string, hotspotIndex: number) => void;
  imageUrl?: string;
  imageAlt?: string;
  title?: string;
  subtitle?: string;
  highContrast?: boolean;
  requireAllDiscovered?: boolean;
  onAllDiscovered?: () => void;
  className?: string;
}

export const HotspotInteractionEngine: React.FC<HotspotInteractionEngineProps> = ({
  hotspots = [],
  onHotspotClick,
  imageUrl,
  imageAlt = 'Interactive Safety Diagram',
  title,
  subtitle,
  highContrast = false,
  requireAllDiscovered = false,
  onAllDiscovered,
  className = ''
}) => {
  const { t } = useTranslation('kiosk');

  // Track discovered hotspot indices
  const [discoveredIndices, setDiscoveredIndices] = useState<Set<number>>(new Set());
  const [recentlyClickedIndex, setRecentlyClickedIndex] = useState<number | null>(null);

  const totalHotspots = hotspots.length;
  const discoveredCount = discoveredIndices.size;
  const allDiscovered = totalHotspots > 0 && discoveredCount === totalHotspots;

  const handleClickHotspot = (hs: KioskHotspot, idx: number) => {
    // Record discovery
    setDiscoveredIndices((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === totalHotspots && requireAllDiscovered) {
        onAllDiscovered?.();
      }
      return next;
    });

    setRecentlyClickedIndex(idx);
    setTimeout(() => {
      setRecentlyClickedIndex(null);
    }, 600);

    onHotspotClick(hs.actionStepId, idx);
  };

  return (
    <div
      data-testid="hotspot-interaction-engine"
      className={`w-full max-w-4xl mx-auto rounded-3xl border p-4 sm:p-6 space-y-4 shadow-2xl transition-all ${
        highContrast
          ? 'bg-black border-2 border-amber-400 text-white'
          : 'bg-slate-900/80 border-slate-800 text-white backdrop-blur-md'
      } ${className}`}
    >
      {/* Header and discovery counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-slate-800">
        <div>
          <h4
            data-testid="hotspot-engine-title"
            className="text-lg sm:text-xl font-black tracking-tight flex items-center space-x-2"
          >
            <Crosshair className={`w-5 h-5 ${highContrast ? 'text-amber-400' : 'text-emerald-400'}`} />
            <span>{title || t('hotspots.title', { defaultValue: 'Interactive Hazard Inspection Zone' })}</span>
          </h4>
          <p className="text-xs text-slate-400">
            {subtitle || t('hotspots.instruction', { defaultValue: 'Touch each highlighted zone on the diagram to inspect safety instructions.' })}
          </p>
        </div>

        {/* Counter Badge */}
        <div
          data-testid="hotspot-counter"
          className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shrink-0 ${
            allDiscovered
              ? highContrast
                ? 'bg-amber-400 text-black border-amber-300'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}
        >
          {`${discoveredCount} / ${totalHotspots} ${t('hotspots.inspected', { defaultValue: 'Inspected' })}`}
        </div>
      </div>

      {/* Interactive Canvas Container */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center min-h-[300px] sm:min-h-[420px]">
        {/* Visual Map or Schematic Background */}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full h-full object-contain max-h-[55vh] select-none pointer-events-none"
          />
        ) : (
          <div className="w-full h-64 sm:h-96 flex flex-col items-center justify-center p-8 text-center text-slate-600 bg-slate-950/90 select-none">
            <MapPin className="w-12 h-12 mb-2 opacity-40 text-slate-500" />
            <p className="text-sm font-mono">{t('hotspots.schematicPlaceholder', { defaultValue: 'Facility Safety Map / Equipment Diagram' })}</p>
            <p className="text-xs text-slate-500 mt-1">{t('hotspots.touchToInspect', { defaultValue: 'Touch the hazard hotspots below to inspect zones.' })}</p>
          </div>
        )}

        {/* Hotspots Overlay Pins */}
        <div className="absolute inset-0 z-20">
          {hotspots.map((hs, idx) => {
            const isDiscovered = discoveredIndices.has(idx);
            const isRecentlyClicked = recentlyClickedIndex === idx;
            // Radius as percentage, ensuring minimum clickable pixel radius
            const diameterPercent = Math.max(hs.radius * 2, 8);

            return (
              <button
                key={idx}
                type="button"
                id={`hotspot-pin-${idx}`}
                data-testid={`hotspot-pin-${idx}`}
                data-discovered={isDiscovered}
                aria-label={`Hazard Zone ${idx + 1}`}
                onClick={() => handleClickHotspot(hs, idx)}
                style={{
                  position: 'absolute',
                  left: `${hs.x}%`,
                  top: `${hs.y}%`,
                  width: `${diameterPercent}%`,
                  height: `${diameterPercent}%`,
                  transform: 'translate(-50%, -50%)',
                  minWidth: '52px',
                  minHeight: '52px'
                }}
                className={`rounded-full flex items-center justify-center transition-all cursor-pointer select-none active:scale-90 ${
                  isRecentlyClicked ? 'scale-125' : ''
                } ${
                  isDiscovered
                    ? highContrast
                      ? 'bg-amber-400 text-black border-2 border-amber-300 shadow-xl'
                      : 'bg-emerald-500/80 text-slate-950 border-2 border-emerald-400 shadow-lg shadow-emerald-500/30'
                    : highContrast
                    ? 'bg-black/90 text-amber-300 border-2 border-amber-400 animate-pulse'
                    : 'bg-slate-900/90 text-amber-400 border-2 border-amber-500 animate-pulse hover:border-amber-400 shadow-xl'
                }`}
              >
                {/* Outer radar pulse ring */}
                {!isDiscovered && (
                  <span
                    className={`absolute inset-0 rounded-full animate-ping opacity-75 ${
                      highContrast ? 'bg-amber-400' : 'bg-amber-500'
                    }`}
                  />
                )}

                {/* Inner Icon */}
                <div className="relative z-10 flex items-center justify-center">
                  {isDiscovered ? (
                    <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* All Discovered Celebration Banner */}
      {allDiscovered && (
        <div
          data-testid="hotspot-all-discovered-banner"
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs sm:text-sm animate-fade-in ${
            highContrast
              ? 'bg-black border-amber-400 text-amber-300'
              : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-bold">
              {t('hotspots.allZonesInspected', { defaultValue: 'All inspection zones reviewed! You can now proceed to the next step.' })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default HotspotInteractionEngine;
