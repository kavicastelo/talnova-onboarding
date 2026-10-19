import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { CampaignItem } from '../../../../services/salesCampaign.service';
import { Megaphone, Mail, MessageSquare, CheckCircle, Reply, Layers } from 'lucide-react';

export interface CampaignRoiComparisonProps {
  campaigns: CampaignItem[];
  loading?: boolean;
}

export const CampaignRoiComparison: React.FC<CampaignRoiComparisonProps> = ({
  campaigns = [],
  loading = false,
}) => {
  // Aggregate stats by channel: email vs whatsapp
  const channelMetrics = useMemo(() => {
    let emailCampaigns = 0;
    let emailSent = 0;
    let emailDelivered = 0;
    let emailOpened = 0;
    let emailReplied = 0;
    let emailFailed = 0;

    let whatsappCampaigns = 0;
    let whatsappSent = 0;
    let whatsappDelivered = 0;
    let whatsappRead = 0;
    let whatsappReplied = 0;
    let whatsappFailed = 0;

    for (const c of campaigns) {
      const stats = c.stats || {
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        repliedCount: 0,
        failedCount: 0,
      };

      if (c.channel === 'email') {
        emailCampaigns++;
        emailSent += stats.sentCount || 0;
        emailDelivered += stats.deliveredCount || 0;
        emailOpened += stats.openedCount || 0;
        emailReplied += stats.repliedCount || 0;
        emailFailed += stats.failedCount || 0;
      } else if (c.channel === 'whatsapp') {
        whatsappCampaigns++;
        whatsappSent += stats.sentCount || 0;
        whatsappDelivered += stats.deliveredCount || 0;
        whatsappRead += stats.openedCount || 0;
        whatsappReplied += stats.repliedCount || 0;
        whatsappFailed += stats.failedCount || 0;
      }
    }

    const emailDeliveryRate =
      emailSent > 0 ? Number(((emailDelivered / emailSent) * 100).toFixed(1)) : 0;
    const emailReplyRate =
      emailDelivered > 0 ? Number(((emailReplied / emailDelivered) * 100).toFixed(1)) : 0;

    const whatsappDeliveryRate =
      whatsappSent > 0 ? Number(((whatsappDelivered / whatsappSent) * 100).toFixed(1)) : 0;
    const whatsappReplyRate =
      whatsappDelivered > 0
        ? Number(((whatsappReplied / whatsappDelivered) * 100).toFixed(1))
        : 0;

    const chartData = [
      {
        metric: 'Dispatched',
        Email: emailSent,
        WhatsApp: whatsappSent,
      },
      {
        metric: 'Delivered',
        Email: emailDelivered,
        WhatsApp: whatsappDelivered,
      },
      {
        metric: 'Engaged / Opened',
        Email: emailOpened,
        WhatsApp: whatsappRead,
      },
      {
        metric: 'Inbound Replies',
        Email: emailReplied,
        WhatsApp: whatsappReplied,
      },
    ];

    return {
      email: {
        campaigns: emailCampaigns,
        sent: emailSent,
        delivered: emailDelivered,
        opened: emailOpened,
        replied: emailReplied,
        failed: emailFailed,
        deliveryRate: emailDeliveryRate,
        replyRate: emailReplyRate,
      },
      whatsapp: {
        campaigns: whatsappCampaigns,
        sent: whatsappSent,
        delivered: whatsappDelivered,
        read: whatsappRead,
        replied: whatsappReplied,
        failed: whatsappFailed,
        deliveryRate: whatsappDeliveryRate,
        replyRate: whatsappReplyRate,
      },
      chartData,
      hasData: emailSent > 0 || whatsappSent > 0 || campaigns.length > 0,
    };
  }, [campaigns]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Megaphone className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Marketing Campaign Channel ROI Comparison
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Side-by-side delivery, engagement, and response rate comparison between Email and WhatsApp channels
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
            <Mail className="w-3.5 h-3.5" />
            {`${channelMetrics.email.campaigns} Email Campaigns`}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
            <MessageSquare className="w-3.5 h-3.5" />
            {`${channelMetrics.whatsapp.campaigns} WhatsApp Campaigns`}
          </span>
        </div>
      </div>

      {/* Side-by-Side Channel Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email Outreach Performance */}
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
              <span className="p-1.5 bg-blue-100 rounded-md text-blue-700">
                <Mail className="w-4 h-4" />
              </span>
              Email Marketing (SES / SendGrid / SMTP)
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              {`${channelMetrics.email.deliveryRate}% Delivered`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Dispatched</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {channelMetrics.email.sent.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold flex items-center justify-center gap-0.5">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                Delivered
              </p>
              <p className="text-base font-bold text-emerald-700 mt-0.5">
                {channelMetrics.email.delivered.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold flex items-center justify-center gap-0.5">
                <Reply className="w-3 h-3 text-indigo-500" />
                Replies
              </p>
              <p className="text-base font-bold text-indigo-700 mt-0.5">
                {channelMetrics.email.replied.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Inbound reply conversion rate: <strong className="text-slate-800">{`${channelMetrics.email.replyRate}%`}</strong>
          </p>
        </div>

        {/* WhatsApp Outreach Performance */}
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
              <span className="p-1.5 bg-emerald-100 rounded-md text-emerald-700">
                <MessageSquare className="w-4 h-4" />
              </span>
              WhatsApp Cloud API (Meta / Twilio)
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {`${channelMetrics.whatsapp.deliveryRate}% Delivered`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs pt-1">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold">Dispatched</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {channelMetrics.whatsapp.sent.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold flex items-center justify-center gap-0.5">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                Delivered
              </p>
              <p className="text-base font-bold text-emerald-700 mt-0.5">
                {channelMetrics.whatsapp.delivered.toLocaleString()}
              </p>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
              <p className="text-[10px] text-slate-500 uppercase font-semibold flex items-center justify-center gap-0.5">
                <Reply className="w-3 h-3 text-indigo-500" />
                Replies
              </p>
              <p className="text-base font-bold text-indigo-700 mt-0.5">
                {channelMetrics.whatsapp.replied.toLocaleString()}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Inbound reply conversion rate: <strong className="text-slate-800">{`${channelMetrics.whatsapp.replyRate}%`}</strong>
          </p>
        </div>
      </div>

      {/* Comparative Grouped Bar Chart */}
      <div className="h-64 w-full relative">
        {loading ? (
          <div className="h-full w-full flex items-center justify-center bg-slate-50/50 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-slate-400 text-sm">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Analyzing campaign channels…</span>
            </div>
          </div>
        ) : !channelMetrics.hasData ? (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-lg">
            <Layers className="w-8 h-8 text-slate-300 mb-1" />
            <span>No activity in selected date range</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={channelMetrics.chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1.5 border border-slate-800">
                      <p className="font-semibold text-slate-300 border-b border-slate-800 pb-1">
                        {label}
                      </p>
                      {payload.map((entry: any, index: number) => (
                        <div key={`camp-tt-${index}`} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}:
                          </span>
                          <span className="font-bold">{entry.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                height={30}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingBottom: '4px' }}
              />
              <Bar dataKey="Email" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="WhatsApp" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default CampaignRoiComparison;
