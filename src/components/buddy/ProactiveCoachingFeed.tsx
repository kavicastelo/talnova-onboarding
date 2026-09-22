import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  HeartHandshake
} from 'lucide-react';
import { Card, CardContent } from '../Card';
import { Button } from '../Button';
import { Badge } from '../Badge';

export interface ICoachingPrompt {
  id: string;
  week: number;
  stage: 'week_1' | 'week_2' | 'week_4';
  title: string;
  suggestedAgenda: string[];
  menteeName: string;
  isCompleted: boolean;
  scheduledAt?: string;
}

interface ProactiveCoachingFeedProps {
  prompts?: ICoachingPrompt[];
  onLogCheckin?: (prompt: ICoachingPrompt) => void;
  onScheduleSync?: (prompt: ICoachingPrompt) => void;
}

const DEFAULT_PROMPTS: ICoachingPrompt[] = [
  {
    id: 'coach_w1',
    week: 1,
    stage: 'week_1',
    title: 'Week 1: Cultural Warmth & Tooling Q&A',
    menteeName: 'Alex Rivera',
    suggestedAgenda: [
      'Favorite local lunch spots & coffee rituals',
      'Team communication norms (Slack vs Email vs PRs)',
      'Clarifying Day 1 setup bottlenecks and IT logins',
    ],
    isCompleted: true,
  },
  {
    id: 'coach_w2',
    week: 2,
    stage: 'week_2',
    title: 'Week 2: Social Integration & First Deliverable',
    menteeName: 'Alex Rivera',
    suggestedAgenda: [
      'Review initial sprint tasks or starter tickets',
      'Introduce to cross-functional stakeholders',
      'Check in on psychological safety and pace',
    ],
    isCompleted: false,
    scheduledAt: 'Thursday, 2:00 PM',
  },
  {
    id: 'coach_w4',
    week: 4,
    stage: 'week_4',
    title: 'Week 4: 30-Day Milestone Preparation',
    menteeName: 'Alex Rivera',
    suggestedAgenda: [
      'Pre-briefing for Day 30 self-reflection check-in',
      'Celebrate early small wins & achievements',
      'Identify any unresolved blockers or training gaps',
    ],
    isCompleted: false,
  },
];

export const ProactiveCoachingFeed: React.FC<ProactiveCoachingFeedProps> = ({
  prompts = DEFAULT_PROMPTS,
  onLogCheckin,
  onScheduleSync,
}) => {
  const { t } = useTranslation('buddy');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <HeartHandshake className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">
              {t('coachingFeed.title', { defaultValue: 'Proactive Buddy Coaching Sentinel' })}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t('coachingFeed.desc', { defaultValue: 'Autonomous weekly conversational prompts and suggested meeting agendas.' })}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
          {t('coachingFeed.activeBadge', { defaultValue: 'Weekly Sentinel Active' })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {prompts.map((p) => (
          <Card
            key={p.id}
            className={`border transition-colors ${
              p.isCompleted
                ? 'border-border/60 bg-card/40 opacity-80'
                : 'border-primary/30 bg-primary/5 shadow-sm'
            }`}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={p.isCompleted ? 'secondary' : 'default'}
                    className="text-[10px] uppercase font-mono"
                  >
                    {t('coachingFeed.weekBadge', { week: p.week, defaultValue: `Week ${p.week}` })}
                  </Badge>
                  <h5 className="font-semibold text-xs text-foreground">{p.title}</h5>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {p.isCompleted ? (
                    <span className="flex items-center gap-1 text-emerald-500 font-medium text-[11px]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t('coachingFeed.completed', { defaultValue: 'Check-in Completed' })}
                    </span>
                  ) : p.scheduledAt ? (
                    <span className="flex items-center gap-1 text-primary font-medium text-[11px]">
                      <Clock className="h-3.5 w-3.5" /> {t('coachingFeed.scheduled', { time: p.scheduledAt, defaultValue: `Scheduled: ${p.scheduledAt}` })}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-500 font-medium text-[11px]">
                      <Clock className="h-3.5 w-3.5" /> {t('coachingFeed.actionRecommended', { defaultValue: 'Action Recommended' })}
                    </span>
                  )}
                </div>
              </div>

              {/* Suggested Agenda Items */}
              <div className="bg-background/80 rounded-lg p-3 border border-border/60 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" /> {t('coachingFeed.suggestedAgenda', { name: p.menteeName, defaultValue: `Suggested 15-Minute Agenda for ${p.menteeName}:` })}
                </p>
                <ul className="space-y-1 text-xs text-foreground">
                  {p.suggestedAgenda.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary font-bold text-[10px] mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1">
                {onScheduleSync && !p.isCompleted && !p.scheduledAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onScheduleSync(p)}
                    className="text-xs h-7 gap-1"
                  >
                    <Calendar className="h-3 w-3" /> {t('coachingFeed.autoSchedule', { defaultValue: 'Auto-Schedule 1-on-1' })}
                  </Button>
                )}
                {onLogCheckin && !p.isCompleted && (
                  <Button
                    size="sm"
                    onClick={() => onLogCheckin(p)}
                    className="text-xs h-7 gap-1 bg-primary text-primary-foreground"
                  >
                    <MessageSquare className="h-3 w-3" /> {t('coachingFeed.logCheckin', { defaultValue: 'Log 30-Sec Check-in' })}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
