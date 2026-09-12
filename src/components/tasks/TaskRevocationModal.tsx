import React, { useState } from 'react';
import {
  RotateCcw
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
import { toast } from 'sonner';

interface TaskRevocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: {
    id: string;
    title: string;
    status: string;
    assignedToName?: string;
  } | null;
  onConfirmRevocation: (taskId: string, reason: string, newStatus: 'revision_requested' | 'in_progress') => Promise<void>;
}

export const TaskRevocationModal: React.FC<TaskRevocationModalProps> = ({
  isOpen,
  onClose,
  task,
  onConfirmRevocation,
}) => {
  const [reason, setReason] = useState('');
  const [targetStatus, setTargetStatus] = useState<'revision_requested' | 'in_progress'>('revision_requested');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  if (!task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!reason.trim() || reason.trim().length < 5) {
      setValidationError('Please provide a specific audit reason for revoking verification.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmRevocation(task.id, reason.trim(), targetStatus);
      toast.success(`Verification revoked for task "${task.title}"`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke task verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Revoke Task Verification (HITL Guardrail)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Override autonomous verification if manual quality review uncovers defects.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 rounded-lg border border-border/70 bg-muted/30 text-xs space-y-1">
            <p className="font-semibold text-foreground truncate">{task.title}</p>
            <p className="text-muted-foreground">Current Status: <span className="text-emerald-500 font-medium capitalize">{task.status}</span></p>
            {task.assignedToName && (
              <p className="text-muted-foreground">Assigned: {task.assignedToName}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Target Status After Revocation</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetStatus('revision_requested')}
                className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                  targetStatus === 'revision_requested'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-background text-foreground'
                }`}
              >
                Revision Requested
              </button>
              <button
                type="button"
                onClick={() => setTargetStatus('in_progress')}
                className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                  targetStatus === 'in_progress'
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-background text-foreground'
                }`}
              >
                In Progress (Reset)
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="revoke-reason" className="text-xs font-semibold text-foreground">
              Audit Note & Reason <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="revoke-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Code review PR showed missing unit tests; requires developer revision before sign-off..."
              className="w-full text-xs p-2.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {validationError && (
            <p className="text-xs text-destructive font-medium">{validationError}</p>
          )}

          <DialogFooter className="gap-2 pt-2 border-t border-border/60">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} variant="destructive">
              {isSubmitting ? 'Revoking...' : 'Confirm Revocation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
