export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    link: string;
  };
  document?: {
    link: string;
    filename?: string;
  };
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters: WhatsAppTemplateParameter[];
}

export interface WhatsAppTemplateSendPayload {
  to: string;
  templateName: string;
  languageCode?: string;
  components?: WhatsAppTemplateComponent[];
  campaignId?: string;
  leadId?: string;
  contactId?: string;
  customArgs?: Record<string, string>;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components?: any[];
  id?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId: string;
  provider: 'meta_whatsapp' | 'twilio_whatsapp' | 'mock';
  status: 'sent' | 'queued' | 'delivered' | 'failed';
  recipient: string;
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

export interface IWhatsAppProvider {
  readonly providerName: string;
  sendTemplateMessage(payload: WhatsAppTemplateSendPayload): Promise<WhatsAppSendResult>;
  sendTextMessage?(to: string, message: string): Promise<WhatsAppSendResult>;
  syncApprovedTemplates(): Promise<WhatsAppTemplate[]>;
  testConnection(): Promise<ConnectionTestResult>;
  validateWebhook(signature: string, payload: any): boolean;
  parseWebhookEvent?(headers: Record<string, string | string[] | undefined>, body: any): any;
}

/**
 * Utility: Normalize raw phone number strictly to E.164 standard (+[country][number])
 */
export function normalizeToE164(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number is required for E.164 normalization');
  }

  // Remove whitespace, dashes, dots, brackets, and invisible chars
  let cleaned = phone.trim().replace(/[\s\-\(\)\.]/g, '');

  // Handle leading 00 as international prefix
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  // If no leading +, ensure we prepend +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  // Strict E.164 regex: + followed by 7 to 15 digits
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    throw new Error(`Invalid phone number format for E.164: "${phone}" (parsed as "${cleaned}")`);
  }

  return cleaned;
}
