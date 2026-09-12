import React, { useState } from 'react';
import {
  Sliders,
  AlertTriangle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../Dialog';
import { Button } from '../Button';
import { Label } from '../Label';
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
      setValidationError('Please provide a brief reason for manual partner reassignment.');
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
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Manual Buddy Reassignment (HITL Override)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Veto or customize algorithmic pairing when bespoke pairing is required.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Pairing Context Summary */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/30 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mentee:</span>
              <span className="font-semibold text-foreground">{pairing.newHireName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Mentor:</span>
              <span className="text-foreground">{pairing.currentBuddyName || 'Algorithmic Queue / Unassigned'}</span>
            </div>
            {pairing.department && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department:</span>
                <span className="text-foreground">{pairing.department}</span>
              </div>
            )}
          </div>

          {/* Replacement Mentor Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Select Replacement Mentor <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              options={availableBuddies.map((b) => ({
                label: `${b.name} (${b.department || 'General'}) — [${b.currentMentees}/${b.maxMentees} active]`,
                value: b.id,
              }))}
              value={selectedBuddyId}
              onChange={setSelectedBuddyId}
              placeholder="Search and choose mentor..."
            />
          </div>

          {/* Capacity Alert if full */}
          {isAtCapacity && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Capacity Warning:</strong> {selectedBuddy?.name} is already mentoring {selectedBuddy?.currentMentees}/{selectedBuddy?.maxMentees} employees. As an admin, you may override this capacity limit.
              </span>
            </div>
          )}

          {/* Reason for Override */}
          <div className="space-y-1.5">
            <Label htmlFor="buddy-override-reason" className="text-xs font-semibold text-foreground">
              Reason for Manual Pairing <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="buddy-override-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Requested specific mentor with Japanese/English bilingual fluency for Tokyo project transition..."
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Notification Checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="notify"
              checked={notifyParties}
              onChange={(e) => setNotifyParties(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="notify" className="text-xs text-muted-foreground cursor-pointer">
              Send warm introduction notification & calendar invite to both parties
            </label>
          </div>

          {validationError && (
            <p className="text-xs text-destructive font-medium">{validationError}</p>
          )}

          <DialogFooter className="gap-2 pt-2 border-t border-border/60">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="bg-primary text-primary-foreground">
              {isSubmitting ? 'Saving...' : 'Confirm Manual Pairing'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
