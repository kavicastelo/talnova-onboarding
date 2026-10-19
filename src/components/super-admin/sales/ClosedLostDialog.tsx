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
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-200">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                Mark Deal as Closed Lost
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Capture the primary reason this opportunity did not convert.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Deal Summary Box */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1 my-2">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Deal Name:</span>
            <span className="text-slate-800 font-semibold text-right truncate max-w-[240px]">
              {deal.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Value:</span>
            <span className="text-slate-800 font-semibold">{formattedValue}</span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Reason Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="loss-reason-select" className="text-xs font-medium text-slate-700">
              Loss Reason <span className="text-rose-500">*</span>
            </Label>
            <select
              id="loss-reason-select"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <Label htmlFor="loss-details-textarea" className="text-xs font-medium text-slate-700">
              Additional Context / Objection Details (Optional)
            </Label>
            <textarea
              id="loss-details-textarea"
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              placeholder="e.g., Prospect chose competitor due to lower pricing tier; follow up in Q3."
              value={lossDetails}
              onChange={(e) => setLossDetails(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading || !lossReason}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
          >
            {isLoading ? 'Updating...' : 'Confirm Closed Lost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClosedLostDialog;
