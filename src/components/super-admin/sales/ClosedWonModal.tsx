import React, { useState } from 'react';
import { CheckCircle2, Sparkles, Building2, User, Calendar, ArrowRight } from 'lucide-react';
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
import { Input } from '../../Input';
import { DealItem } from '../../../services/sales.service';

interface ClosedWonModalProps {
  isOpen: boolean;
  deal: DealItem | null;
  onClose: () => void;
  onConfirm: (options: {
    triggerHandoff: boolean;
    contractSignedDate: string;
    organizationName?: string;
  }) => void;
  isLoading?: boolean;
}

export const ClosedWonModal: React.FC<ClosedWonModalProps> = ({
  isOpen,
  deal,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  const [triggerHandoff, setTriggerHandoff] = useState<boolean>(true);
  const [contractSignedDate, setContractSignedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [customOrgName, setCustomOrgName] = useState<string>('');

  if (!deal) return null;

  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: deal.currency || 'USD',
    maximumFractionDigits: 0,
  }).format(deal.value || 0);

  const companyName =
    typeof deal.companyId === 'object' && deal.companyId?.name
      ? deal.companyId.name
      : 'Customer Organization';

  const contactName =
    typeof deal.primaryContactId === 'object' && deal.primaryContactId?.fullName
      ? deal.primaryContactId.fullName
      : typeof deal.primaryContactId === 'object' && deal.primaryContactId?.email
      ? deal.primaryContactId.email
      : 'Primary Contact';

  const handleConfirm = () => {
    onConfirm({
      triggerHandoff,
      contractSignedDate: new Date(contractSignedDate).toISOString(),
      organizationName: customOrgName.trim() || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Deal Won! Congratulations 🎉
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                You are moving this opportunity to Closed Won. Confirm contract details below.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Deal Summary Box */}
        <div className="rounded-xl border border-white/5 bg-slate-950/70 p-3.5 space-y-2 my-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Opportunity</span>
            <span className="text-xs font-semibold text-slate-200">{deal.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Total Contract Value</span>
            <span className="text-base font-bold text-emerald-400">{formattedValue}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Company
            </span>
            <span className="text-slate-300 font-medium">{companyName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <User className="h-3 w-3" /> Primary Decision Maker
            </span>
            <span className="text-slate-300 font-medium">{contactName}</span>
          </div>
        </div>

        {/* Contract Signed Date Input */}
        <div className="space-y-1.5 py-1">
          <Label htmlFor="contract-signed-date" className="text-xs font-medium text-slate-200 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-indigo-400" /> Contract Signed Date
          </Label>
          <Input
            id="contract-signed-date"
            type="date"
            value={contractSignedDate}
            onChange={(e) => setContractSignedDate(e.target.value)}
            className="bg-slate-800 border-slate-700 text-xs"
          />
        </div>

        {/* Enterprise Onboarding Handoff Callout */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 space-y-2.5 my-1">
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="trigger-handoff-checkbox"
              checked={triggerHandoff}
              onChange={(e) => setTriggerHandoff(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="trigger-handoff-checkbox"
                className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Initiate Enterprise Onboarding Handoff Now
              </Label>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Automatically provisions a tenant Organization, creates an Owner account for {contactName}, sets up Super Admin Finance CustomerAccount, and emits platform onboarding events.
              </p>
            </div>
          </div>

          {triggerHandoff && (
            <div className="pt-1.5 border-t border-indigo-500/10">
              <Label htmlFor="custom-org-name" className="text-[11px] text-slate-300">
                Organization Name Override (Optional, defaults to {companyName})
              </Label>
              <Input
                id="custom-org-name"
                placeholder={companyName}
                value={customOrgName}
                onChange={(e) => setCustomOrgName(e.target.value)}
                className="mt-1 bg-slate-800/90 border-slate-700 text-xs h-8"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="border-slate-700 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5"
          >
            {isLoading ? 'Processing Handoff...' : 'Confirm Won & Proceed'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClosedWonModal;
