import React, { useState } from 'react';
import {
  Sliders,
  AlertTriangle,
  User,
  Users,
  Building2,
  CheckCircle2,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '../Dialog';
import { Button } from '../Button';
import { Label } from '../Label';
import { Badge } from '../Badge';
import { SearchableSelect } from '../SearchableSelect';
import { toast } from 'sonner';

interface AdminBuddyOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairing: {
    assignmentId?: string;
    newHireId: string;
    newHireName: string;
    currentBuddyId?: string;
    currentBuddyName?: string;
    department?: string;
    matchScore?: number;
  } | null;
  availableBuddies: Array<{
    id: string;
    name: string;
    department?: string;
    currentMentees: number;
    maxMentees: number;
  }>;
  onConfirmOverride: (params: {
    newHireId: string;
    targetBuddyId: string;
    reason: string;
    notifyParties: boolean;
  }) => Promise<void>;
}

export const AdminBuddyOverrideModal: React.FC<AdminBuddyOverrideModalProps> = ({
  isOpen,
  onClose,
  pairing,
  availableBuddies,
  onConfirmOverride,
}) => {
  const [selectedBuddyId, setSelectedBuddyId] = useState('');
  const [reason, setReason] = useState('');
  const [notifyParties, setNotifyParties] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  if (!pairing) return null;

  const selectedBuddy = availableBuddies.find((b) => b.id === selectedBuddyId);
  const isAtCapacity = selectedBuddy && selectedBuddy.currentMentees >= selectedBuddy.maxMentees;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!selectedBuddyId) {
      setValidationError('Please select a replacement mentor.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 8) {
      setValidationError('Please provide a specific reason for manual partner reassignment (min 8 characters).');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmOverride({
        newHireId: pairing.newHireId,
        targetBuddyId: selectedBuddyId,
        reason: reason.trim(),
        notifyParties,
      });
      toast.success(`Buddy assignment updated for ${pairing.newHireName}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update buddy assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Manual Buddy Reassignment (HITL Override)
              </DialogTitle>
              <DialogDescription>
                Veto or customize algorithmic pairing when bespoke onboarding mentorship is required.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogBody className="space-y-4">
            {/* Pairing Context Summary Card */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/30 space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-medium text-muted-foreground pb-2 border-b border-border/40">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" /> Active Pairing Context
                </span>
                {pairing.matchScore !== undefined && (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] gap-1">
                    <Sparkles className="h-3 w-3" /> {pairing.matchScore}% Match
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Mentee (New Hire)</span>
                  <span className="font-semibold text-foreground text-sm flex items-center gap-1 mt-0.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {pairing.newHireName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Current Mentor</span>
                  <span className="font-medium text-foreground text-sm flex items-center gap-1 mt-0.5">
                    {pairing.currentBuddyName || 'Algorithmic Queue / Unassigned'}
                  </span>
                </div>
              </div>

              {pairing.department && (
                <div className="flex items-center gap-1.5 text-muted-foreground pt-1 border-t border-border/30">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Department: <strong className="text-foreground">{pairing.department}</strong></span>
                </div>
              )}
            </div>

            {/* Replacement Mentor Selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Select Replacement Mentor <span className="text-destructive">*</span></span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {availableBuddies.length} available mentors
                </span>
              </Label>
              <SearchableSelect
                options={availableBuddies.map((b) => ({
                  label: `${b.name} (${b.department || 'General'}) — [${b.currentMentees}/${b.maxMentees} active]`,
                  value: b.id,
                }))}
                value={selectedBuddyId}
                onChange={(val) => {
                  setSelectedBuddyId(val);
                  setValidationError('');
                }}
                placeholder="Search and choose mentor..."
                searchPlaceholder="Search by mentor name or department..."
              />
            </div>

            {/* Capacity Alert if full */}
            {isAtCapacity && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Capacity Warning:</strong> {selectedBuddy?.name} is currently mentoring {selectedBuddy?.currentMentees}/{selectedBuddy?.maxMentees} employees. As an administrator, you may override this capacity threshold.
                </div>
              </div>
            )}

            {/* Reason for Override */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="buddy-override-reason" className="text-xs font-semibold text-foreground">
                  Reason for Manual Pairing <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {reason.trim().length >= 8 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Ready</span>
                  ) : (
                    <span>min 8 chars</span>
                  )}
                </span>
              </div>
              <textarea
                id="buddy-override-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setValidationError('');
                }}
                placeholder="e.g. Assigned dedicated bilingual mentor with Japanese/English fluency for overseas team transition..."
                className="w-full text-xs p-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              />
            </div>

            {/* Notification Checkbox */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20">
              <input
                type="checkbox"
                id="notify-parties"
                checked={notifyParties}
                onChange={(e) => setNotifyParties(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="notify-parties" className="text-xs text-muted-foreground cursor-pointer leading-relaxed">
                Send warm introduction email notification and calendar 1-on-1 invitation to both parties.
              </label>
            </div>

            {validationError && (
              <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </DialogBody>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !selectedBuddyId || reason.trim().length < 8}
              className="bg-primary text-primary-foreground font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Assignment...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm Manual Pairing
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
