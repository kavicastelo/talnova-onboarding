export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
  path?: string;
  cid?: string;
}

export interface EmailSendPayload {
  to: string | string[] | EmailRecipient | EmailRecipient[];
  from?: string;
  fromName?: string;
  replyTo?: string;
  cc?: string | string[] | EmailRecipient | EmailRecipient[];
  bcc?: string | string[] | EmailRecipient | EmailRecipient[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  tags?: Record<string, string>;
  headers?: Record<string, string>;
  campaignId?: string;
  leadId?: string;
  contactId?: string;
  trackingOptions?: {
    clickTracking?: boolean;
    openTracking?: boolean;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId: string;
  provider: 'ses' | 'sendgrid' | 'smtp' | 'mock';
  status: 'sent' | 'queued' | 'failed';
  timestamp: string;
  rawResponse?: any;
  error?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  validatedAt: string;
}

export interface IEmailProvider {
  readonly providerName: string;
  sendMail(payload: EmailSendPayload): Promise<EmailSendResult>;
  testConnection(): Promise<ConnectionTestResult>;
  validateWebhook(headers: Record<string, string | string[] | undefined>, body: any): Promise<boolean>;
  parseWebhookEvent?(headers: Record<string, string | string[] | undefined>, body: any): any;
}
