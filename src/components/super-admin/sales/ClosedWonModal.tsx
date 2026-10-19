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
      <DialogContent className="max-w-lg bg-white border-slate-200 text-slate-900 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Deal Won! Congratulations 🎉
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                You are moving this opportunity to Closed Won. Confirm contract details below.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Deal Summary Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 my-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Opportunity</span>
            <span className="text-xs font-semibold text-slate-800">{deal.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Total Contract Value</span>
            <span className="text-base font-bold text-emerald-600">{formattedValue}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Company
            </span>
            <span className="text-slate-700 font-medium">{companyName}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 flex items-center gap-1">
              <User className="h-3 w-3" /> Primary Decision Maker
            </span>
            <span className="text-slate-700 font-medium">{contactName}</span>
          </div>
        </div>

        {/* Contract Signed Date Input */}
        <div className="space-y-1.5 py-1">
          <Label htmlFor="contract-signed-date" className="text-xs font-medium text-slate-700 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-indigo-600" /> Contract Signed Date
          </Label>
          <Input
            id="contract-signed-date"
            type="date"
            value={contractSignedDate}
            onChange={(e) => setContractSignedDate(e.target.value)}
            className="bg-white border-slate-300 text-slate-900 text-xs"
          />
        </div>

        {/* Enterprise Onboarding Handoff Callout */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-2.5 my-1">
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="trigger-handoff-checkbox"
              checked={triggerHandoff}
              onChange={(e) => setTriggerHandoff(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="trigger-handoff-checkbox"
                className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Initiate Enterprise Onboarding Handoff Now
              </Label>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Automatically provisions a tenant Organization, creates an Owner account for {contactName}, sets up Super Admin Finance CustomerAccount, and emits platform onboarding events.
              </p>
            </div>
          </div>

          {triggerHandoff && (
            <div className="pt-1.5 border-t border-indigo-200/60">
              <Label htmlFor="custom-org-name" className="text-[11px] text-slate-700">
                Organization Name Override (Optional, defaults to {companyName})
              </Label>
              <Input
                id="custom-org-name"
                placeholder={companyName}
                value={customOrgName}
                onChange={(e) => setCustomOrgName(e.target.value)}
                className="mt-1 bg-white border-slate-300 text-slate-900 text-xs h-8"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1.5 shadow-sm"
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
