import React, { useState, useEffect, useRef, useTransition } from 'react';
import {
  Users,
  UserCheck,
  ShieldAlert,
  Filter,
  Check,
  X,
  Plus,
  RefreshCw,
  AlertTriangle,
  Clock,
  Sparkles,
  Building,
  Target,
} from 'lucide-react';
import { Badge } from '../../../Badge';
import { Button } from '../../../Button';
import { Input } from '../../../Input';
import { Label } from '../../../Label';
import {
  salesCampaignService,
  AudienceFilter,
  AudienceEstimateResult,
} from '../../../../services/salesCampaign.service';

interface StepAudienceProps {
  channel: 'email' | 'whatsapp';
  filter: AudienceFilter;
  onChange: (filter: AudienceFilter) => void;
  onEstimateChange?: (estimate: AudienceEstimateResult | null) => void;
}

const AVAILABLE_LEAD_STATUSES = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
];

const AVAILABLE_CONTACT_STATUSES = [
  { id: 'lead', label: 'Lead' },
  { id: 'prospect', label: 'Prospect' },
  { id: 'customer', label: 'Customer' },
  { id: 'churned', label: 'Churned' },
];

const AVAILABLE_INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Education',
  'Real Estate',
  'Consulting',
];

const AVAILABLE_COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export const StepAudience: React.FC<StepAudienceProps> = ({
  channel,
  filter,
  onChange,
  onEstimateChange,
}) => {
  const [, startTransition] = useTransition();
  const [includeTagInput, setIncludeTagInput] = useState('');
  const [excludeTagInput, setExcludeTagInput] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateData, setEstimateData] = useState<AudienceEstimateResult | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize estimate when filter changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsEstimating(true);
      setEstimateError(null);
      try {
        const queryFilter: AudienceFilter = {
          ...filter,
          channel,
        };
        const result = await salesCampaignService.estimateAudience(queryFilter, 5);
        startTransition(() => {
          setEstimateData(result);
          if (onEstimateChange) {
            onEstimateChange(result);
          }
        });
      } catch (err: any) {
        setEstimateError(err.message || 'Failed to estimate audience size.');
      } finally {
        setIsEstimating(false);
      }
    }, 350);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    channel,
    filter.target,
    JSON.stringify(filter.statuses),
    filter.minScore,
    filter.maxScore,
    JSON.stringify(filter.industries),
    JSON.stringify(filter.companySizes),
    JSON.stringify(filter.includeTags),
    JSON.stringify(filter.excludeTags),
    filter.inactiveDays,
    filter.country,
    JSON.stringify(filter.frequencyCap),
  ]);

  const handleTargetChange = (target: 'leads' | 'contacts' | 'both') => {
    onChange({ ...filter, target, statuses: [] });
  };

  const toggleStatus = (statusId: string) => {
    const current = filter.statuses || [];
    const updated = current.includes(statusId)
      ? current.filter((s) => s !== statusId)
      : [...current, statusId];
    onChange({ ...filter, statuses: updated });
  };

  const toggleIndustry = (ind: string) => {
    const current = filter.industries || [];
    const updated = current.includes(ind)
      ? current.filter((i) => i !== ind)
      : [...current, ind];
    onChange({ ...filter, industries: updated });
  };

  const toggleCompanySize = (size: string) => {
    const current = filter.companySizes || [];
    const updated = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];
    onChange({ ...filter, companySizes: updated });
  };

  const handleAddIncludeTag = () => {
    const trimmed = includeTagInput.trim();
    if (trimmed && !(filter.includeTags || []).includes(trimmed)) {
      onChange({ ...filter, includeTags: [...(filter.includeTags || []), trimmed] });
      setIncludeTagInput('');
    }
  };

  const handleRemoveIncludeTag = (tag: string) => {
    onChange({ ...filter, includeTags: (filter.includeTags || []).filter((t) => t !== tag) });
  };

  const handleAddExcludeTag = () => {
    const trimmed = excludeTagInput.trim();
    if (trimmed && !(filter.excludeTags || []).includes(trimmed)) {
      onChange({ ...filter, excludeTags: [...(filter.excludeTags || []), trimmed] });
      setExcludeTagInput('');
    }
  };

  const handleRemoveExcludeTag = (tag: string) => {
    onChange({ ...filter, excludeTags: (filter.excludeTags || []).filter((t) => t !== tag) });
  };

  const currentStatuses =
    filter.target === 'contacts'
      ? AVAILABLE_CONTACT_STATUSES
      : filter.target === 'both'
      ? [...AVAILABLE_LEAD_STATUSES, ...AVAILABLE_CONTACT_STATUSES.filter(c => !AVAILABLE_LEAD_STATUSES.some(l => l.id === c.id))]
      : AVAILABLE_LEAD_STATUSES;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" /> Audience Targeting & Segmentation
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select target entity types, build filtering criteria, and preview live deliverable audience with automatic suppression compliance.
        </p>
      </div>

      {/* Target Entity Toggle */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Target Population</Label>
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          {[
            { id: 'leads', label: 'CRM Leads', desc: 'Prospects in acquisition funnel' },
            { id: 'contacts', label: 'Contacts', desc: 'Enterprise accounts & people' },
            { id: 'both', label: 'Both', desc: 'Leads & Contacts combined' },
          ].map((item) => {
            const isSelected = (filter.target || 'leads') === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTargetChange(item.id as any)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-muted-foreground/30 bg-card'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground">{item.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Estimation Metrics Banner */}
      <div className="bg-card border border-border/70 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Live Delivery Estimation</h4>
            {isEstimating && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                <RefreshCw className="w-3 h-3 animate-spin text-primary" /> Calculating...
              </span>
            )}
          </div>
          <Badge variant="outline" className="text-xs">
            Channel: <span className="font-semibold uppercase ml-1">{channel}</span>
          </Badge>
        </div>

        {estimateError ? (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{estimateError}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total Matching */}
            <div className="p-4 rounded-lg bg-muted/40 border border-border/50">
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Total Matching Criteria
              </span>
              <div className="text-2xl font-bold text-foreground mt-1.5" data-testid="total-matching-count">
                {estimateData ? estimateData.totalMatching.toLocaleString() : '—'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Raw criteria matches in database</p>
            </div>

            {/* Net Deliverable */}
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Net Deliverable Recipients
              </span>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5" data-testid="net-deliverable-count">
                {estimateData ? estimateData.netDeliverable.toLocaleString() : '—'}
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1">
                Verified consent & ready for dispatch
              </p>
            </div>

            {/* Suppressed Breakdown */}
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Suppressed & Excluded
              </span>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5" data-testid="suppressed-count">
                {estimateData ? estimateData.suppressedCount.toLocaleString() : '—'}
              </div>
              <div className="flex flex-wrap gap-1 mt-2 text-[10px] text-muted-foreground">
                {estimateData?.suppressionBreakdown?.opted_out ? (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    {estimateData.suppressionBreakdown.opted_out} opted out
                  </Badge>
                ) : null}
                {estimateData?.suppressionBreakdown?.no_consent ? (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    {estimateData.suppressionBreakdown.no_consent} no consent
                  </Badge>
                ) : null}
                {estimateData?.suppressionBreakdown?.historical_bounce ? (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    {estimateData.suppressionBreakdown.historical_bounce} bounced
                  </Badge>
                ) : null}
                {estimateData?.suppressionBreakdown?.frequency_capped ? (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    {estimateData.suppressionBreakdown.frequency_capped} freq capped
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Sample Recipients Preview */}
        {estimateData && estimateData.sampleRecipients && estimateData.sampleRecipients.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              Sample Eligible Recipients ({estimateData.sampleRecipients.length})
            </h5>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-border rounded-lg overflow-hidden">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="py-2 px-3 font-medium">Name</th>
                    <th className="py-2 px-3 font-medium">Destination</th>
                    <th className="py-2 px-3 font-medium">Company</th>
                    <th className="py-2 px-3 font-medium">Score</th>
                    <th className="py-2 px-3 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {estimateData.sampleRecipients.map((sample) => (
                    <tr key={sample.id} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium text-foreground">{sample.name || 'Anonymous'}</td>
                      <td className="py-2 px-3 text-muted-foreground font-mono">
                        {channel === 'email' ? sample.email || '—' : sample.phone || '—'}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{sample.companyName || '—'}</td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {sample.score ?? 0}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        <span className="uppercase text-[10px] font-semibold text-muted-foreground">
                          {sample.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Filter Builder Sections */}
      <div className="space-y-6">
        {/* Statuses Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Lifecycle & Pipeline Statuses</Label>
          <p className="text-xs text-muted-foreground">
            Include contacts or leads currently in selected stage(s). Leave unselected to include all stages.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {currentStatuses.map((st) => {
              const active = (filter.statuses || []).includes(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => toggleStatus(st.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                  }`}
                >
                  {active && <Check className="w-3 h-3" />}
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Lead Score Slider / Filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary" /> Lead Score Filter
            </Label>
            <span className="text-xs text-muted-foreground">
              Min: {filter.minScore ?? 0} | Max: {filter.maxScore ?? 100}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div>
              <Label className="text-[11px] text-muted-foreground">Minimum Score</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={filter.minScore ?? ''}
                placeholder="0"
                onChange={(e) =>
                  onChange({
                    ...filter,
                    minScore: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Maximum Score</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={filter.maxScore ?? ''}
                placeholder="100"
                onChange={(e) =>
                  onChange({
                    ...filter,
                    maxScore: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Industry Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Building className="w-4 h-4 text-primary" /> Target Industries
          </Label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_INDUSTRIES.map((ind) => {
              const active = (filter.industries || []).includes(ind);
              return (
                <button
                  key={ind}
                  type="button"
                  onClick={() => toggleIndustry(ind)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {ind}
                </button>
              );
            })}
          </div>
        </div>

        {/* Company Size */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Company Sizes (Employees)</Label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_COMPANY_SIZES.map((size) => {
              const active = (filter.companySizes || []).includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleCompanySize(size)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-primary/10 border-primary text-primary font-semibold'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {size} employees
                </button>
              );
            })}
          </div>
        </div>

        {/* Include & Exclude Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Include Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Must Include Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. enterprise-tier, active-trial..."
                value={includeTagInput}
                onChange={(e) => setIncludeTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIncludeTag();
                  }
                }}
              />
              <Button size="sm" variant="secondary" onClick={handleAddIncludeTag}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {(filter.includeTags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(filter.includeTags || []).map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1 text-xs">
                    +{t}
                    <button type="button" onClick={() => handleRemoveIncludeTag(t)}>
                      <X className="w-3 h-3 hover:text-destructive" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Exclude Tags */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Exclude Contacts with Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. do-not-contact, competitor..."
                value={excludeTagInput}
                onChange={(e) => setExcludeTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddExcludeTag();
                  }
                }}
              />
              <Button size="sm" variant="secondary" onClick={handleAddExcludeTag}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {(filter.excludeTags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(filter.excludeTags || []).map((t) => (
                  <Badge key={t} variant="destructive" className="gap-1 text-xs">
                    -{t}
                    <button type="button" onClick={() => handleRemoveExcludeTag(t)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Frequency Capping */}
        <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Anti-Spam Frequency Capping</h4>
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically suppress recipients who have already received campaign messages recently.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Max</span>
            <Input
              type="number"
              className="w-20"
              value={filter.frequencyCap?.maxMessages ?? 3}
              min={1}
              max={20}
              onChange={(e) =>
                onChange({
                  ...filter,
                  frequencyCap: {
                    maxMessages: Number(e.target.value) || 3,
                    windowDays: filter.frequencyCap?.windowDays ?? 7,
                  },
                })
              }
            />
            <span className="text-xs text-muted-foreground">messages within the last</span>
            <Input
              type="number"
              className="w-20"
              value={filter.frequencyCap?.windowDays ?? 7}
              min={1}
              max={90}
              onChange={(e) =>
                onChange({
                  ...filter,
                  frequencyCap: {
                    maxMessages: filter.frequencyCap?.maxMessages ?? 3,
                    windowDays: Number(e.target.value) || 7,
                  },
                })
              }
            />
            <span className="text-xs text-muted-foreground">days</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StepAudience;
