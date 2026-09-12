import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  AlertTriangle,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '../Badge';
import { Progress } from '../Progress';
import { Card, CardContent } from '../Card';

export interface IJourneyStage {
  id: string;
  name: string;
  subtitle: string;
  targetDays: string;
  status: 'completed' | 'in_progress' | 'locked' | 'stalled';
  progressPercent: number;
  totalTasks: number;
  completedTasks: number;
  automatedTasks: number;
  gateRequired?: string;
  items: Array<{
    id: string;
    title: string;
    type: 'document' | 'it_setup' | 'learning' | 'milestone' | 'buddy';
    isAutomated: boolean;
    isCompleted: boolean;
    autoVerificationRule?: string;
  }>;
}

interface JourneyPathVisualizerProps {
  journeyTitle?: string;
  caseState?: string;
  stages?: IJourneyStage[];
  onStageSelect?: (stage: IJourneyStage) => void;
}

const DEFAULT_STAGES: IJourneyStage[] = [
  {
    id: 'stage_preboarding',
    name: 'Pre-Boarding Gate',
    subtitle: 'Contract, ID & IT Dispatch',
    targetDays: 'Day -14 to Day 0',
    status: 'completed',
    progressPercent: 100,
    totalTasks: 4,
    completedTasks: 4,
    automatedTasks: 3,
    gateRequired: 'Legal E-Signature & IT Dispatch Callback',
    items: [
      { id: 'pb_1', title: 'Sign Non-Disclosure Agreement (NDA)', type: 'document', isAutomated: true, isCompleted: true, autoVerificationRule: 'SHA-256 E-Signature' },
      { id: 'pb_2', title: 'Upload Government Identity Verification', type: 'document', isAutomated: true, isCompleted: true, autoVerificationRule: 'OCR Auto-Match' },
      { id: 'pb_3', title: 'MDM Laptop Hardware Provisioning', type: 'it_setup', isAutomated: true, isCompleted: true, autoVerificationRule: 'Outbound MDM Webhook' },
      { id: 'pb_4', title: 'Emergency Contact & Payroll Setup', type: 'learning', isAutomated: false, isCompleted: true },
    ],
  },
  {
    id: 'stage_day1',
    name: 'Day 1: Orientation',
    subtitle: 'Access, Welcome & Security',
    targetDays: 'Day 1',
    status: 'in_progress',
    progressPercent: 75,
    totalTasks: 4,
    completedTasks: 3,
    automatedTasks: 2,
    gateRequired: 'Security Quiz Passing (>=80%)',
    items: [
      { id: 'd1_1', title: 'Corporate SSO & Passwordless Setup', type: 'it_setup', isAutomated: true, isCompleted: true, autoVerificationRule: 'SAML JIT Assertion' },
      { id: 'd1_2', title: 'Company Culture & Security Policy', type: 'learning', isAutomated: true, isCompleted: true, autoVerificationRule: 'LMS Passing Score' },
      { id: 'd1_3', title: 'First 1-on-1 with Assigned Buddy', type: 'buddy', isAutomated: false, isCompleted: true },
      { id: 'd1_4', title: 'Manager Desk & Equipment Sign-Off', type: 'it_setup', isAutomated: false, isCompleted: false },
    ],
  },
  {
    id: 'stage_week1',
    name: 'Week 1: Team Ramp',
    subtitle: 'Workflows & Tooling',
    targetDays: 'Days 2–7',
    status: 'locked',
    progressPercent: 0,
    totalTasks: 5,
    completedTasks: 0,
    automatedTasks: 3,
    gateRequired: 'Manager Sign-Off on Day 1 Checklist',
    items: [
      { id: 'w1_1', title: 'Engineering / Team Tooling Setup', type: 'it_setup', isAutomated: true, isCompleted: false },
      { id: 'w1_2', title: 'Team Architecture & Codebase Walkthrough', type: 'learning', isAutomated: false, isCompleted: false },
      { id: 'w1_3', title: 'Proactive Buddy Week 1 Culture Sync', type: 'buddy', isAutomated: true, isCompleted: false, autoVerificationRule: 'Calendar 1-on-1 Sentinel' },
      { id: 'w1_4', title: 'Initial Sprint Planning Attendance', type: 'learning', isAutomated: false, isCompleted: false },
    ],
  },
  {
    id: 'stage_month1',
    name: 'Day 30 Milestone',
    subtitle: 'Early Impact & Alignment',
    targetDays: 'Days 8–30',
    status: 'locked',
    progressPercent: 0,
    totalTasks: 3,
    completedTasks: 0,
    automatedTasks: 2,
    gateRequired: 'Day 30 Self-Evaluation & Manager Review',
    items: [
      { id: 'm1_1', title: 'Deliver First Production Task / Milestone', type: 'learning', isAutomated: false, isCompleted: false },
      { id: 'm1_2', title: 'Submit 30-Day Self-Reflection', type: 'milestone', isAutomated: true, isCompleted: false, autoVerificationRule: 'AI Reflection Briefing' },
      { id: 'm1_3', title: 'Manager Milestone Review & Rating', type: 'milestone', isAutomated: true, isCompleted: false, autoVerificationRule: '7-Day SLA Escalation' },
    ],
  },
  {
    id: 'stage_month3',
    name: 'Day 90 Ramp & Autonomy',
    subtitle: 'Full Ownership & Retention',
    targetDays: 'Days 31–90',
    status: 'locked',
    progressPercent: 0,
    totalTasks: 3,
    completedTasks: 0,
    automatedTasks: 2,
    gateRequired: 'Executive / Skip-Level Milestone Completion',
    items: [
      { id: 'm3_1', title: 'Independent Project Delivery', type: 'learning', isAutomated: false, isCompleted: false },
      { id: 'm3_2', title: '90-Day Comprehensive Review', type: 'milestone', isAutomated: true, isCompleted: false, autoVerificationRule: 'Autonomous Approval Engine' },
      { id: 'm3_3', title: 'Graduation to Peer Mentor Status', type: 'buddy', isAutomated: true, isCompleted: false },
    ],
  },
];

export const JourneyPathVisualizer: React.FC<JourneyPathVisualizerProps> = ({
  journeyTitle = 'Engineering Onboarding Journey (Tokyo & Global)',
  caseState = 'active',
  stages = DEFAULT_STAGES,
  onStageSelect,
}) => {
  const [activeStageId, setActiveStageId] = useState<string>(stages[1]?.id || stages[0]?.id);
  const selectedStage = stages.find((s) => s.id === activeStageId) || stages[0];

  const totalJourneyTasks = stages.reduce((acc, s) => acc + s.totalTasks, 0);
  const completedJourneyTasks = stages.reduce((acc, s) => acc + s.completedTasks, 0);
  const overallPercent = Math.round((completedJourneyTasks / Math.max(1, totalJourneyTasks)) * 100);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-primary/20 text-primary">
              <Zap className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-foreground tracking-tight">{journeyTitle}</h3>
            <Badge variant="outline" className="capitalize text-xs bg-background/80">
              State: {caseState}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Deterministic stage gates dynamically managed by the Intelligent Workflow Router & Outbox Sentinel.
          </p>
        </div>
        <div className="flex items-center gap-4 min-w-[220px]">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Journey Velocity</span>
              <span className="text-primary font-bold">{overallPercent}%</span>
            </div>
            <Progress value={overallPercent} className="h-2" />
          </div>
          <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
            {completedJourneyTasks}/{totalJourneyTasks} Tasks
          </Badge>
        </div>
      </div>

      {/* Multi-Stage Step Track */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {stages.map((stage, idx) => {
          const isSelected = stage.id === activeStageId;
          const isCompleted = stage.status === 'completed';
          const isInProgress = stage.status === 'in_progress';
          const isLocked = stage.status === 'locked';
          const isStalled = stage.status === 'stalled';

          return (
            <button
              key={stage.id}
              onClick={() => {
                setActiveStageId(stage.id);
                onStageSelect?.(stage);
              }}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden group ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20'
                  : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Stage {idx + 1}
                </span>
                {isCompleted && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {isInProgress && (
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                  </span>
                )}
                {isLocked && <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />}
                {isStalled && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              </div>

              <h4 className="font-semibold text-xs text-foreground truncate">{stage.name}</h4>
              <p className="text-[11px] text-muted-foreground truncate mb-2">{stage.targetDays}</p>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{stage.completedTasks}/{stage.totalTasks} items</span>
                  <span className="font-medium text-foreground">{stage.progressPercent}%</span>
                </div>
                <Progress
                  value={stage.progressPercent}
                  className={`h-1.5 ${isCompleted ? '[&>div]:bg-emerald-500' : ''}`}
                />
              </div>

              {stage.automatedTasks > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1 text-[10px] text-primary/80 font-medium">
                  <ShieldCheck className="h-3 w-3" />
                  <span>{stage.automatedTasks} auto-verified</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detailed Stage Drawer / Card */}
      {selectedStage && (
        <Card className="border-border/80 bg-card shadow-sm">
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-foreground">{selectedStage.name}</h4>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      selectedStage.status === 'completed'
                        ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                        : selectedStage.status === 'in_progress'
                        ? 'border-primary/30 text-primary bg-primary/10'
                        : 'border-muted text-muted-foreground'
                    }`}
                  >
                    {selectedStage.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedStage.subtitle} • {selectedStage.targetDays}</p>
              </div>
              {selectedStage.gateRequired && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>Gate Requirement: <strong>{selectedStage.gateRequired}</strong></span>
                </div>
              )}
            </div>

            {/* Checklist of Stage Items */}
            <div className="space-y-2">
              {selectedStage.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-xs ${
                        item.isCompleted
                          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                          : 'border border-border text-muted-foreground'
                      }`}
                    >
                      {item.isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${item.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">
                          {item.type.replace('_', ' ')}
                        </span>
                        {item.autoVerificationRule && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
                            <ShieldCheck className="h-3 w-3" />
                            {item.autoVerificationRule}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={item.isCompleted ? 'default' : 'secondary'} className="text-[10px]">
                    {item.isCompleted ? 'Verified' : 'Pending Action'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
