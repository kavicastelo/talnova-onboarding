import React from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Bell,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { Badge } from '../Badge';

export interface IMilestoneSLA {
  reviewDeadline?: string | Date;
  reminderSentCount?: number;
  autoApprovalEligible?: boolean;
  escalationState?: 'normal' | 'reminded' | 'escalated' | 'auto_approved';
  blockersReported?: boolean;
}

interface MilestoneEscalationLadderProps {
  sla?: IMilestoneSLA;
  status: string;
  submittedAt?: string | Date;
  onPauseSla?: () => void;
  onSkipLevelDelegate?: () => void;
}

export const MilestoneEscalationLadder: React.FC<MilestoneEscalationLadderProps> = ({
  sla,
  status,
  submittedAt: _submittedAt,
  onPauseSla: _onPauseSla,
  onSkipLevelDelegate: _onSkipLevelDelegate,
}) => {
  if (!sla || status === 'approved' || status === 'completed') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>Evaluation Concluded & Approved</span>
      </div>
    );
  }

  const deadline = sla.reviewDeadline ? new Date(sla.reviewDeadline) : null;
  const now = new Date();
  const msRemaining = deadline ? deadline.getTime() - now.getTime() : 0;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const isOverdue = msRemaining <= 0;

  const escalationSteps = [
    {
      step: 1,
      day: 'Day 3',
      name: 'Manager Reminder',
      active: (sla.reminderSentCount || 0) >= 1,
      icon: Bell,
    },
    {
      step: 2,
      day: 'Day 5',
      name: 'Urgent Alert',
      active: (sla.reminderSentCount || 0) >= 2 || sla.escalationState === 'escalated',
      icon: AlertTriangle,
    },
    {
      step: 3,
      day: 'Day 7',
      name: sla.autoApprovalEligible ? 'Autonomous Approval' : 'Skip-Level Delegation',
      active: isOverdue || sla.escalationState === 'auto_approved',
      icon: sla.autoApprovalEligible ? ShieldCheck : UserCheck,
    },
  ];

  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-card/60 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-foreground">7-Day Manager SLA Escalation Ladder</h5>
            <p className="text-[11px] text-muted-foreground">
              Autonomous escalation pipeline preventing milestone deadlocks.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {sla.autoApprovalEligible ? (
            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">
              Auto-Approval Eligible (&ge; 4/5 Rating)
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-[10px]">
              Requires Manager / Skip-Level Sign-Off
            </Badge>
          )}
          <Badge
            variant="secondary"
            className={`text-[10px] font-mono ${
              isOverdue ? 'bg-destructive/20 text-destructive border-destructive/30' : ''
            }`}
          >
            {isOverdue ? 'SLA Breached' : `${daysRemaining}d SLA Window Remaining`}
          </Badge>
        </div>
      </div>

      {/* Ladder Steps Bar */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {escalationSteps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.step}
              className={`p-2 rounded-lg border text-center transition-colors ${
                step.active
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border/60 bg-muted/30 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold mb-0.5">
                <Icon className={`h-3 w-3 ${step.active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{step.day}</span>
              </div>
              <p className="text-[10px] truncate">{step.name}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
