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

interface JourneyOverrideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: {
    id: string;
    employeeName: string;
    currentJourneyTitle: string;
    caseId?: string;
    department?: string;
  } | null;
  journeys: Array<{ id: string; title: string }>;
  onConfirmOverride: (params: {
    targetJourneyId: string;
    reason: string;
    grandfatherArtifacts: boolean;
  }) => Promise<void>;
}

export const JourneyOverrideDrawer: React.FC<JourneyOverrideDrawerProps> = ({
  isOpen,
  onClose,
  assignment,
  journeys,
  onConfirmOverride,
}) => {
  const [selectedJourneyId, setSelectedJourneyId] = useState('');
  const [reason, setReason] = useState('');
  const [grandfatherArtifacts, setGrandfatherArtifacts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  if (!assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!selectedJourneyId) {
      setValidationError('Please select a target Journey Template.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      setValidationError('Audit reason is required and must be at least 10 characters.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmOverride({
        targetJourneyId: selectedJourneyId,
        reason: reason.trim(),
        grandfatherArtifacts,
      });
      toast.success(`Journey overridden for ${assignment.employeeName}`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to execute manual journey override');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Manual Journey Override (HITL Layer)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Bypass autonomous routing logic and re-anchor onboarding state.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Employee & Current Journey Summary */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/30 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Employee:</span>
              <span className="font-semibold text-foreground">{assignment.employeeName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Journey:</span>
              <span className="font-medium text-foreground">{assignment.currentJourneyTitle}</span>
            </div>
            {assignment.department && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department:</span>
                <span className="text-foreground">{assignment.department}</span>
              </div>
            )}
          </div>

          {/* Target Journey Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="target-journey" className="text-xs font-semibold text-foreground">
              Select Replacement Journey Template <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              options={journeys.map((j) => ({ label: j.title, value: j.id }))}
              value={selectedJourneyId}
              onChange={setSelectedJourneyId}
              placeholder="Search and choose journey template..."
            />
          </div>

          {/* Grandfather Artifacts Toggle (Prompt 04 Guardrail) */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border/70 bg-background/50">
            <input
              type="checkbox"
              id="grandfather"
              checked={grandfatherArtifacts}
              onChange={(e) => setGrandfatherArtifacts(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className="space-y-0.5">
              <label htmlFor="grandfather" className="text-xs font-medium text-foreground cursor-pointer">
                Grandfather Signed Documents & Completed Quizzes
              </label>
              <p className="text-[11px] text-muted-foreground">
                Preserves completed compliance signatures (SHA-256 hashes) and passed assessments from the previous journey without re-prompting.
              </p>
            </div>
          </div>

          {/* Mandatory Compliance Reason */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="override-reason" className="text-xs font-semibold text-foreground">
                Regulatory Audit Reason <span className="text-destructive">*</span>
              </Label>
              <span className="text-[10px] text-muted-foreground">Min 10 characters</span>
            </div>
            <textarea
              id="override-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Cross-department internal transfer to Tokyo Engineering branch requiring customized technical roadmap..."
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Warning Banner */}
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px]">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Executing this override cancels orphaned delayed jobs in the background queue and safely resets the Velocity Sentinel baseline date.
            </span>
          </div>

          {validationError && (
            <p className="text-xs text-destructive font-medium">{validationError}</p>
          )}

          <DialogFooter className="gap-2 pt-2 border-t border-border/60">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1 bg-primary text-primary-foreground">
              {isSubmitting ? 'Applying Override...' : 'Apply Manual Override'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
