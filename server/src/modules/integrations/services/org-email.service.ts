import nodemailer from "nodemailer";
import EmailService from "../../../shared/email/email.service.js";

export interface EmailProviderConfig {
  provider: "smtp" | "resend" | "sendgrid";
  host?: string;
  port?: number;
  secure?: boolean;
  fromEmail?: string;
  fromName?: string;
  user?: string;
}

export interface EmailProviderSecrets {
  password?: string;
  apiKey?: string;
}

export class OrgEmailService {
  /**
   * Test email provider connection & credentials
   */
  async testConnection(
    config: EmailProviderConfig,
    secrets: EmailProviderSecrets,
    targetEmail?: string
  ): Promise<{ success: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      if (config.provider === "smtp") {
        if (!config.host || !config.port) {
          throw new Error("SMTP host and port are required.");
        }

        const transportOptions: nodemailer.TransportOptions = {
          host: config.host,
          port: Number(config.port),
          secure: config.secure ?? (Number(config.port) === 465),
          auth:
            config.user && secrets.password
              ? { user: config.user, pass: secrets.password }
              : undefined,
          tls: {
            rejectUnauthorized: false,
          },
        } as any;

        const transporter = nodemailer.createTransport(transportOptions);
        
        // If in test environment, simulate immediate verification
        if (process.env.NODE_ENV === "test") {
          return { success: true, latencyMs: Date.now() - start };
        }

        await transporter.verify();

        if (targetEmail) {
          await transporter.sendMail({
            from: `"${config.fromName || 'Talnova'}" <${config.fromEmail || config.user || 'no-reply@talnova.io'}>`,
            to: targetEmail,
            subject: "Talnova - Email Integration Connection Test",
            html: `<div style="font-family: sans-serif; padding: 16px;"><h3>Connection Successful</h3><p>Your organization's email delivery integration is operational.</p></div>`,
          });
        }
      } else if (config.provider === "resend") {
        if (!secrets.apiKey) {
          throw new Error("Resend API Key is required.");
        }

        if (process.env.NODE_ENV === "test") {
          return { success: true, latencyMs: Date.now() - start };
        }

        const res = await fetch("https://api.resend.com/api_keys", {
          headers: { Authorization: `Bearer ${secrets.apiKey}` },
        });

        if (!res.ok) {
          throw new Error(`Resend returned HTTP ${res.status}: ${res.statusText}`);
        }
      } else if (config.provider === "sendgrid") {
        if (!secrets.apiKey) {
          throw new Error("SendGrid API Key is required.");
        }

        if (process.env.NODE_ENV === "test") {
          return { success: true, latencyMs: Date.now() - start };
        }

        const res = await fetch("https://api.sendgrid.com/v3/scopes", {
          headers: { Authorization: `Bearer ${secrets.apiKey}` },
        });

        if (!res.ok) {
          throw new Error(`SendGrid returned HTTP ${res.status}: ${res.statusText}`);
        }
      } else {
        throw new Error(`Unsupported email provider: ${config.provider}`);
      }

      return { success: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        error: err.message || "Failed to verify email configuration",
      };
    }
  }

  /**
   * Send email using the organization's configured provider
   */
  async sendEmail(
    config: EmailProviderConfig,
    secrets: EmailProviderSecrets,
    to: string,
    subject: string,
    html: string
  ): Promise<boolean> {
    if (process.env.NODE_ENV === "test") {
      EmailService.sentEmails.push({ to, token: "" });
      return true;
    }

    if (config.provider === "smtp") {
      const transporter = nodemailer.createTransport({
        host: config.host,
        port: Number(config.port) || 587,
        secure: config.secure ?? (Number(config.port) === 465),
        auth:
          config.user && secrets.password
            ? { user: config.user, pass: secrets.password }
            : undefined,
        tls: { rejectUnauthorized: false },
      });

      const fromAddress = `"${config.fromName || 'Talnova'}" <${config.fromEmail || config.user || 'no-reply@talnova.io'}>`;

      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });
      return true;
    } else if (config.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secrets.apiKey}`,
        },
        body: JSON.stringify({
          from: `"${config.fromName || 'Talnova'}" <${config.fromEmail || 'onboarding@resend.dev'}>`,
          to,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Resend delivery failed with status ${res.status}`);
      }
      return true;
    } else if (config.provider === "sendgrid") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secrets.apiKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: config.fromEmail || "no-reply@talnova.io", name: config.fromName || "Talnova" },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errors?.[0]?.message || `SendGrid delivery failed with status ${res.status}`);
      }
      return true;
    }

    throw new Error(`Unsupported email provider: ${config.provider}`);
  }

  /**
   * Send onboarding invitation email
   */
  async sendInvitationEmail(
    config: EmailProviderConfig,
    secrets: EmailProviderSecrets,
    to: string,
    token: string,
    orgName: string
  ): Promise<boolean> {
    EmailService.sentEmails.push({ to, token });
    const inviteUrl = `http://localhost:5173/register?token=${token}`;
    const subject = `Invitation to join ${orgName} on Talnova`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">Talnova Onboarding</h2>
        <p style="font-size: 16px; color: #1e293b;">Hello,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          You have been invited to join <strong>${orgName}</strong> on the Talnova Onboarding platform.
          Click the button below to complete your registration and begin your onboarding journey.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${inviteUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Accept Invitation</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">If you did not expect this invitation, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Direct link: <a href="${inviteUrl}" style="color: #4f46e5;">${inviteUrl}</a></p>
      </div>
    `;

    return this.sendEmail(config, secrets, to, subject, html);
  }

  /**
   * Send password recovery email
   */
  async sendPasswordResetEmail(
    config: EmailProviderConfig,
    secrets: EmailProviderSecrets,
    to: string,
    token: string
  ): Promise<boolean> {
    EmailService.sentEmails.push({ to, token });
    const resetUrl = `http://localhost:5173/reset-password?token=${token}`;
    const subject = "Reset Your Password - Talnova Onboarding";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">Talnova Onboarding</h2>
        <p style="font-size: 16px; color: #1e293b;">Hello,</p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          We received a request to reset your password. Click the button below to choose a new password. This link is valid for 1 hour.
        </p>
        <div style="margin: 32px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 13px; color: #64748b;">If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Direct link: <a href="${resetUrl}" style="color: #4f46e5;">${resetUrl}</a></p>
      </div>
    `;

    return this.sendEmail(config, secrets, to, subject, html);
  }
}

export default OrgEmailService;
