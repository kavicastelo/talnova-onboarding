import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone,
  Plus,
  Search,
  Mail,
  MessageSquare,
  BarChart2,
  CheckCircle2,
  Clock,
  Pause,
  XCircle,
  Copy,
  TrendingUp,
  RefreshCw,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Badge } from '../../../components/Badge';
import {
  salesCampaignService,
  CampaignItem,
} from '../../../services/salesCampaign.service';

export const SuperAdminCampaigns: React.FC = () => {
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'email' | 'whatsapp'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await salesCampaignService.getCampaigns({
        search: search.trim() || undefined,
        channel: channelFilter !== 'all' ? channelFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 50,
      });
      setCampaigns(res.items || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [channelFilter, statusFilter]);

  const handleClone = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const cloned = await salesCampaignService.cloneCampaign(id, { includeRecipients: true });
      toast.success('Campaign cloned.');
      navigate(`/super-admin/sales/campaigns/new?id=${cloned._id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to clone campaign.');
    }
  };

  // Aggregate Top-Level KPIs from loaded campaigns
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((acc, c) => acc + (c.stats?.sentCount || 0), 0);
  const totalDelivered = campaigns.reduce((acc, c) => acc + (c.stats?.deliveredCount || 0), 0);
  const totalReplies = campaigns.reduce((acc, c) => acc + (c.stats?.repliedCount || 0), 0);
  const avgDeliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 1000) / 10 : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sending':
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1 text-[11px]">
            <RefreshCw className="w-3 h-3 animate-spin" /> Sending
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 text-[11px]">
            <Pause className="w-3 h-3" /> Paused
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="gap-1 text-[11px]">
            <XCircle className="w-3 h-3" /> Cancelled
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="outline" className="text-primary border-primary gap-1 text-[11px]">
            <Clock className="w-3 h-3" /> Scheduled
          </Badge>
        );
      case 'draft':
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1 text-[11px] capitalize">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-primary" /> Campaigns &amp; Outreach
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage multi-channel outbound broadcasts, inspect real-time deliverability, and analyze recipient conversions.
          </p>
        </div>

        <Button
          onClick={() => navigate('/super-admin/sales/campaigns/new')}
          className="gap-2 bg-primary text-primary-foreground font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Campaign Wizard
        </Button>
      </div>

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 text-primary" /> Total Campaigns
          </span>
          <div className="text-2xl font-bold text-foreground" data-testid="kpi-total-campaigns">
            {totalCampaigns.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">Active in database</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Total Dispatches
          </span>
          <div className="text-2xl font-bold text-foreground" data-testid="kpi-total-sent">
            {totalSent.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">Messages processed</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Avg Delivery Rate
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="kpi-delivery-rate">
            {`${avgDeliveryRate}%`}
          </div>
          <p className="text-[11px] text-muted-foreground">{`${totalDelivered.toLocaleString()} confirmed delivered`}</p>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-purple-500" /> Inbound Responses
          </span>
          <div className="text-2xl font-bold text-foreground" data-testid="kpi-total-replies">
            {totalReplies.toLocaleString()}
          </div>
          <p className="text-[11px] text-muted-foreground">Direct replies received</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchCampaigns();
            }}
            className="pl-8 text-xs h-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel Filter */}
          <select
            aria-label="Filter by communication channel"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as any)}
            className="h-9 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>

          {/* Status Filter */}
          <select
            aria-label="Filter by campaign execution status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-2.5 rounded-md border border-input bg-background text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="sending">Sending</option>
            <option value="completed">Completed</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Button variant="outline" size="sm" onClick={fetchCampaigns} className="h-9 gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      {/* Campaigns List */}
      {loading ? (
        <div className="py-16 text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Megaphone className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No Campaigns Found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Create your first multi-channel outreach campaign using our guided creation wizard.
            </p>
          </div>
          <Button
            onClick={() => navigate('/super-admin/sales/campaigns/new')}
            className="gap-2 bg-primary text-primary-foreground text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Create First Campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const s = c.stats || {
              totalRecipients: 0,
              sentCount: 0,
              deliveredCount: 0,
              openedCount: 0,
              clickedCount: 0,
              bouncedCount: 0,
              repliedCount: 0,
              failedCount: 0,
            };
            const sentCount = s.sentCount || 0;
            const delivCount = s.deliveredCount || 0;
            const delivRate = sentCount > 0 ? Math.round((delivCount / sentCount) * 1000) / 10 : 0;
            const totalRecip = s.totalRecipients || c.recipients?.length || 0;

            return (
              <div
                key={c._id}
                onClick={() => navigate(`/super-admin/sales/campaigns/${c._id}`)}
                className="p-5 rounded-xl border border-border bg-card hover:border-primary/50 transition-all cursor-pointer shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                      {c.name}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      {c.channel === 'email' ? (
                        <Badge variant="secondary" className="gap-1 text-[10px] font-normal py-0">
                          <Mail className="w-3 h-3 text-primary" /> Email
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 text-[10px] font-normal py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <MessageSquare className="w-3 h-3 text-emerald-600" /> WhatsApp
                        </Badge>
                      )}
                      {getStatusBadge(c.status)}
                    </div>
                  </div>

                  {c.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground pt-1">
                    <span>{`${totalRecip.toLocaleString()} Recipients`}</span>
                    <span>•</span>
                    <span>{`${sentCount.toLocaleString()} Sent`}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {`${delivRate}% Delivered`}
                    </span>
                    <span>•</span>
                    <span>{`Created ${new Date(c.createdAt).toLocaleDateString()}`}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleClone(c._id, e)}
                    className="h-8 gap-1 text-xs"
                    title="Clone campaign"
                  >
                    <Copy className="w-3 h-3" /> Clone
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs group-hover:translate-x-1 transition-transform"
                  >
                    <span>Monitor</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SuperAdminCampaigns;
