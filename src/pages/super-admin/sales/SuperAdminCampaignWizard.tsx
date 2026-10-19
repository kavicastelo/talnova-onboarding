import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Megaphone,
  Users,
  PenTool,
  ShieldCheck,
  Rocket,
  ChevronLeft,
  ChevronRight,
  Save,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/Button';
import {
  salesCampaignService,
  AudienceFilter,
  AudienceEstimateResult,
} from '../../../services/salesCampaign.service';
import { StepDetails, StepDetailsData } from '../../../components/super-admin/sales/campaigns/StepDetails';
import { StepAudience } from '../../../components/super-admin/sales/campaigns/StepAudience';
import { StepComposer, StepComposerData } from '../../../components/super-admin/sales/campaigns/StepComposer';
import { StepValidation } from '../../../components/super-admin/sales/campaigns/StepValidation';
import { StepLaunch, StepLaunchData } from '../../../components/super-admin/sales/campaigns/StepLaunch';

const STEPS = [
  { id: 1, label: 'Details', icon: Megaphone, desc: 'Name & Channel' },
  { id: 2, label: 'Audience', icon: Users, desc: 'Targeting & Filters' },
  { id: 3, label: 'Composer', icon: PenTool, desc: 'Templates & Copy' },
  { id: 4, label: 'Validation', icon: ShieldCheck, desc: 'Pre-launch Checks' },
  { id: 5, label: 'Launch', icon: Rocket, desc: 'Dispatch & Schedule' },
];

export const SuperAdminCampaignWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const existingId = searchParams.get('id');
  const cloneId = searchParams.get('cloneId');

  const [currentStep, setCurrentStep] = useState(1);
  const [campaignId, setCampaignId] = useState<string | null>(existingId);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(Boolean(existingId || cloneId));

  // Step 1: Details
  const [details, setDetails] = useState<StepDetailsData>({
    name: '',
    channel: 'email',
    description: '',
    tags: [],
  });

  // Step 2: Audience
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>({
    target: 'leads',
    statuses: [],
    minScore: undefined,
    maxScore: undefined,
    industries: [],
    companySizes: [],
    includeTags: [],
    excludeTags: [],
    frequencyCap: { maxMessages: 3, windowDays: 7 },
  });
  const [estimateData, setEstimateData] = useState<AudienceEstimateResult | null>(null);

  // Step 3: Composer
  const [composer, setComposer] = useState<StepComposerData>({
    templateId: undefined,
    subject: '',
    previewText: '',
    content: '',
    whatsappTemplateName: 'enterprise_onboarding_intro',
    whatsappLanguageCode: 'en_US',
    whatsappParameters: {
      '1': 'firstName',
      '2': 'companyName',
      '3': 'custom',
    },
  });

  // Step 5: Launch
  const [launchConfig, setLaunchConfig] = useState<StepLaunchData>({
    executionMode: 'immediate',
    scheduledAt: undefined,
    batchSize: 50,
    rateLimitPerSecond: 14,
  });

  // Step validation errors
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  // Sync rate limit defaults when channel switches
  useEffect(() => {
    if (details.channel === 'whatsapp' && launchConfig.rateLimitPerSecond === 14) {
      setLaunchConfig((prev) => ({ ...prev, rateLimitPerSecond: 50 }));
    } else if (details.channel === 'email' && launchConfig.rateLimitPerSecond === 50) {
      setLaunchConfig((prev) => ({ ...prev, rateLimitPerSecond: 14 }));
    }
  }, [details.channel]);

  // Load existing or cloned campaign
  useEffect(() => {
    async function loadCampaign() {
      const targetId = existingId || cloneId;
      if (!targetId) return;

      try {
        setLoadingInitial(true);
        const fetched = await salesCampaignService.getCampaignById(targetId);
        if (fetched) {
          setDetails({
            name: cloneId ? `${fetched.name} (Copy)` : fetched.name,
            channel: fetched.channel,
            description: fetched.description || '',
            tags: fetched.tags || [],
          });

          if (fetched.audienceFilter) {
            setAudienceFilter(fetched.audienceFilter);
          }

          setComposer({
            templateId: fetched.templateId?._id || fetched.templateId,
            subject: fetched.subject || '',
            previewText: fetched.previewText || '',
            content: fetched.content || '',
            whatsappTemplateName: fetched.whatsappTemplateName || 'enterprise_onboarding_intro',
            whatsappLanguageCode: fetched.whatsappLanguageCode || 'en_US',
            whatsappParameters: fetched.whatsappParameters || { '1': 'firstName', '2': 'companyName' },
          });

          if (existingId) {
            setCampaignId(existingId);
          }
        }
      } catch (err: any) {
        toast.error(err.message || 'Failed to load campaign data.');
      } finally {
        setLoadingInitial(false);
      }
    }

    loadCampaign();
  }, [existingId, cloneId]);

  // Validate step before advancing
  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!details.name.trim()) {
        errors.name = 'Campaign name is required';
      }
    } else if (currentStep === 2) {
      if (estimateData && estimateData.netDeliverable === 0) {
        toast.error('Audience criteria yielded 0 deliverable contacts. Adjust filters before proceeding.');
        return false;
      }
    } else if (currentStep === 3) {
      if (details.channel === 'email') {
        if (!composer.subject.trim()) {
          errors.subject = 'Email subject line is required';
        }
        if (!composer.content.trim() || composer.content.trim().length < 10) {
          errors.content = 'Email body content must contain at least 10 characters';
        }
      } else {
        if (!composer.whatsappTemplateName.trim()) {
          errors.whatsappTemplateName = 'An approved Meta template is required';
        }
      }
    } else if (currentStep === 4) {
      if (estimateData && estimateData.netDeliverable === 0) {
        toast.error('Cannot advance with 0 deliverable recipients.');
        return false;
      }
      if (details.channel === 'email' && !composer.subject.trim()) {
        toast.error('Email subject line is required.');
        return false;
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Save Campaign as Draft
  const handleSaveDraft = async () => {
    if (!details.name.trim()) {
      toast.error('Please specify a campaign name before saving draft.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload: any = {
        name: details.name,
        channel: details.channel,
        description: details.description,
        tags: details.tags,
        audienceFilter: {
          ...audienceFilter,
          channel: details.channel,
        },
        templateId: composer.templateId,
        subject: details.channel === 'email' ? composer.subject : undefined,
        previewText: details.channel === 'email' ? composer.previewText : undefined,
        content: details.channel === 'email' ? composer.content : undefined,
        whatsappTemplateName: details.channel === 'whatsapp' ? composer.whatsappTemplateName : undefined,
        whatsappLanguageCode: details.channel === 'whatsapp' ? composer.whatsappLanguageCode : undefined,
        whatsappParameters: details.channel === 'whatsapp' ? composer.whatsappParameters : undefined,
      };

      let saved;
      if (campaignId) {
        saved = await salesCampaignService.updateCampaign(campaignId, payload);
      } else {
        saved = await salesCampaignService.createCampaign(payload);
        setCampaignId(saved._id);
      }

      toast.success('Campaign draft saved successfully.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to save campaign draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Launch Campaign Execution
  const handleLaunchCampaign = async () => {
    setIsLaunching(true);
    try {
      // 1. Resolve recipients matching current filter
      const resolved = await salesCampaignService.resolveAudience(
        { ...audienceFilter, channel: details.channel },
        10000
      );

      // 2. Persist / update campaign record
      const payload: any = {
        name: details.name,
        channel: details.channel,
        description: details.description,
        tags: details.tags,
        audienceFilter: {
          ...audienceFilter,
          channel: details.channel,
        },
        templateId: composer.templateId,
        subject: details.channel === 'email' ? composer.subject : undefined,
        previewText: details.channel === 'email' ? composer.previewText : undefined,
        content: details.channel === 'email' ? composer.content : undefined,
        whatsappTemplateName: details.channel === 'whatsapp' ? composer.whatsappTemplateName : undefined,
        whatsappLanguageCode: details.channel === 'whatsapp' ? composer.whatsappLanguageCode : undefined,
        whatsappParameters: details.channel === 'whatsapp' ? composer.whatsappParameters : undefined,
        scheduledAt: launchConfig.executionMode === 'scheduled' ? launchConfig.scheduledAt : undefined,
        recipients: resolved.recipients,
      };

      let currentId = campaignId;
      if (currentId) {
        await salesCampaignService.updateCampaign(currentId, payload);
      } else {
        const created = await salesCampaignService.createCampaign(payload);
        currentId = created._id;
        setCampaignId(currentId);
      }

      // 3. Dispatch launch
      if (launchConfig.executionMode === 'immediate') {
        await salesCampaignService.launchCampaign(currentId!, {
          batchSize: launchConfig.batchSize,
          rateLimitPerSecond: launchConfig.rateLimitPerSecond,
        });
        toast.success(`Campaign launched successfully to ${resolved.resolvedCount} recipients!`);
      } else {
        await salesCampaignService.updateCampaignStatus(currentId!, 'scheduled');
        toast.success(`Campaign successfully scheduled for ${launchConfig.scheduledAt}!`);
      }

      // 4. Redirect to campaign delivery monitor
      navigate('/super-admin/sales/campaigns');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to launch campaign.');
    } finally {
      setIsLaunching(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading campaign configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-4 px-4 sm:px-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span
              onClick={() => navigate('/super-admin/sales/campaigns')}
              className="hover:underline cursor-pointer"
            >
              Campaigns
            </span>
            <span>/</span>
            <span className="text-foreground font-medium">New Campaign</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Megaphone className="w-6 h-6 text-primary" /> Campaign Creation Wizard
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Multi-channel outreach builder for enterprise lead acquisition and onboarding engagement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSavingDraft}
            className="gap-1.5"
          >
            {isSavingDraft ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Draft</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/super-admin/sales/campaigns')}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Stepper Navigation Indicator */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-5 gap-2">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep || validateCurrentStep()) {
                    setCurrentStep(step.id);
                  }
                }}
                disabled={step.id > currentStep}
                className={`flex flex-col sm:flex-row items-center sm:items-start gap-2 p-2.5 rounded-lg text-left transition-all ${
                  isCurrent
                    ? 'bg-primary/10 border-primary text-primary border'
                    : isCompleted
                    ? 'text-foreground hover:bg-muted/50 cursor-pointer'
                    : 'text-muted-foreground opacity-60'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className="text-xs font-semibold truncate leading-tight flex items-center gap-1">
                    <Icon className="w-3 h-3" />
                    <span>{step.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{step.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Step Content */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-sm min-h-[460px]">
        {currentStep === 1 && (
          <StepDetails
            data={details}
            onChange={(updates) => setDetails((prev) => ({ ...prev, ...updates }))}
            errors={stepErrors}
          />
        )}

        {currentStep === 2 && (
          <StepAudience
            channel={details.channel}
            filter={audienceFilter}
            onChange={(newFilter) => setAudienceFilter(newFilter)}
            onEstimateChange={(est) => setEstimateData(est)}
          />
        )}

        {currentStep === 3 && (
          <StepComposer
            channel={details.channel}
            data={composer}
            onChange={(updates) => setComposer((prev) => ({ ...prev, ...updates }))}
            errors={stepErrors}
          />
        )}

        {currentStep === 4 && (
          <StepValidation
            details={details}
            composer={composer}
            estimate={estimateData}
            onNavigateStep={(stepIdx) => setCurrentStep(stepIdx + 1)}
          />
        )}

        {currentStep === 5 && (
          <StepLaunch
            details={details}
            composer={composer}
            estimate={estimateData}
            launchConfig={launchConfig}
            onChange={(updates) => setLaunchConfig((prev) => ({ ...prev, ...updates }))}
            onLaunch={handleLaunchCampaign}
            isLaunching={isLaunching}
          />
        )}
      </div>

      {/* Wizard Footer Controls */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={handlePrevStep}
          disabled={currentStep === 1}
          className="gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {`Step ${currentStep} of ${STEPS.length}`}
          </span>
          {currentStep < 5 && (
            <Button onClick={handleNextStep} className="gap-1.5 font-medium">
              Next Step <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminCampaignWizard;
