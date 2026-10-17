import React from 'react';
import { ShieldAlert, Lock, ArrowRight } from 'lucide-react';
import { Button } from '../../../src/components/Button';

interface DevToolsWarningOverlayProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export const DevToolsWarningOverlay: React.FC<DevToolsWarningOverlayProps> = ({
  isOpen,
  onDismiss,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/95 p-6 shadow-2xl text-slate-100">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-red-500 to-amber-500" />

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-inner">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Security Notice
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                <Lock className="h-2.5 w-2.5" /> Protected
              </span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Developer tools, page source inspection, and asset scraping shortcuts are disabled to protect proprietary workflows and intellectual property.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 text-xs text-slate-300 space-y-1.5 font-mono">
          <div className="flex items-center justify-between text-slate-400">
            <span>Environment:</span>
            <span className="text-amber-400 font-semibold">TALNOVA Interactive Demo</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Anti-Tamper Status:</span>
            <span className="text-emerald-400 font-semibold">Active & Monitored</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Security Action:</span>
            <span className="text-slate-300">Console Scrubbed</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            onClick={onDismiss}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md flex items-center justify-center gap-2"
          >
            <span>Acknowledge & Continue</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DevToolsWarningOverlay;
