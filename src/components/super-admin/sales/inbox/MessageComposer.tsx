import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  Mail,
  MessageSquare,
} from 'lucide-react';
import { ICommThread, CommThreadStatus, SendReplyPayload } from '../../../../services/salesInbox.service';

interface MessageComposerProps {
  thread: ICommThread;
  onSend: (payload: SendReplyPayload) => Promise<void>;
  disabled?: boolean;
}

const CANNED_RESPONSES = [
  {
    label: 'Demo Confirmation',
    subject: 'Confirming your Talnova Platform Demo',
    body: 'Thank you for reaching out! We are delighted to confirm your demo. Our technical team is preparing the walkthrough. Looking forward to speaking soon.',
  },
  {
    label: 'Request Pricing Info',
    subject: 'Talnova Enterprise Pricing & Package Details',
    body: 'Hi there, thank you for your interest in Talnova! I have attached our Enterprise Tier overview. Please let us know if you would like to review customized volume options.',
  },
  {
    label: 'Follow-up Check-in',
    subject: 'Following up on your onboarding requirements',
    body: 'Just checking in to see if you had any questions regarding our previous discussion or if we can assist with anything else for your team rollout.',
  },
  {
    label: 'Ticket Resolved',
    subject: 'Inquiry Resolved - Thank you',
    body: 'We have processed your request and verified all updates. If there is anything else you need, please feel free to reply directly to this thread.',
  },
];

export const MessageComposer: React.FC<MessageComposerProps> = ({
  thread,
  onSend,
  disabled = false,
}) => {
  const isEmail = thread.channel === 'email';
  const defaultSubject = thread.subject
    ? thread.subject.startsWith('Re:')
      ? thread.subject
      : `Re: ${thread.subject}`
    : 'Follow-up regarding your request';

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [targetStatus, setTargetStatus] = useState<CommThreadStatus>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCannedMenu, setShowCannedMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync subject when thread changes
  useEffect(() => {
    setSubject(defaultSubject);
    setBody('');
    setErrorMsg(null);
  }, [thread._id]);

  const handleApplyTemplate = (tpl: typeof CANNED_RESPONSES[0]) => {
    if (isEmail) {
      setSubject(tpl.subject);
    }
    setBody(tpl.body);
    setShowCannedMenu(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!body.trim() || isSubmitting || disabled) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: SendReplyPayload = {
        body: body.trim(),
        status: targetStatus,
      };

      if (isEmail && subject.trim()) {
        payload.subject = subject.trim();
      }

      await onSend(payload);
      setBody('');
      // If thread had Re: subject, maintain it
      setSubject(defaultSubject);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch reply. Please verify provider connectivity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard shortcut Ctrl+Enter or Cmd+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-card/60 backdrop-blur-md p-4">
      {errorMsg && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-500">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-red-400 hover:text-red-300 text-xs font-semibold underline ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Canned responses dropdown bar */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              id="canned-responses-trigger"
              onClick={() => setShowCannedMenu(!showCannedMenu)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-secondary/80 hover:bg-secondary text-secondary-foreground border border-border/50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Replies</span>
            </button>

            {showCannedMenu && (
              <div
                id="canned-responses-menu"
                className="absolute bottom-full left-0 mb-2 w-72 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl z-30 p-1 space-y-1 animate-in fade-in zoom-in-95"
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40">
                  Pre-approved Responses
                </div>
                {CANNED_RESPONSES.map((tpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted/70 text-xs flex flex-col gap-0.5 transition-colors"
                  >
                    <span className="font-medium text-foreground">{tpl.label}</span>
                    <span className="text-[11px] text-muted-foreground line-clamp-1">
                      {tpl.body}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1">
            {isEmail ? (
              <>
                <Mail className="w-3 h-3 text-blue-500" /> Email Channel
              </>
            ) : (
              <>
                <MessageSquare className="w-3 h-3 text-emerald-500" /> WhatsApp Channel
              </>
            )}
          </span>
        </div>

        {/* Target Thread Status post-send */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground text-[11px] hidden sm:inline">After Send:</span>
          <select
            id="target-status-select"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value as CommThreadStatus)}
            className="text-xs bg-background border border-input rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="pending">Mark Pending (Awaiting Reply)</option>
            <option value="open">Keep Open</option>
            <option value="resolved">Mark Resolved</option>
          </select>
        </div>
      </div>

      {/* Email Subject line (channel dependent) */}
      {isEmail && (
        <div className="mb-2">
          <input
            id="reply-subject-input"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject..."
            className="w-full px-3 py-1.5 text-xs bg-background/80 border border-input rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          />
        </div>
      )}

      {/* Message Body Area */}
      <div className="relative rounded-xl border border-input bg-background/90 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
        <textarea
          ref={textareaRef}
          id="reply-body-textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isEmail
              ? 'Compose email response (Ctrl+Enter to send)...'
              : 'Type WhatsApp reply (*bold*, _italics_) (Ctrl+Enter to send)...'
          }
          rows={3}
          disabled={disabled || isSubmitting}
          className="w-full resize-none p-3 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
        />

        {/* Footer inside textarea box */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20 text-xs">
          <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
            <span>
              {body.length} characters
            </span>
            <span className="hidden md:inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 text-[10px] font-mono">
                Ctrl
              </kbd>
              +
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/80 text-[10px] font-mono">
                Enter
              </kbd>
              to send
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="send-reply-btn"
              onClick={() => handleSubmit()}
              disabled={!body.trim() || isSubmitting || disabled}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Reply</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;
