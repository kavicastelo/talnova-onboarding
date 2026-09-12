import React from 'react';
import {
  Users,
  MapPin,
  Languages,
  BatteryCharging,
  Cpu,
  Sparkles
} from 'lucide-react';
import { Badge } from '../Badge';
import { Progress } from '../Progress';
import { IBuddyCompatibilityCriteria } from '../../services/buddy-matching.service';

interface CompatibilityRadarWidgetProps {
  score: number; // 0.0 - 1.0
  scorePercent: number; // 0 - 100
  criteria: IBuddyCompatibilityCriteria;
  buddyName?: string;
  menteeName?: string;
  reasons?: string[];
}

export const CompatibilityRadarWidget: React.FC<CompatibilityRadarWidgetProps> = ({
  scorePercent,
  criteria,
  buddyName = 'Mentor Candidate',
  menteeName = 'New Hire',
  reasons = [],
}) => {
  const getScoreColor = (val: number) => {
    if (val >= 0.8) return 'text-emerald-500';
    if (val >= 0.5) return 'text-blue-500';
    return 'text-amber-500';
  };

  const getProgressColor = (val: number) => {
    if (val >= 0.8) return '[&>div]:bg-emerald-500';
    if (val >= 0.5) return '[&>div]:bg-blue-500';
    return '[&>div]:bg-amber-500';
  };

  const factors = [
    {
      name: 'Department Alignment',
      weight: '35%',
      score: criteria.departmentScore,
      icon: Users,
      description: 'Domain & organizational cluster proximity',
    },
    {
      name: 'Location & Timezone',
      weight: '25%',
      score: criteria.locationScore,
      icon: MapPin,
      description: 'Same office or <= 2 hrs timezone delta',
    },
    {
      name: 'Working Language',
      weight: '20%',
      score: criteria.languageScore,
      icon: Languages,
      description: 'Shared primary or working language',
    },
    {
      name: 'Mentee Capacity',
      weight: '15%',
      score: criteria.capacityScore,
      icon: BatteryCharging,
      description: 'Available mentor bandwidth slots',
    },
    {
      name: 'Skills Overlap',
      weight: '5%',
      score: criteria.skillsScore,
      icon: Cpu,
      description: 'Jaccard overlap of role & technical proficiencies',
    },
  ];

  return (
    <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-4">
      {/* Header Match Pill */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              Multi-Factor Compatibility Analysis
            </h4>
            <p className="text-[11px] text-muted-foreground">
              {buddyName} paired with {menteeName}
            </p>
          </div>
        </div>
        <div className="text-right">
          <Badge
            className={`text-xs px-2.5 py-0.5 font-bold ${
              scorePercent >= 85
                ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                : scorePercent >= 70
                ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
            }`}
          >
            {scorePercent}% Match
          </Badge>
        </div>
      </div>

      {/* 5-Factor Progress Bars */}
      <div className="space-y-2.5 pt-1">
        {factors.map((f) => {
          const Icon = f.icon;
          const percent = Math.round(f.score * 100);
          return (
            <div key={f.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {f.name}
                  <span className="text-[10px] text-muted-foreground font-mono">({f.weight})</span>
                </span>
                <span className={`font-mono text-xs font-bold ${getScoreColor(f.score)}`}>
                  {percent}%
                </span>
              </div>
              <Progress value={percent} className={`h-1.5 ${getProgressColor(f.score)}`} />
            </div>
          );
        })}
      </div>

      {/* Key Qualitative Highlights */}
      {reasons.length > 0 && (
        <div className="pt-2 border-t border-border/60 flex flex-wrap gap-1.5">
          {reasons.map((r, i) => (
            <span
              key={i}
              className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/40 font-medium"
            >
              ✓ {r}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
