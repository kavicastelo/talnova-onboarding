import React, { useState } from 'react';
import { Mail, MessageSquare, Tag, X, Plus, Info, CheckCircle2 } from 'lucide-react';
import { Input } from '../../../Input';
import { Textarea } from '../../../Textarea';
import { Label } from '../../../Label';
import { Badge } from '../../../Badge';

export interface StepDetailsData {
  name: string;
  channel: 'email' | 'whatsapp';
  description: string;
  tags: string[];
}

interface StepDetailsProps {
  data: StepDetailsData;
  onChange: (updates: Partial<StepDetailsData>) => void;
  errors?: Record<string, string>;
}

export const StepDetails: React.FC<StepDetailsProps> = ({ data, onChange, errors = {} }) => {
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !data.tags.includes(trimmed)) {
      onChange({ tags: [...data.tags, trimmed] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange({ tags: data.tags.filter((t) => t !== tagToRemove) });
  };

  const handleKeyDownTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Campaign Details</h3>
        <p className="text-sm text-muted-foreground">
          Define the identity, communication channel, and core objectives for this campaign.
        </p>
      </div>

      {/* Campaign Name */}
      <div className="space-y-2">
        <Label htmlFor="campaign-name" className="text-sm font-medium">
          Campaign Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="campaign-name"
          placeholder="e.g. Q4 Enterprise Onboarding Follow-up"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Channel Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          Communication Channel <span className="text-destructive">*</span>
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Email Option */}
          <div
            onClick={() => onChange({ channel: 'email' })}
            className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              data.channel === 'email'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border hover:border-muted-foreground/30 bg-card'
            }`}
          >
            {data.channel === 'email' && (
              <div className="absolute top-3 right-3 text-primary">
                <CheckCircle2 className="w-5 h-5 fill-primary text-primary-foreground" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    data.channel === 'email'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Email Marketing</h4>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                    SES • SendGrid • SMTP
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Full HTML & plain-text layouts, open & click tracking, dynamic merge tags, and automatic bounce suppression.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-primary" />
              <span>Supports up to 500 emails/batch</span>
            </div>
          </div>

          {/* WhatsApp Option */}
          <div
            onClick={() => onChange({ channel: 'whatsapp' })}
            className={`relative p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              data.channel === 'whatsapp'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-sm'
                : 'border-border hover:border-muted-foreground/30 bg-card'
            }`}
          >
            {data.channel === 'whatsapp' && (
              <div className="absolute top-3 right-3 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5 fill-emerald-600 dark:fill-emerald-500 text-white" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    data.channel === 'whatsapp'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">WhatsApp Broadcast</h4>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Meta Cloud API v18.0
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Pre-approved Meta templates, variable parameter interpolation, real-time read receipts, and verified phone delivery.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>Strict E.164 phone normalization enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Description */}
      <div className="space-y-2">
        <Label htmlFor="campaign-description" className="text-sm font-medium">
          Objective & Internal Description
        </Label>
        <Textarea
          id="campaign-description"
          rows={3}
          placeholder="Briefly state the goal, target cohort, and expectations for this outreach..."
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      {/* Campaign Tags */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Campaign Tags</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Tag className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Add tag (e.g. enterprise, q4-2026, onboarding)..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDownTag}
              className="pl-9"
            />
          </div>
          <button
            type="button"
            onClick={handleAddTag}
            className="px-3 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium rounded-md flex items-center gap-1 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {data.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {data.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="pl-2 pr-1 py-1 gap-1 text-xs flex items-center rounded-md"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:bg-muted rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StepDetails;
