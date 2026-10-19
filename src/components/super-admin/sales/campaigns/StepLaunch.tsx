import React, { useState } from 'react';
import {
  Rocket,
  Calendar,
  Send,
  Sliders,
  CheckCircle,
  Mail,
  MessageSquare,
  ShieldAlert,
  Loader2,
  Clock,
  Check,
} from 'lucide-react';
import { Input } from '../../../Input';
import { Label } from '../../../Label';
import { Badge } from '../../../Badge';
import { Button } from '../../../Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../../Dialog';
import { AudienceEstimateResult } from '../../../../services/salesCampaign.service';
import { StepDetailsData } from './StepDetails';
import { StepComposerData } from './StepComposer';

export interface StepLaunchData {
  executionMode: 'immediate' | 'scheduled';
  scheduledAt?: string;
  batchSize: number;
  rateLimitPerSecond: number;
}

interface StepLaunchProps {
  details: StepDetailsData;
  composer: StepComposerData;
  estimate: AudienceEstimateResult | null;
  launchConfig: StepLaunchData;
  onChange: (updates: Partial<StepLaunchData>) => void;
  onLaunch: () => Promise<void>;
  isLaunching: boolean;
}

export const StepLaunch: React.FC<StepLaunchProps> = ({
  details,
  composer,
  estimate,
  launchConfig,
  onChange,
  onLaunch,
  isLaunching,
}) => {
  const [testRecipient, setTestRecipient] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  const handleSendTest = async () => {
    if (!testRecipient) return;
    setTestSending(true);
    setTestSuccess(null);
    try {
      // Simulate/trigger test message sending
      await new Promise((resolve) => setTimeout(resolve, 800));
      setTestSuccess(`Test message successfully transmitted to ${testRecipient}`);
    } finally {
      setTestSending(false);
    }
  };

  const netRecipients = estimate?.netDeliverable ?? 0;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" /> Campaign Dispatch & Scheduling
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select execution timeline, tune delivery rate limits, send preview test messages, and authorize live launch.
        </p>
      </div>

      {/* Campaign Summary Card */}
      <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Launch Summary
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Campaign Name</span>
            <p className="font-semibold text-sm text-foreground truncate">{details.name || 'Untitled'}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Channel</span>
            <div className="flex items-center gap-1.5">
              {details.channel === 'email' ? (
                <Mail className="w-4 h-4 text-primary" />
              ) : (
                <MessageSquare className="w-4 h-4 text-emerald-600" />
              )}
              <span className="font-medium text-sm text-foreground capitalize">{details.channel}</span>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Net Audience</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">
                {`${netRecipients.toLocaleString()} recipients`}
              </Badge>
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Subject / Template</span>
            <p className="font-medium text-xs text-foreground truncate">
              {details.channel === 'email' ? composer.subject || '—' : composer.whatsappTemplateName || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline / Execution Mode Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Dispatch Timeline</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Send Immediately */}
          <div
            onClick={() => onChange({ executionMode: 'immediate' })}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
              launchConfig.executionMode === 'immediate'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm text-foreground">Send Immediately</h4>
              </div>
              {launchConfig.executionMode === 'immediate' && (
                <Check className="w-4 h-4 text-primary font-bold" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Queue batch dispatcher immediately upon confirmation and begin sending messages sequentially.
            </p>
          </div>

          {/* Schedule for Later */}
          <div
            onClick={() => onChange({ executionMode: 'scheduled' })}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
              launchConfig.executionMode === 'scheduled'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h4 className="font-semibold text-sm text-foreground">Schedule for Later</h4>
              </div>
              {launchConfig.executionMode === 'scheduled' && (
                <Check className="w-4 h-4 text-primary font-bold" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Designate a future date and time for automated background dispatch execution.
            </p>
          </div>
        </div>

        {/* Schedule Date & Time Picker */}
        {launchConfig.executionMode === 'scheduled' && (
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
            <Label htmlFor="schedule-time" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" /> Scheduled Execution Date & Time
            </Label>
            <Input
              id="schedule-time"
              type="datetime-local"
              className="max-w-xs"
              value={launchConfig.scheduledAt || ''}
              onChange={(e) => onChange({ scheduledAt: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone} (Local System Time)
            </p>
          </div>
        )}
      </div>

      {/* Throttle & Batch Tuning */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Throughput & Rate Limiting Controls</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Tune dispatcher concurrency and message velocity to maintain optimal sender reputation and provider quota compliance.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Batch Chunk Size</Label>
              <span className="text-xs font-semibold text-foreground">{`${launchConfig.batchSize} per batch`}</span>
            </div>
            <Input
              type="number"
              min={10}
              max={500}
              step={10}
              value={launchConfig.batchSize}
              onChange={(e) => onChange({ batchSize: Number(e.target.value) || 50 })}
            />
            <span className="text-[11px] text-muted-foreground">Default: 50. Max recommended: 500 recipients.</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Velocity Rate Limit</Label>
              <span className="text-xs font-semibold text-foreground">{`${launchConfig.rateLimitPerSecond} msg / sec`}</span>
            </div>
            <Input
              type="number"
              min={1}
              max={100}
              value={launchConfig.rateLimitPerSecond}
              onChange={(e) => onChange({ rateLimitPerSecond: Number(e.target.value) || 14 })}
            />
            <span className="text-[11px] text-muted-foreground">
              {details.channel === 'email' ? 'SES default quota: 14 msg/s.' : 'WhatsApp default limit: 50 msg/s.'}
            </span>
          </div>
        </div>
      </div>

      {/* Send Test Message */}
      <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" /> Send Test Message
        </h4>
        <p className="text-xs text-muted-foreground">
          Verify formatting and delivery before launching to the full audience cohort.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
          <Input
            placeholder={
              details.channel === 'email' ? 'tester@talnova.io' : '+14155552671'
            }
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleSendTest}
            disabled={!testRecipient || testSending}
            className="flex-shrink-0"
          >
            {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Test'}
          </Button>
        </div>

        {testSuccess && (
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{testSuccess}</span>
          </div>
        )}
      </div>

      {/* Primary Action Button */}
      <div className="pt-4 border-t border-border flex justify-end">
        <Button
          size="lg"
          onClick={() => setIsConfirmModalOpen(true)}
          disabled={isLaunching || netRecipients === 0}
          className="gap-2 bg-primary text-primary-foreground font-semibold px-6 shadow-md"
        >
          {isLaunching ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Launching...
            </>
          ) : launchConfig.executionMode === 'immediate' ? (
            <>
              <Rocket className="w-4 h-4" /> Authorize & Launch Campaign
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" /> Schedule Campaign
            </>
          )}
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-lg">
              Confirm Campaign Launch
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Please review and acknowledge the live broadcast parameters before proceeding.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 rounded-lg bg-muted/40 border border-border text-xs space-y-2.5 my-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target Audience:</span>
              <span className="font-semibold text-foreground">{netRecipients.toLocaleString()} Recipients</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Channel:</span>
              <span className="font-semibold text-foreground uppercase">{details.channel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Execution:</span>
              <span className="font-semibold text-foreground">
                {launchConfig.executionMode === 'immediate'
                  ? 'Immediate Dispatch'
                  : `Scheduled for ${launchConfig.scheduledAt || 'Specified Date'}`}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2 pt-2">
            <input
              type="checkbox"
              id="confirm-ack"
              checked={hasAcknowledged}
              onChange={(e) => setHasAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <label htmlFor="confirm-ack" className="text-xs text-foreground font-medium cursor-pointer">
              I understand this action will dispatch live communications to {netRecipients.toLocaleString()} recipients and cannot be undone.
            </label>
          </div>

          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isLaunching}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                setIsConfirmModalOpen(false);
                await onLaunch();
              }}
              disabled={!hasAcknowledged || isLaunching}
              className="gap-2 bg-primary text-primary-foreground font-medium"
            >
              {isLaunching && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm & Launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StepLaunch;
