import React, { useState } from 'react';
import {
  Sliders,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Loader2,
  Building2,
  UserCheck,
  ShieldAlert
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
      <DialogContent className="max-w-xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                Manual Journey Override
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                  HITL Guardrail
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Bypass autonomous routing logic, replace assigned roadmap, and re-anchor onboarding state.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogBody className="space-y-4">
            {/* Employee & Current Journey Summary */}
            <div className="p-4 rounded-xl border border-border/70 bg-muted/30 space-y-2.5 text-xs">
              <div className="flex items-center justify-between font-medium text-muted-foreground pb-2 border-b border-border/40">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <UserCheck className="h-3.5 w-3.5 text-primary" /> Target Employee State
                </span>
                {assignment.department && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Building2 className="h-3 w-3" /> {assignment.department}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Employee</span>
                  <span className="font-semibold text-foreground text-sm">{assignment.employeeName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Active Journey</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400 text-sm flex items-center gap-1 mt-0.5">
                    <Compass className="h-3.5 w-3.5" />
                    {assignment.currentJourneyTitle}
                  </span>
                </div>
              </div>
            </div>

            {/* Target Journey Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="target-journey" className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Select Replacement Journey Template <span className="text-destructive">*</span></span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  {journeys.length} templates
                </span>
              </Label>
              <SearchableSelect
                options={journeys.map((j) => ({ label: j.title, value: j.id }))}
                value={selectedJourneyId}
                onChange={(val) => {
                  setSelectedJourneyId(val);
                  setValidationError('');
                }}
                placeholder="Search and choose journey template..."
                searchPlaceholder="Search journey template title..."
              />
            </div>

            {/* Grandfather Artifacts Toggle */}
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/70 bg-card">
              <input
                type="checkbox"
                id="grandfather-artifacts"
                checked={grandfatherArtifacts}
                onChange={(e) => setGrandfatherArtifacts(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <div className="space-y-0.5">
                <label htmlFor="grandfather-artifacts" className="text-xs font-semibold text-foreground cursor-pointer block">
                  Grandfather Signed Documents & Completed Quizzes
                </label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Preserves completed compliance signatures (SHA-256 hashes) and passed assessments from the previous journey without prompting the employee again.
                </p>
              </div>
            </div>

            {/* Mandatory Compliance Reason */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="override-reason" className="text-xs font-semibold text-foreground">
                  Regulatory Audit Justification <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] font-mono">
                  {reason.trim().length >= 10 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{reason.trim().length} chars (Ready)</span>
                  ) : (
                    <span className="text-muted-foreground">{reason.trim().length}/10 min chars</span>
                  )}
                </span>
              </div>
              <textarea
                id="override-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setValidationError('');
                }}
                placeholder="e.g. Cross-department internal transfer to Engineering branch requiring customized technical roadmap and local statutory verification..."
                className="w-full text-xs p-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
              />
            </div>

            {/* Warning Banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                Executing this manual override immediately recalibrates automated milestones and triggers the Sentinel baseline date re-calculation.
              </span>
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
              disabled={isSubmitting || !selectedJourneyId || reason.trim().length < 10}
              className="bg-primary text-primary-foreground font-semibold gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying Override...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Apply Manual Override
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
