import React from 'react';
import { ShieldAlert, RefreshCw, Mail } from 'lucide-react';

interface KioskExpiredLinkScreenProps {
  onRetry?: () => void;
  supportEmail?: string;
}

export const KioskExpiredLinkScreen: React.FC<KioskExpiredLinkScreenProps> = ({
  onRetry,
  supportEmail = 'support@talnova.com'
}) => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 px-6 text-center text-white select-none">
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-900/40 p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Glow red border decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-rose-500/10 blur-3xl" />

        <div className="flex flex-col items-center space-y-5">
          <div className="p-4 rounded-full bg-slate-950 border border-slate-800 animate-pulse">
            <ShieldAlert className="h-12 w-12 text-rose-500" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-100">Playback Link Expired</h2>
          
          <p className="text-sm text-slate-400 leading-relaxed">
            This secure public playback session has expired or holds an invalid authorization signature. 
            For compliance and security reasons, signed links are temporary.
          </p>

          <div className="w-full space-y-3 pt-4">
            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 py-3 font-semibold hover:bg-slate-800 text-slate-200 transition flex items-center justify-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Link</span>
              </button>
            )}

            <a
              href={`mailto:${supportEmail}`}
              className="w-full rounded-lg bg-emerald-500 py-3 font-bold text-slate-950 hover:bg-emerald-400 transition flex items-center justify-center space-x-2 block shadow-lg shadow-emerald-500/10"
            >
              <Mail className="h-4 w-4" />
              <span>Contact Support</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
