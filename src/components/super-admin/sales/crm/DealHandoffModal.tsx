import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Sparkles,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../../components/Dialog';
import { Button } from '../../../../components/Button';
import { Input } from '../../../../components/Input';
import { Label } from '../../../../components/Label';
import {
  salesService,
  DealItem,
  HandoffDealResponse,
} from '../../../../services/sales.service';

export interface DealHandoffModalProps {
  isOpen: boolean;
  deal: DealItem | null;
  onClose: () => void;
  onHandoffSuccess?: (response: HandoffDealResponse) => void;
}

export const DealHandoffModal: React.FC<DealHandoffModalProps> = ({
  isOpen,
  deal,
  onClose,
  onHandoffSuccess,
}) => {
  const queryClient = useQueryClient();

  // Extract company and contact defaults
  const defaultCompanyName =
    typeof deal?.companyId === 'object' && deal?.companyId?.name
      ? deal.companyId.name
      : deal?.name || '';

  const defaultAdminEmail =
    typeof deal?.primaryContactId === 'object' && deal?.primaryContactId?.email
      ? deal.primaryContactId.email
      : '';

  const [organizationName, setOrganizationName] = useState(defaultCompanyName);
  const [adminEmail, setAdminEmail] = useState(defaultAdminEmail);
  const [handoffNotes, setHandoffNotes] = useState('');
  const [handoffResult, setHandoffResult] = useState<HandoffDealResponse | null>(null);

  // Sync state if deal changes
  React.useEffect(() => {
    if (deal) {
      const compName =
        typeof deal.companyId === 'object' && deal.companyId?.name
          ? deal.companyId.name
          : deal.name || '';
      const email =
        typeof deal.primaryContactId === 'object' && deal.primaryContactId?.email
          ? deal.primaryContactId.email
          : '';
      setOrganizationName(compName);
      setAdminEmail(email);
      setHandoffNotes('');
      setHandoffResult(null);
    }
  }, [deal]);

  const handoffMutation = useMutation({
    mutationFn: async () => {
      if (!deal) throw new Error('No deal selected for handoff');
      return salesService.handoffDealToOnboarding(deal._id, {
        organizationName: organizationName.trim() || undefined,
        adminEmail: adminEmail.trim() || undefined,
        notes: handoffNotes.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setHandoffResult(data);
      toast.success(
        data.alreadyCompleted
          ? 'Onboarding was already initiated for this deal.'
          : 'Enterprise Onboarding handoff initiated successfully!'
      );
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['sales-deals'] });
      queryClient.invalidateQueries({ queryKey: ['sales-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['sales-deal', deal?._id] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      if (onHandoffSuccess) onHandoffSuccess(data);
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message || err.message || 'Failed to initiate onboarding handoff';
      toast.error(msg);
    },
  });

  if (!deal) return null;

  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: deal.currency || 'USD',
    maximumFractionDigits: 0,
  }).format(deal.value || 0);

  const isAlreadyHandedOff =
    deal.wonDetails?.onboardingHandedOff || handoffResult?.alreadyCompleted;
  const currentOrgId =
    deal.wonDetails?.organizationId || handoffResult?.organizationId;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 p-0 overflow-hidden shadow-xl">
        {/* Header Strip */}
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 p-6 border-b border-slate-200">
          <DialogHeader>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 border border-indigo-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                Enterprise Onboarding Handoff
              </DialogTitle>
            </div>
            <DialogDescription className="text-slate-500 text-sm">
              Provision contracted organization, admin workspace, and finance customer account.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Deal Summary Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">{deal.name}</h4>
                <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {defaultCompanyName}
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {formattedValue}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs text-slate-600">
              <div>
                <span className="text-slate-500">Contract Signed:</span>{' '}
                <span className="text-slate-800 font-medium">
                  {deal.wonDetails?.contractSignedDate
                    ? new Date(deal.wonDetails.contractSignedDate).toLocaleDateString()
                    : 'Recorded on Won'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Stage:</span>{' '}
                <span className="text-emerald-700 font-semibold uppercase tracking-wide">
                  {deal.stage.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* If already handed off or completed in this session */}
          {(isAlreadyHandedOff || handoffResult) ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-3 text-slate-800">
              <div className="flex items-center gap-2.5 text-emerald-800 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Onboarding Provisioning Confirmed</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                The enterprise organization and customer account have been successfully created and linked to this deal.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-200 text-xs font-mono">
                {currentOrgId && (
                  <div className="p-2 rounded bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      Organization ID
                    </span>
                    <span className="text-emerald-700 font-semibold">{currentOrgId}</span>
                  </div>
                )}
                {handoffResult?.customerAccountId && (
                  <div className="p-2 rounded bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      Customer Account
                    </span>
                    <span className="text-indigo-700 font-semibold">
                      {handoffResult.customerAccountId}
                    </span>
                  </div>
                )}
                {handoffResult?.packageName && (
                  <div className="p-2 rounded bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      Assigned Package
                    </span>
                    <span className="text-slate-800 font-semibold">
                      {handoffResult.packageName}
                    </span>
                  </div>
                )}
                {handoffResult?.ownerUserId && (
                  <div className="p-2 rounded bg-white border border-emerald-200">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans">
                      Owner User ID
                    </span>
                    <span className="text-slate-800">{handoffResult.ownerUserId}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Handoff Configuration Form */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="handoff-org-name" className="text-xs font-medium text-slate-700">
                  Target Organization Name
                </Label>
                <Input
                  id="handoff-org-name"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Acme Corp Enterprise"
                  className="bg-white border-slate-300 text-slate-900 text-sm focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="handoff-admin-email" className="text-xs font-medium text-slate-700">
                  Initial Admin / Owner Email
                </Label>
                <Input
                  id="handoff-admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@customer-domain.com"
                  className="bg-white border-slate-300 text-slate-900 text-sm focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="handoff-notes" className="text-xs font-medium text-slate-700">
                  Handoff & Special Implementation Notes (Optional)
                </Label>
                <Input
                  id="handoff-notes"
                  value={handoffNotes}
                  onChange={(e) => setHandoffNotes(e.target.value)}
                  placeholder="Custom integrations, SSO requirements, contracted onboarding timeline..."
                  className="bg-white border-slate-300 text-slate-900 text-sm focus:border-indigo-500"
                />
              </div>

              <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 flex items-start gap-2.5 text-xs text-indigo-800">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-indigo-600" />
                <p>
                  Provisioning initializes an enterprise Organization, provisions the Owner role credentials, generates a finance CustomerAccount, and emits internal handoff events.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900"
          >
            {handoffResult || isAlreadyHandedOff ? 'Close' : 'Cancel'}
          </Button>

          {!(isAlreadyHandedOff || handoffResult) && (
            <Button
              type="button"
              onClick={() => handoffMutation.mutate()}
              disabled={handoffMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm gap-1.5"
            >
              {handoffMutation.isPending ? (
                'Provisioning Organization...'
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Initiate Handoff Now
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
