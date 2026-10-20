import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  Mail,
  MessageSquare,
  FileText,
  Eye,
  Smartphone,
  Monitor,
  Code2,
  CheckCircle,
  Sparkles,
} from 'lucide-react';
import { Input } from '../../../Input';
import { Textarea } from '../../../Textarea';
import { Label } from '../../../Label';
import { Badge } from '../../../Badge';
import {
  salesCampaignService,
  CampaignTemplateItem,
} from '../../../../services/salesCampaign.service';

export interface StepComposerData {
  templateId?: string;
  subject: string;
  previewText: string;
  content: string;
  whatsappTemplateName: string;
  whatsappLanguageCode: string;
  whatsappParameters: Record<string, string>;
}

interface StepComposerProps {
  channel: 'email' | 'whatsapp';
  data: StepComposerData;
  onChange: (updates: Partial<StepComposerData>) => void;
  errors?: Record<string, string>;
}

const AVAILABLE_MERGE_TAGS = [
  { tag: '{{firstName}}', label: 'First Name', example: 'Alex' },
  { tag: '{{lastName}}', label: 'Last Name', example: 'Morgan' },
  { tag: '{{companyName}}', label: 'Company', example: 'Acme Global' },
  { tag: '{{jobTitle}}', label: 'Job Title', example: 'VP Technology' },
  { tag: '{{email}}', label: 'Email', example: 'alex.m@acme.com' },
  { tag: '{{phone}}', label: 'Phone', example: '+1 (555) 234-5678' },
  { tag: '{{industry}}', label: 'Industry', example: 'Technology' },
  { tag: '{{unsubscribeUrl}}', label: 'Unsubscribe Link', example: 'https://talnova.io/unsubscribe?t=demo' },
];

const STANDARD_WHATSAPP_TEMPLATES = [
  {
    name: 'enterprise_onboarding_intro',
    language: 'en_US',
    category: 'UTILITY',
    text: 'Hello {{1}}, welcome to Talnova! Your dedicated enterprise onboarding specialist for {{2}} is ready. Click the link below to schedule your kickoff session: {{3}}',
    params: [
      { key: '1', label: 'Recipient Name', defaultField: 'firstName' },
      { key: '2', label: 'Company Name', defaultField: 'companyName' },
      { key: '3', label: 'Kickoff Link', defaultField: 'custom', customValue: 'https://talnova.io/onboarding/portal' },
    ],
  },
  {
    name: 'quarterly_account_checkin',
    language: 'en_US',
    category: 'MARKETING',
    text: 'Hi {{1}}, this is Sarah from Talnova. We noticed strong team engagement at {{2}} this quarter. Would you have 10 minutes this week for a quick strategic review?',
    params: [
      { key: '1', label: 'Recipient Name', defaultField: 'firstName' },
      { key: '2', label: 'Company Name', defaultField: 'companyName' },
    ],
  },
  {
    name: 'executive_briefing_invitation',
    language: 'en_US',
    category: 'MARKETING',
    text: 'Dear {{1}}, you are cordially invited to the Q4 Talnova Enterprise Executive Roundtable for {{2}} leaders. RSVP here: {{3}}',
    params: [
      { key: '1', label: 'Executive Name', defaultField: 'firstName' },
      { key: '2', label: 'Industry Name', defaultField: 'industry' },
      { key: '3', label: 'RSVP URL', defaultField: 'custom', customValue: 'https://talnova.io/events/q4-exec' },
    ],
  },
];

const SAMPLE_LEAD_DATA: Record<string, string> = {
  firstName: 'Sarah',
  lastName: 'Connor',
  companyName: 'Cyberdyne Systems',
  jobTitle: 'Chief Security Officer',
  email: 's.connor@cyberdyne.com',
  phone: '+14155552671',
  industry: 'Artificial Intelligence',
  unsubscribeUrl: 'https://talnova.io/unsubscribe?token=demo_preview_token_123',
};

export const StepComposer: React.FC<StepComposerProps> = ({
  channel,
  data,
  onChange,
  errors = {},
}) => {
  const [templates, setTemplates] = useState<CampaignTemplateItem[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Load templates for current channel
  useEffect(() => {
    let isMounted = true;
    async function fetchTemplates() {
      setLoadingTemplates(true);
      try {
        const list = await salesCampaignService.getTemplates({ channel });
        if (isMounted) {
          setTemplates(list);
        }
      } catch (e) {
        console.error('Failed to load templates', e);
      } finally {
        if (isMounted) setLoadingTemplates(false);
      }
    }
    fetchTemplates();
    return () => {
      isMounted = false;
    };
  }, [channel]);

  // Handle template selection
  const handleSelectTemplate = (templateId: string) => {
    if (!templateId) {
      onChange({ templateId: undefined });
      return;
    }
    const found = templates.find((t) => t._id === templateId);
    if (found) {
      if (channel === 'email') {
        onChange({
          templateId: found._id,
          subject: found.subject || data.subject,
          previewText: found.previewText || data.previewText,
          content: found.htmlContent || found.plainTextContent || data.content,
        });
      } else {
        onChange({
          templateId: found._id,
          whatsappTemplateName: found.whatsappTemplateName || found.name,
          whatsappLanguageCode: found.whatsappLanguageCode || 'en_US',
        });
      }
    }
  };

  // Insert merge tag into content
  const handleInsertTag = (tag: string) => {
    if (channel === 'email') {
      onChange({ content: (data.content || '') + ' ' + tag });
    }
  };

  // Interpolate merge tags for email preview
  const interpolateEmailText = (text: string) => {
    if (!text) return '';
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      return SAMPLE_LEAD_DATA[key] || `{{${key}}}`;
    });
  };

function getPurifyInstance(): any {
  if (typeof (DOMPurify as any)?.sanitize === 'function') {
    return DOMPurify;
  }
  if (typeof DOMPurify === 'function') {
    if (typeof window !== 'undefined') {
      return (DOMPurify as any)(window);
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).window) {
      return (DOMPurify as any)((globalThis as any).window);
    }
  }
  return null;
}

  const sanitizedEmailPreview = useMemo(() => {
    const raw = interpolateEmailText(data.content || '');
    if (!raw) return '';

    const purifier = getPurifyInstance();
    if (purifier && typeof purifier.sanitize === 'function') {
      const clean = purifier.sanitize(raw, {
        ALLOWED_TAGS: [
          'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span',
          'h1', 'h2', 'h3', 'hr', 'blockquote', 'table', 'tr', 'td', 'th', 'thead', 'tbody'
        ],
        ALLOWED_ATTR: ['href', 'target', 'style', 'class', 'rel'],
        ADD_ATTR: ['target', 'rel'],
      });

      // Ensure that links automatically receive rel="noopener noreferrer"
      if (typeof clean === 'string') {
        return clean.replace(/<a\b([^>]*?)>/gi, (match: string, attrs: string) => {
          let updated = attrs;
          if (!attrs.includes('target=')) {
            updated += ' target="_blank"';
          }
          if (!attrs.includes('rel=')) {
            updated += ' rel="noopener noreferrer"';
          } else {
            updated = updated.replace(/rel=(["'])(.*?)\1/gi, 'rel="noopener noreferrer"');
          }
          return `<a${updated}>`;
        });
      }
      return clean;
    }

    // Resilient fallback for non-DOM / headless test environments
    const stripped = raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(?:href|src)\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, '');

    return stripped.replace(/<a\b([^>]*?)>/gi, (match: string, attrs: string) => {
      let updated = attrs;
      if (!attrs.includes('target=')) {
        updated += ' target="_blank"';
      }
      if (!attrs.includes('rel=')) {
        updated += ' rel="noopener noreferrer"';
      } else {
        updated = updated.replace(/rel=(["'])(.*?)\1/gi, 'rel="noopener noreferrer"');
      }
      return `<a${updated}>`;
    });
  }, [data.content]);

  // Current selected WhatsApp template config
  const currentWaTemplate = STANDARD_WHATSAPP_TEMPLATES.find(
    (t) => t.name === data.whatsappTemplateName
  ) || STANDARD_WHATSAPP_TEMPLATES[0];

  // Interpolate WhatsApp template preview
  const getInterpolatedWhatsAppMessage = () => {
    if (!currentWaTemplate) return '';
    let msg = currentWaTemplate.text;
    currentWaTemplate.params.forEach((p) => {
      const mappedField = data.whatsappParameters[p.key] || p.defaultField;
      const val =
        mappedField === 'custom'
          ? p.customValue || 'Sample'
          : SAMPLE_LEAD_DATA[mappedField] || `{{${p.key}}}`;
      msg = msg.split(`{{${p.key}}}`).join(val);
    });
    return msg;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            {channel === 'email' ? (
              <Mail className="w-5 h-5 text-primary" />
            ) : (
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            )}
            {`Message Composer (${channel === 'email' ? 'Email HTML & Plaintext' : 'WhatsApp Cloud API'})`}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Craft your outreach copy, configure approved templates, and preview real-time merge variable interpolation.
          </p>
        </div>

        {/* View toggle for email */}
        {channel === 'email' && (
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'edit'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" /> Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'preview'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Live Preview
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* EMAIL COMPOSER                                                           */}
      {/* ========================================================================= */}
      {channel === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Editor Column */}
          <div className={`space-y-6 ${activeTab === 'edit' ? 'lg:col-span-7' : 'hidden lg:block lg:col-span-6'}`}>
            {/* Template Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Pre-designed Email Template</Label>
                {templates.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {templates.length} templates available
                  </span>
                )}
              </div>
              <select
                aria-label="Pre-designed Email Template"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={data.templateId || ''}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                disabled={loadingTemplates}
              >
                <option value="">-- Blank / Custom HTML Email --</option>
                {templates.map((tpl) => (
                  <option key={tpl._id} value={tpl._id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Line */}
            <div className="space-y-2">
              <Label htmlFor="email-subject" className="text-sm font-medium">
                Email Subject Line <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email-subject"
                placeholder="e.g. Accelerating {{companyName}}'s Q4 Enterprise Onboarding"
                value={data.subject}
                onChange={(e) => onChange({ subject: e.target.value })}
                className={errors.subject ? 'border-destructive' : ''}
              />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
            </div>

            {/* Preview Text (Preheader) */}
            <div className="space-y-2">
              <Label htmlFor="email-preview-text" className="text-sm font-medium">
                Inbox Preview Text (Preheader)
              </Label>
              <Input
                id="email-preview-text"
                placeholder="e.g. Schedule your custom portal kickoff session with our solutions architect..."
                value={data.previewText}
                onChange={(e) => onChange({ previewText: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Displayed next to the subject line in Gmail, Outlook, and Apple Mail.
              </p>
            </div>

            {/* Merge Tags Quick Insertion Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Insert Personalization Tag
                </Label>
                <span className="text-[11px] text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Click to append
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_MERGE_TAGS.map((m) => (
                  <button
                    key={m.tag}
                    type="button"
                    onClick={() => handleInsertTag(m.tag)}
                    className="px-2 py-1 rounded bg-muted/80 hover:bg-muted text-[11px] font-mono border border-border text-foreground hover:border-primary/40 transition-colors"
                    title={`Inserts ${m.tag} (e.g. "${m.example}")`}
                  >
                    {m.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-body" className="text-sm font-medium">
                  Email Body (HTML / Markdown / Plain text) <span className="text-destructive">*</span>
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  UTF-8 Safe
                </Badge>
              </div>
              <Textarea
                id="email-body"
                rows={12}
                placeholder="<h1>Hello {{firstName}},</h1><p>Welcome to Talnova Onboarding!</p><p><a href='{{unsubscribeUrl}}'>Unsubscribe</a></p>"
                value={data.content}
                onChange={(e) => onChange({ content: e.target.value })}
                className={`font-mono text-xs leading-relaxed ${errors.content ? 'border-destructive' : ''}`}
              />
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
            </div>
          </div>

          {/* Preview Column */}
          <div
            className={`space-y-4 ${
              activeTab === 'preview' ? 'lg:col-span-12' : 'lg:col-span-5'
            }`}
          >
            <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Sample Recipient Preview</span>
              </div>
              <div className="flex items-center gap-1 bg-background p-0.5 rounded border border-border">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1 rounded text-xs ${
                    previewDevice === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                  title="Desktop Preview"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1 rounded text-xs ${
                    previewDevice === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                  title="Mobile Preview"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Email Inbox Mockup Container */}
            <div
              className={`border border-border rounded-xl overflow-hidden bg-card shadow-sm mx-auto transition-all ${
                previewDevice === 'mobile' ? 'max-w-sm' : 'w-full'
              }`}
            >
              {/* Email Header Mockup */}
              <div className="p-4 bg-muted/20 border-b border-border space-y-2 text-xs">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-muted-foreground w-12 flex-shrink-0">Subject:</span>
                  <span className="font-medium text-foreground">
                    {interpolateEmailText(data.subject) || '(No subject line specified)'}
                  </span>
                </div>
                {data.previewText && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-muted-foreground w-12 flex-shrink-0">Snippet:</span>
                    <span className="text-muted-foreground italic truncate">
                      {interpolateEmailText(data.previewText)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                  <span>{`To: ${SAMPLE_LEAD_DATA.firstName} ${SAMPLE_LEAD_DATA.lastName} <${SAMPLE_LEAD_DATA.email}>`}</span>
                  <span>{`From: Talnova Outreach <outreach@talnova.io>`}</span>
                </div>
              </div>

              {/* Rendered Email Body */}
              <div className="p-6 min-h-[300px] max-h-[500px] overflow-y-auto text-sm text-foreground prose dark:prose-invert max-w-none">
                {data.content ? (
                  <div
                    data-testid="email-preview-rendered-content"
                    dangerouslySetInnerHTML={{
                      __html: sanitizedEmailPreview,
                    }}
                  />
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs text-center space-y-2">
                    <FileText className="w-8 h-8 stroke-1 text-muted-foreground/50" />
                    <p>Start composing in the editor to see your email rendered here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WHATSAPP COMPOSER                                                        */}
      {/* ========================================================================= */}
      {channel === 'whatsapp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Column */}
          <div className="space-y-6 lg:col-span-7">
            {/* Meta Template Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Meta Pre-Approved Template <span className="text-destructive">*</span>
              </Label>
              <select
                aria-label="Meta Pre-Approved Template"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={data.whatsappTemplateName || STANDARD_WHATSAPP_TEMPLATES[0].name}
                onChange={(e) => {
                  const selectedName = e.target.value;
                  const tpl = STANDARD_WHATSAPP_TEMPLATES.find((t) => t.name === selectedName);
                  onChange({
                    whatsappTemplateName: selectedName,
                    whatsappLanguageCode: tpl?.language || 'en_US',
                  });
                }}
              >
                {STANDARD_WHATSAPP_TEMPLATES.map((tpl) => (
                  <option key={tpl.name} value={tpl.name}>
                    {tpl.name} ({tpl.category} - {tpl.language})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                In compliance with WhatsApp Business policies, only pre-approved templates can initiate outbound broadcasts.
              </p>
            </div>

            {/* Language Code */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Template Language Code</Label>
              <Input
                value={data.whatsappLanguageCode || 'en_US'}
                onChange={(e) => onChange({ whatsappLanguageCode: e.target.value })}
                placeholder="e.g. en_US"
                className="max-w-xs font-mono text-xs"
              />
            </div>

            {/* Dynamic Parameter Mapper */}
            <div className="space-y-3 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> Variable Parameter Mapping
                </Label>
                <Badge variant="secondary" className="text-[10px]">
                  {currentWaTemplate.params.length} Required Parameters
                </Badge>
              </div>

              <div className="space-y-3 pt-2">
                {currentWaTemplate.params.map((param) => {
                  const mappedVal = data.whatsappParameters[param.key] || param.defaultField;
                  return (
                    <div
                      key={param.key}
                      className="p-3 rounded-lg border border-border/70 bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {`{{${param.key}}}`}
                        </span>
                        <p className="text-xs text-foreground font-medium">{param.label}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          className="h-8 px-2.5 rounded border border-input bg-background text-xs text-foreground"
                          value={mappedVal}
                          onChange={(e) => {
                            onChange({
                              whatsappParameters: {
                                ...data.whatsappParameters,
                                [param.key]: e.target.value,
                              },
                            });
                          }}
                        >
                          <option value="firstName">Contact First Name</option>
                          <option value="lastName">Contact Last Name</option>
                          <option value="companyName">Company Name</option>
                          <option value="industry">Industry</option>
                          <option value="jobTitle">Job Title</option>
                          <option value="custom">Fixed Value / URL</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* WhatsApp Phone Mockup Column */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <span className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Customer Preview
            </span>

            {/* Mobile Device Mockup */}
            <div className="w-[320px] rounded-3xl border-4 border-zinc-800 bg-[#0B141A] dark:bg-[#0B141A] shadow-2xl overflow-hidden text-zinc-100 flex flex-col h-[520px]">
              {/* WhatsApp App Top Bar */}
              <div className="bg-[#1F2C34] px-4 py-3 flex items-center gap-3 border-b border-zinc-800">
                <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-sm text-white">
                  T
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold truncate text-zinc-100">Talnova Onboarding</span>
                    <CheckCircle className="w-3.5 h-3.5 fill-emerald-500 text-white flex-shrink-0" />
                  </div>
                  <span className="text-[10px] text-zinc-400 block truncate">Official Business Account</span>
                </div>
              </div>

              {/* Chat Message Canvas */}
              <div
                className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col justify-end"
                style={{
                  backgroundColor: '#0B141A',
                  backgroundImage: 'radial-gradient(#1F2C34 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              >
                {/* Meta Verified Notice */}
                <div className="mx-auto bg-[#182229] border border-zinc-700/60 rounded-md px-2.5 py-1 text-[10px] text-zinc-400 text-center max-w-[260px]">
                  Messages are end-to-end encrypted and sent via Meta Cloud API v18.0.
                </div>

                {/* Speech Bubble */}
                <div className="self-start max-w-[85%] bg-[#005C4B] text-zinc-100 rounded-lg rounded-tl-none p-3 shadow-md text-xs leading-relaxed space-y-2">
                  <p className="whitespace-pre-wrap">{getInterpolatedWhatsAppMessage()}</p>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/80 pt-1">
                    <span>10:42 AM</span>
                    <span className="text-emerald-300">✓✓</span>
                  </div>
                </div>
              </div>

              {/* Chat Input Bar Mockup */}
              <div className="bg-[#1F2C34] p-2.5 flex items-center gap-2 border-t border-zinc-800 text-zinc-400 text-xs">
                <div className="flex-1 bg-[#2A3942] rounded-full px-3 py-1.5 text-[11px] text-zinc-400">
                  Type a reply...
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepComposer;
