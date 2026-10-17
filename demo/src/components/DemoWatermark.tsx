import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldAlert, Lock, AlertTriangle } from 'lucide-react';

interface DemoWatermarkProps {
  watermarkText?: string;
  userFullName?: string;
  tenantName?: string;
  sessionId?: string;
}

export const DemoWatermark: React.FC<DemoWatermarkProps> = ({
  watermarkText,
  userFullName,
  tenantName,
  sessionId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tamperCount, setTamperCount] = useState<number>(0);
  const [isHardLocked, setIsHardLocked] = useState<boolean>(false);
  const [isWindowBlurred, setIsWindowBlurred] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<string>(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  // Update live timestamp every 60s
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Compute session identifier hash
  const sessionHash = (sessionId || 'ANON')
    .slice(-8)
    .toUpperCase();

  const formattedText =
    watermarkText ||
    `TALNOVA DEMO | ${tenantName || 'ACME CORP'} | ${userFullName || 'AUTHORIZED PERSONA'} | ${currentTimestamp} | #${sessionHash} | CONFIDENTIAL`;

  // Draw the high-DPI forensic canvas with steganographic micro-pattern
  const drawWatermark = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // 1. Invisible / semi-transparent steganographic micro-pattern
    ctx.fillStyle = 'rgba(15, 23, 42, 0.015)';
    const dotSpacing = 80;
    for (let x = 10; x < width; x += dotSpacing) {
      for (let y = 10; y < height; y += dotSpacing) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. High-contrast, rotating forensic watermark grid
    ctx.save();
    ctx.font = '700 12px monospace';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.065)';
    ctx.textBaseline = 'middle';

    const rowSpacing = 160;
    const colSpacing = 360;

    for (let y = -height; y < height * 2; y += rowSpacing) {
      for (let x = -width; x < width * 2; x += colSpacing) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((-24 * Math.PI) / 180);
        ctx.fillText(formattedText, 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }, [formattedText]);

  // Initial render & window resize handler
  useEffect(() => {
    drawWatermark();
    window.addEventListener('resize', drawWatermark);
    return () => window.removeEventListener('resize', drawWatermark);
  }, [drawWatermark]);

  // 3. MutationObserver Watchdog: Detects tampering, style deletion, or node removal
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof MutationObserver === 'undefined') return;

    const verifyCanvasIntegrity = () => {
      const canvas = canvasRef.current;

      // Canvas missing or deleted
      if (!canvas || !container.contains(canvas)) {
        setTamperCount((prev) => {
          const next = prev + 1;
          if (next >= 4) setIsHardLocked(true);
          return next;
        });
        // Re-inject canvas
        if (canvas) container.appendChild(canvas);
        drawWatermark();
        return;
      }

      // Check for inline style tampering
      const style = window.getComputedStyle(canvas);
      const isTampered =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        parseFloat(style.opacity || '1') < 0.5 ||
        style.filter.includes('opacity(0)') ||
        canvas.hidden;

      if (isTampered) {
        canvas.style.display = 'block';
        canvas.style.visibility = 'visible';
        canvas.style.opacity = '1';
        canvas.hidden = false;

        setTamperCount((prev) => {
          const next = prev + 1;
          if (next >= 4) setIsHardLocked(true);
          return next;
        });
        drawWatermark();
      }
    };

    const observer = new MutationObserver((mutations) => {
      let requiresVerification = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const removedNode of Array.from(mutation.removedNodes)) {
            if (removedNode === canvasRef.current || (removedNode as HTMLElement).id === 'talnova-demo-watermark-canvas') {
              requiresVerification = true;
              break;
            }
          }
        } else if (mutation.type === 'attributes') {
          requiresVerification = true;
          break;
        }
      }

      if (requiresVerification) {
        verifyCanvasIntegrity();
      }
    });

    observer.observe(container, {
      childList: true,
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
    });

    return () => observer.disconnect();
  }, [drawWatermark]);

  // 4. Anti-Screen-Grab Visibility Trigger: Blur window on blur or tab switch
  useEffect(() => {
    const handleBlur = () => setIsWindowBlurred(true);
    const handleFocus = () => setIsWindowBlurred(false);
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsWindowBlurred(true);
      } else {
        setIsWindowBlurred(false);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (isHardLocked) {
    return (
      <div
        role="alertdialog"
        aria-modal="true"
        className="fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 mb-4 shadow-xl">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white mb-2">
          Security Boundary Violation
        </h1>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          Critical watermark tampering detected. In accordance with Talnova demonstration security policies, this session has been locked.
        </p>
        <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-2 font-mono text-xs text-amber-400 mb-6">
          STATUS: SCREEN_LOCK_ENFORCED [E_TAMPER_COUNT_{tamperCount}]
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Dynamic HTML5 Canvas Watermark */}
      <div
        ref={containerRef}
        id="talnova-demo-watermark-container"
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 9999,
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          id="talnova-demo-watermark-canvas"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Screen-Grab & Window Blur Protection Overlay */}
      {isWindowBlurred && (
        <div
          role="presentation"
          onClick={() => setIsWindowBlurred(false)}
          className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-xl transition-all duration-150 p-4 cursor-pointer text-center text-white animate-in fade-in"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-3 shadow-lg">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold tracking-tight text-white mb-1">
            Demonstration Session Paused
          </h2>
          <p className="text-xs text-slate-300 max-w-xs mb-3">
            Proprietary preview content is blurred while window is out of focus.
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 px-3 py-1 text-[11px] font-medium text-slate-300 shadow-xs">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            Click anywhere inside window to resume
          </span>
        </div>
      )}
    </>
  );
};

export default DemoWatermark;
