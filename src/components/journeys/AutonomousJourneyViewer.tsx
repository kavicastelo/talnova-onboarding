import React from 'react';
import {
  Sparkles,
  GitMerge,
  Sliders,
  FileText,
  Building,
  MapPin
} from 'lucide-react';
import { Card, CardContent } from '../Card';
import { Badge } from '../Badge';
import { Button } from '../Button';

export interface IRuleAttribution {
  matchedRuleId: string;
  matchedRuleName: string;
  priorityIndex: number;
  specificityScore: number;
  conditionMatches: Array<{
    field: string;
    operator: string;
    value: string;
    matched: boolean;
  }>;
  confidenceScore: number; // 0 - 100
  arbitrationReason?: string;
  source: 'hris' | 'sso' | 'invite' | 'manual_override';
  assignedAt: string;
}

export interface IAutonomousAssignmentItem {
  id: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  location: string;
  journeyTitle: string;
  journeyId: string;
  caseState: 'created' | 'resolving' | 'provisioning' | 'ready' | 'active' | 'paused' | 'cancelled';
  attribution: IRuleAttribution;
}

interface AutonomousJourneyViewerProps {
  assignments?: IAutonomousAssignmentItem[];
  onOpenOverride?: (assignment: IAutonomousAssignmentItem) => void;
  onViewPath?: (assignment: IAutonomousAssignmentItem) => void;
}

export const AutonomousJourneyViewer: React.FC<AutonomousJourneyViewerProps> = ({
  assignments = [],
  onOpenOverride,
  onViewPath,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Autonomous Journey Routing & Conflict Arbitration
          </h3>
          <p className="text-xs text-muted-foreground">
            Deterministic rule evaluations with specificity scoring and automatic UQ-06 tie-breaking.
          </p>
        </div>
        <Badge variant="outline" className="self-start sm:self-auto text-xs bg-primary/5 text-primary border-primary/20">
          Deterministic Engine Active
        </Badge>
      </div>

      {assignments.length === 0 ? (
        <Card className="border-dashed border-border p-8 text-center bg-card">
          <GitMerge className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-xs text-muted-foreground font-medium">
            No autonomous assignments currently queued for inspection.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {assignments.map((item) => {
            const isHighConfidence = item.attribution.confidenceScore >= 90;
            const isModerateConfidence =
              item.attribution.confidenceScore >= 70 && item.attribution.confidenceScore < 90;

            return (
              <Card
                key={item.id}
                className="border-border/70 hover:border-primary/40 transition-all duration-150 bg-card shadow-sm"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Employee & Journey Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{item.employeeName}</span>
                        <span className="text-xs text-muted-foreground">({item.employeeEmail})</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase font-mono ${
                            item.caseState === 'active'
                              ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
                              : item.caseState === 'paused'
                              ? 'border-amber-500/30 text-amber-500 bg-amber-500/10'
                              : 'border-primary/30 text-primary bg-primary/10'
                          }`}
                        >
                          Case: {item.caseState}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] capitalize">
                          Source: {item.attribution.source}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {item.department}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.location}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3 text-primary" />
                          Target: {item.journeyTitle}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Rule Attribution & Confidence */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-muted/40 p-2.5 rounded-lg border border-border/60">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-foreground">
                            Rule: {item.attribution.matchedRuleName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            (P:{item.attribution.priorityIndex} | Spec:{item.attribution.specificityScore})
                          </span>
                        </div>
                        {item.attribution.arbitrationReason && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                            {item.attribution.arbitrationReason}
                          </p>
                        )}
                      </div>

                      <Badge
                        className={`text-xs px-2 py-0.5 whitespace-nowrap ${
                          isHighConfidence
                            ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                            : isModerateConfidence
                            ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                            : 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                        }`}
                      >
                        {item.attribution.confidenceScore}% Confidence
                      </Badge>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                      {onViewPath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewPath(item)}
                          className="text-xs h-8"
                        >
                          View Path
                        </Button>
                      )}
                      {onOpenOverride && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenOverride(item)}
                          className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10 gap-1"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          Manual Override
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
