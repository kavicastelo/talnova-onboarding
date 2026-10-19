import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Button } from '../../../components/Button';
import {
  salesCampaignService,
  CampaignItem,
} from '../../../services/salesCampaign.service';
import { CampaignDeliveryMonitor } from '../../../components/super-admin/sales/campaigns/CampaignDeliveryMonitor';

export const CampaignDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState<CampaignItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaign = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await salesCampaignService.getCampaignById(id);
      setCampaign(data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load campaign details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading campaign performance data...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Campaign Not Found</h3>
        <p className="text-sm text-muted-foreground">{error || 'The requested campaign record could not be retrieved.'}</p>
        <div className="pt-2">
          <Button onClick={() => navigate('/super-admin/sales/campaigns')} className="gap-2">
            <ChevronLeft className="w-4 h-4" /> Back to All Campaigns
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4 px-4 sm:px-6">
      {/* Top Breadcrumbs & Quick Nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/super-admin/sales/campaigns')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Campaigns</span>
        </button>

        <Button
          size="sm"
          onClick={() => navigate('/super-admin/sales/campaigns/new')}
          className="gap-1.5 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Campaign</span>
        </Button>
      </div>

      {/* Main Campaign Delivery Monitor */}
      <CampaignDeliveryMonitor
        initialCampaign={campaign}
        onRefresh={fetchCampaign}
      />
    </div>
  );
};

export default CampaignDetailPage;
