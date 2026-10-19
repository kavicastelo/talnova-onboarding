import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  MessageSquare,
  Pause,
  Play,
  XCircle,
  Copy,
  RefreshCw,
  Clock,
  CheckCircle2,
  Send,
  MousePointerClick,
  Eye,
  MessageSquareReply,
  TrendingDown,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../Button';
import { Badge } from '../../../Badge';
import {
  salesCampaignService,
  CampaignItem,
} from '../../../../services/salesCampaign.service';
import { CampaignFunnelChart } from './CampaignFunnelChart';
import { CampaignRecipientTable } from './CampaignRecipientTable';

interface CampaignDeliveryMonitorProps {
  initialCampaign: CampaignItem;
  onRefresh?: () => Promise<void>;
}

export const CampaignDeliveryMonitor: React.FC<CampaignDeliveryMonitorProps> = ({
  initialCampaign,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignItem>(initialCampaign);
  const [isActing, setIsActing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync state if initialCampaign changes
  useEffect(() => {
    setCampaign(initialCampaign);
  }, [initialCampaign]);

  // Live Auto-Polling every 5 seconds when in 'sending' or 'queued' state
  useEffect(() => {
    const isLive = campaign.status === 'sending' || campaign.status === 'queued';

    if (isLive) {
      pollingTimerRef.current = setInterval(async () => {
        try {
          const updated = await salesCampaignService.getCampaignById(campaign._id);
          if (updated) {
            setCampaign(updated);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 5000);
    } else {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    }

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [campaign.status, campaign._id]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const updated = await salesCampaignService.getCampaignById(campaign._id);
      if (updated) {
        setCampaign(updated);
      }
      if (onRefresh) {
        await onRefresh();
      }
      toast.success('Campaign metrics updated.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh metrics.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePause = async () => {
    setIsActing(true);
    try {
      const res = await salesCampaignService.pauseCampaign(campaign._id);
      setCampaign(res.campaign);
      toast.success('Campaign paused. In-flight dispatches halted.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to pause campaign.');
    } finally {
      setIsActing(false);
    }
  };

  const handleResume = async () => {
    setIsActing(true);
    try {
      const res = await salesCampaignService.resumeCampaign(campaign._id);
      setCampaign(res.campaign);
      toast.success('Campaign resumed. Dispatch queue reactivated.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to resume campaign.');
    } finally {
      setIsActing(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this campaign? This action cannot be reversed.')) {
      return;
    }

    setIsActing(true);
    try {
      const res = await salesCampaignService.cancelCampaign(campaign._id);
      setCampaign(res.campaign);
      toast.success('Campaign permanently cancelled.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to cancel campaign.');
    } finally {
      setIsActing(false);
    }
  };

  const handleClone = async () => {
    setIsActing(true);
    try {
      const cloned = await salesCampaignService.cloneCampaign(campaign._id, {
        name: `${campaign.name} (Copy)`,
        includeRecipients: true,
      });
      toast.success('Campaign cloned successfully.');
      navigate(`/super-admin/sales/campaigns/new?id=${cloned._id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to clone campaign.');
    } finally {
      setIsActing(false);
    }
  };

  // Export full Campaign Summary Report
  const handleExportCampaignReport = () => {
    const s = campaign.stats || {
      totalRecipients: 0,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      clickedCount: 0,
      bouncedCount: 0,
      repliedCount: 0,
      failedCount: 0,
    };

    const lines = [
      'Campaign Performance Report',
      `Campaign Name,"${campaign.name}"`,
      `Channel,${campaign.channel}`,
      `Status,${campaign.status}`,
      `Created At,${new Date(campaign.createdAt).toISOString()}`,
      `Total Audience,${s.totalRecipients}`,
      `Sent Count,${s.sentCount}`,
      `Delivered Count,${s.deliveredCount}`,
      `Delivery Rate,${s.sentCount > 0 ? ((s.deliveredCount / s.sentCount) * 100).toFixed(1) : 0}%`,
      `Opened Count,${s.openedCount}`,
      `Open Rate,${s.deliveredCount > 0 ? ((s.openedCount / s.deliveredCount) * 100).toFixed(1) : 0}%`,
      `Clicked Count,${s.clickedCount}`,
      `CTR,${s.openedCount > 0 ? ((s.clickedCount / s.openedCount) * 100).toFixed(1) : 0}%`,
      `Replied Count,${s.repliedCount}`,
      `Reply Rate,${s.deliveredCount > 0 ? ((s.repliedCount / s.deliveredCount) * 100).toFixed(1) : 0}%`,
      `Bounced Count,${s.bouncedCount}`,
      `Bounce Rate,${s.sentCount > 0 ? ((s.bouncedCount / s.sentCount) * 100).toFixed(1) : 0}%`,
      `Failed Count,${s.failedCount}`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${campaign.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_summary.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Strict Zero-Mock calculations
  const stats = campaign.stats || {
    totalRecipients: 0,
    sentCount: 0,
    deliveredCount: 0,
    openedCount: 0,
    clickedCount: 0,
    bouncedCount: 0,
    repliedCount: 0,
    failedCount: 0,
  };

  const sent = stats.sentCount || 0;
  const delivered = stats.deliveredCount || 0;
  const opened = stats.openedCount || 0;
  const clicked = stats.clickedCount || 0;
  const replied = stats.repliedCount || 0;
  const bounced = stats.bouncedCount || 0;
  const total = stats.totalRecipients || campaign.recipients?.length || 0;

  const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0;
  const openRate = delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0;
  const clickRate = opened > 0 ? Math.round((clicked / opened) * 1000) / 10 : 0;
  const replyRate = delivered > 0 ? Math.round((replied / delivered) * 1000) / 10 : 0;
  const bounceRate = sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0;

  const progressPct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sending':
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1.5 py-1 px-3">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> In Progress (Sending)
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1 px-3">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1.5 py-1 px-3">
            <Pause className="w-3.5 h-3.5" /> Paused
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="gap-1.5 py-1 px-3">
            <XCircle className="w-3.5 h-3.5" /> Cancelled
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="outline" className="text-primary border-primary gap-1.5 py-1 px-3">
            <Clock className="w-3.5 h-3.5" /> Scheduled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1.5 py-1 px-3 capitalize">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header & Live Controls Strip */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {campaign.name}
              </h2>
              {getStatusBadge(campaign.status)}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                {campaign.channel === 'email' ? (
                  <Mail className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span className="font-semibold text-foreground uppercase">{campaign.channel}</span>
              </span>

              <span>•</span>
              <span>{`Created ${new Date(campaign.createdAt).toLocaleDateString()}`}</span>

              {campaign.startedAt && (
                <>
                  <span>•</span>
                  <span>{`Started ${new Date(campaign.startedAt).toLocaleTimeString()}`}</span>
                </>
              )}

              {campaign.completedAt && (
                <>
                  <span>•</span>
                  <span>{`Completed ${new Date(campaign.completedAt).toLocaleTimeString()}`}</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            {campaign.status === 'sending' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                disabled={isActing}
                className="gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-700"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </Button>
            )}

            {campaign.status === 'paused' && (
              <Button
                variant="default"
                size="sm"
                onClick={handleResume}
                disabled={isActing}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </Button>
            )}

            {(campaign.status === 'sending' || campaign.status === 'paused' || campaign.status === 'scheduled') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={isActing}
                className="gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={handleClone}
              disabled={isActing}
              className="gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Clone</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCampaignReport}
              className="gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </Button>
          </div>
        </div>

        {/* Progress Bar (Visible during execution) */}
        {(campaign.status === 'sending' || campaign.status === 'queued') && (
          <div className="space-y-1.5 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 text-primary animate-spin" /> Live Dispatching Progress
              </span>
              <span className="font-mono text-muted-foreground">
                {`${sent.toLocaleString()} of ${total.toLocaleString()} processed (${progressPct}%)`}
              </span>
            </div>
            <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. KPI Metrics Strip (Strict Zero-Mock from DB) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Sent & Delivery Rate */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Send className="w-3.5 h-3.5 text-blue-500" /> Sent &amp; Delivered
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <div className="text-2xl font-bold text-foreground" data-testid="kpi-delivered-count">
              {delivered.toLocaleString()}
            </div>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
              {`${deliveryRate}% rate`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {`${sent.toLocaleString()} total messages dispatched`}
          </p>
        </div>

        {/* Open Rate */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <Eye className="w-3.5 h-3.5 text-amber-500" />
            {campaign.channel === 'whatsapp' ? 'Read Receipts' : 'Unique Opens'}
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <div className="text-2xl font-bold text-foreground" data-testid="kpi-opened-count">
              {opened.toLocaleString()}
            </div>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono text-xs">
              {`${openRate}% rate`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Calculated over delivered messages
          </p>
        </div>

        {/* Click-Through Rate */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <MousePointerClick className="w-3.5 h-3.5 text-indigo-500" /> Link Clicks (CTR)
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <div className="text-2xl font-bold text-foreground" data-testid="kpi-clicked-count">
              {clicked.toLocaleString()}
            </div>
            <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-mono text-xs">
              {`${clickRate}% rate`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Calculated over opened messages
          </p>
        </div>

        {/* Reply Rate */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <MessageSquareReply className="w-3.5 h-3.5 text-purple-500" /> Inbound Replies
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <div className="text-2xl font-bold text-foreground" data-testid="kpi-replied-count">
              {replied.toLocaleString()}
            </div>
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono text-xs">
              {`${replyRate}% rate`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Direct responses captured
          </p>
        </div>

        {/* Bounce Rate */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
            <TrendingDown className="w-3.5 h-3.5 text-destructive" /> Bounce &amp; Failure
          </span>
          <div className="flex items-baseline justify-between pt-1">
            <div className="text-2xl font-bold text-destructive" data-testid="kpi-bounced-count">
              {bounced.toLocaleString()}
            </div>
            <Badge variant="destructive" className="font-mono text-xs">
              {`${bounceRate}% rate`}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Auto-suppressed from future outreach
          </p>
        </div>
      </div>

      {/* 3. Outreach Conversion Funnel Chart */}
      <CampaignFunnelChart stats={stats} channel={campaign.channel} />

      {/* 4. Recipient Delivery Log Table */}
      <CampaignRecipientTable
        recipients={campaign.recipients || []}
        channel={campaign.channel}
        campaignName={campaign.name}
      />
    </div>
  );
};

export default CampaignDeliveryMonitor;
