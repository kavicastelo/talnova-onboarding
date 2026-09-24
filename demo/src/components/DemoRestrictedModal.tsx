import React from 'react';
import { Lock, Sparkles, X } from 'lucide-react';

interface DemoRestrictedModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

export const DemoRestrictedModal: React.FC<DemoRestrictedModalProps> = ({
  isOpen,
  onClose,
  featureName = 'Advanced Enterprise Feature',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 text-slate-900 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
          <Lock className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
          {featureName}
        </h3>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4 font-medium">
          Available during a guided demonstration. Contact your representative for customized access.
        </div>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          To protect data security and external system integrity, direct access to production-grade integrations, live webhooks, and raw administrative settings is restricted in the interactive self-guided sandbox.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Continue Demo
          </button>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default DemoRestrictedModal;
