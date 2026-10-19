/**
 * Utility functions for data normalization in the sales CRM domain.
 */

export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.toLowerCase().trim();
}

export function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const trimmed = phone.trim();
  if (!trimmed) return undefined;

  // Remove parentheses, spaces, hyphens, periods
  const stripped = trimmed.replace(/[\s\(\)\-\.]/g, "");

  if (stripped.startsWith("+")) {
    const digits = stripped.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : undefined;
  }

  const digits = stripped.replace(/\D/g, "");
  if (!digits) return undefined;

  // If 10 digits without leading country code, prefix standard default +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  return `+${digits}`;
}
