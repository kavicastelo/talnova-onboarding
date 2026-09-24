import React from 'react';
import { ShieldAlert, Mail, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DemoBannerProps {
  companyName?: string;
  userName?: string;
  role?: string;
  onTriggerRestricted?: (featureName: string) => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({
  companyName = 'Demo Company',
  userName = 'Demo User',
  role = 'demo_employee',
  onTriggerRestricted,
}) => {
  return (
    <div className="bg-gradient-to-r from-amber-600 via-indigo-700 to-indigo-900 text-white px-4 py-2 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm font-medium">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold uppercase tracking-wider text-[10px]">
            <ShieldAlert className="w-3 h-3" />
            Demo Mode
          </span>
          <span className="opacity-90">
            Tenant: <strong className="text-white underline">{companyName}</strong>
          </span>
          <span className="hidden sm:inline text-white/40">|</span>
          <span className="hidden sm:inline opacity-80">
            Attributable User: <strong>{userName}</strong> ({role})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onTriggerRestricted?.('Production HRIS Integrations')}
            className="hidden md:inline-flex items-center gap-1 hover:text-amber-200 transition-colors opacity-80 text-xs"
            title="Demonstration of restricted feature guard"
          >
            <AlertTriangle className="w-3 h-3 text-amber-300" />
            Integrations (Restricted)
          </button>

          <Link
            to="/demo/inbox"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition-all text-xs font-semibold"
          >
            <Mail className="w-3.5 h-3.5 text-amber-300" />
            Simulated Inbox (Safe Sink)
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DemoBanner;
