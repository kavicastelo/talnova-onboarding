import React, { useState } from 'react';
import { AlertCircle, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../Dialog';
import { Button } from '../../Button';
import { Label } from '../../Label';
import { DealItem } from '../../../services/sales.service';

interface ClosedLostDialogProps {
  isOpen: boolean;
  deal: DealItem | null;
  onClose: () => void;
  onConfirm: (lossReason: string, lossDetails?: string) => void;
  isLoading?: boolean;
}

const LOSS_REASON_OPTIONS = [
  { value: 'price', label: 'Pricing / Budget Constraints' },
  { value: 'competitor', label: 'Lost to Competitor' },
  { value: 'feature_gap', label: 'Missing Feature / Technical Fit' },
  { value: 'timing', label: 'Project Postponed / Bad Timing' },
  { value: 'authority', label: 'No Decision / Lack of Executive Buy-in' },
  { value: 'other', label: 'Other Reason' },
];

export const ClosedLostDialog: React.FC<ClosedLostDialogProps> = ({
  isOpen,
  deal,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [lossReason, setLossReason] = useState<string>('');
  const [lossDetails, setLossDetails] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!lossReason.trim()) {
      setError('Please select a loss reason to document this outcome.');
      return;
    }
    setError(null);
    onConfirm(lossReason, lossDetails.trim() || undefined);
  };

  const handleClose = () => {
    setLossReason('');
    setLossDetails('');
    setError(null);
    onClose();
  };

  if (!deal) return null;

  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: deal.currency || 'USD',
    maximumFractionDigits: 0,
  }).format(deal.value || 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-100">
                Mark Deal as Closed Lost
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Capture the primary reason this opportunity did not convert.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Deal Summary Box */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs space-y-1 my-2">
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Deal Name:</span>
            <span className="text-slate-200 font-semibold text-right truncate max-w-[240px]">
              {deal.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-medium">Value:</span>
            <span className="text-slate-200 font-semibold">{formattedValue}</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Reason Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="loss-reason-select" className="text-xs font-medium text-slate-200">
              Loss Reason <span className="text-rose-400">*</span>
            </Label>
            <select
              id="loss-reason-select"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={lossReason}
              onChange={(e) => {
                setLossReason(e.target.value);
                setError(null);
              }}
            >
              <option value="">-- Select primary reason --</option>
              {LOSS_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Details Textarea */}
          <div className="space-y-1.5">
            <Label htmlFor="loss-details-textarea" className="text-xs font-medium text-slate-200">
              Additional Context / Objection Details (Optional)
            </Label>
            <textarea
              id="loss-details-textarea"
              rows={3}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-slate-100 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="e.g., Prospect chose competitor due to lower pricing tier; follow up in Q3."
              value={lossDetails}
              onChange={(e) => setLossDetails(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading || !lossReason}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {isLoading ? 'Updating...' : 'Confirm Closed Lost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClosedLostDialog;
