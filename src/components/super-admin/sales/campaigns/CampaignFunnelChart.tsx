import React from 'react';
import {
  Send,
  CheckCircle2,
  Eye,
  MousePointerClick,
  MessageSquareReply,
  ArrowDown,
  TrendingDown,
} from 'lucide-react';
import { Badge } from '../../../Badge';
import { CampaignStats } from '../../../../services/salesCampaign.service';

interface CampaignFunnelChartProps {
  stats: CampaignStats;
  channel: 'email' | 'whatsapp';
}

interface FunnelStep {
  id: string;
  name: string;
  count: number;
  icon: React.ElementType;
  barColor: string;
  textColor: string;
  rateFromPrevious: number;
  rateFromTotal: number;
  dropoffCount: number;
}

export const CampaignFunnelChart: React.FC<CampaignFunnelChartProps> = ({ stats, channel }) => {
  const sent = stats.sentCount || 0;
  const delivered = stats.deliveredCount || 0;
  const opened = stats.openedCount || 0;
  const clicked = stats.clickedCount || 0;
  const replied = stats.repliedCount || 0;

  const calculatePct = (num: number, denom: number) => {
    if (denom <= 0) return 0;
    return Math.min(100, Math.round((num / denom) * 1000) / 10);
  };

  const steps: FunnelStep[] = [
    {
      id: 'sent',
      name: 'Messages Sent',
      count: sent,
      icon: Send,
      barColor: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      rateFromPrevious: 100,
      rateFromTotal: 100,
      dropoffCount: 0,
    },
    {
      id: 'delivered',
      name: 'Delivered',
      count: delivered,
      icon: CheckCircle2,
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      rateFromPrevious: calculatePct(delivered, sent),
      rateFromTotal: calculatePct(delivered, sent),
      dropoffCount: Math.max(0, sent - delivered),
    },
    {
      id: 'opened',
      name: channel === 'whatsapp' ? 'Read Receipts' : 'Opened',
      count: opened,
      icon: Eye,
      barColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
      rateFromPrevious: calculatePct(opened, delivered),
      rateFromTotal: calculatePct(opened, sent),
      dropoffCount: Math.max(0, delivered - opened),
    },
    {
      id: 'clicked',
      name: 'Link Clicks',
      count: clicked,
      icon: MousePointerClick,
      barColor: 'bg-indigo-500',
      textColor: 'text-indigo-600 dark:text-indigo-400',
      rateFromPrevious: calculatePct(clicked, opened),
      rateFromTotal: calculatePct(clicked, sent),
      dropoffCount: Math.max(0, opened - clicked),
    },
    {
      id: 'replied',
      name: 'Inbound Replies',
      count: replied,
      icon: MessageSquareReply,
      barColor: 'bg-purple-500',
      textColor: 'text-purple-600 dark:text-purple-400',
      rateFromPrevious: calculatePct(replied, delivered),
      rateFromTotal: calculatePct(replied, sent),
      dropoffCount: 0,
    },
  ];

  const maxVal = Math.max(sent, 1);

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-base font-semibold text-foreground">
            Outreach Conversion Funnel
          </h4>
          <p className="text-xs text-muted-foreground">
            Stage-by-stage progression from dispatch through delivery, engagement, and replies.
          </p>
        </div>
        <Badge variant="outline" className="w-fit text-xs font-medium">
          {`Base: ${sent.toLocaleString()} Sent`}
        </Badge>
      </div>

      {sent === 0 ? (
        <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
          <TrendingDown className="w-8 h-8 text-muted-foreground/40" />
          <p>No messages have been dispatched yet for this campaign.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const barWidth = Math.max(6, Math.round((step.count / maxVal) * 100));

            return (
              <div key={step.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Icon className={`w-4 h-4 ${step.textColor}`} />
                    <span>{step.name}</span>
                    <span className="font-mono text-muted-foreground">
                      ({step.count.toLocaleString()})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {idx > 0 && (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {`${step.rateFromPrevious}% conv`}
                      </span>
                    )}
                    <Badge variant="secondary" className="text-[10px] font-mono py-0 px-1.5">
                      {`${step.rateFromTotal}% overall`}
                    </Badge>
                  </div>
                </div>

                {/* Progress bar container */}
                <div className="h-6 w-full bg-muted/50 rounded-lg overflow-hidden flex items-center p-1 border border-border/50">
                  <div
                    className={`h-full rounded-md transition-all duration-500 ${step.barColor}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Dropoff connector indicator */}
                {idx < steps.length - 1 && step.dropoffCount > 0 && (
                  <div className="pl-6 py-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
                    <ArrowDown className="w-3 h-3 text-muted-foreground/50" />
                    <span>{`${step.dropoffCount.toLocaleString()} dropped off`}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CampaignFunnelChart;
