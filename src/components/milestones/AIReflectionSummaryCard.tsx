import React from 'react';
import {
  Sparkles,
  ThumbsUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '../Badge';
import { Button } from '../Button';

export interface IAIReflectionSummary {
  summary?: string;
  keyAchievements?: string[];
  sentiment?: 'positive' | 'neutral' | 'concerned';
  flaggedBlockers?: string[];
  recommendedRating?: number;
}

interface AIReflectionSummaryCardProps {
  aiSummary?: IAIReflectionSummary;
  employeeName?: string;
  employeeRating?: number;
  onQuickApprove?: () => void;
}

export const AIReflectionSummaryCard: React.FC<AIReflectionSummaryCardProps> = ({
  aiSummary,
  employeeName = 'Employee',
  employeeRating = 5,
  onQuickApprove,
}) => {
  if (!aiSummary) {
    return null;
  }

  const achievements = aiSummary.keyAchievements || [
    'Completed core technical onboarding and environment setups ahead of schedule',
    'Demonstrated high self-efficacy with strong team communication in initial sprint',
  ];

  const blockers = aiSummary.flaggedBlockers || [];
  const sentiment = aiSummary.sentiment || (employeeRating >= 4 ? 'positive' : 'neutral');

  return (
    <div className="p-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              AI Reflection Briefing
              <Badge variant="outline" className="text-[9px] py-0 border-primary/30 text-primary font-mono">
                GPT-4o / Claude
              </Badge>
            </h5>
            <p className="text-[11px] text-muted-foreground">
              Autonomous reflection synthesis for {employeeName} to fast-track manager sign-off.
            </p>
          </div>
        </div>

        <Badge
          className={`text-[10px] capitalize ${
            sentiment === 'positive'
              ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
              : sentiment === 'concerned'
              ? 'bg-destructive/20 text-destructive border-destructive/30'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {sentiment} Sentiment
        </Badge>
      </div>

      {aiSummary.summary && (
        <p className="text-xs text-foreground italic bg-background/60 p-2.5 rounded-lg border border-border/60">
          "{aiSummary.summary}"
        </p>
      )}

      <div className="space-y-1.5 text-xs">
        <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
          Key Highlights & Achievements:
        </p>
        <ul className="space-y-1">
          {achievements.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {blockers.length > 0 && (
        <div className="space-y-1.5 text-xs pt-1 border-t border-border/50">
          <p className="font-semibold text-amber-500 text-[11px] uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Flagged Blockers:
          </p>
          <ul className="space-y-1 text-muted-foreground">
            {blockers.map((b, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {onQuickApprove && (
        <div className="flex items-center justify-end pt-2 border-t border-border/60">
          <Button
            size="sm"
            onClick={onQuickApprove}
            className="text-xs h-7 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <ThumbsUp className="h-3 w-3" /> 1-Click Fast-Track Sign-Off
          </Button>
        </div>
      )}
    </div>
  );
};
