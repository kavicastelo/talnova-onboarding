import nodemailer from "nodemailer";
import config from "../../config/index.js";

export class EmailService {
  private transporter: nodemailer.Transporter;
  public static sentEmails: { to: string; token: string }[] = [];

  constructor() {
    const { host, port, user, pass } = config.email;
    
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        auth: { user, pass },
        secure: port === 465,
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        tls: {
          rejectUnauthorized: false
        }
      });
    }
  }

  async sendEmail(to: string, subject: string, html: string, retries = 3, delayMs = 1000): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.transporter.sendMail({
          from: config.email.from,
          to,
          subject,
          html,
        });
        return true;
      } catch (error) {
        console.warn(`[EmailService] Attempt ${attempt} failed to send email to ${to}:`, error);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        } else {
          console.error(`[EmailService] All ${retries} attempts failed. Fallback retry logging: Email payload was:`, {
            to,
            subject,
            htmlSnippet: html.substring(0, 100) + "..."
          });
        }
      }
    }
    return false;
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
    EmailService.sentEmails.push({ to, token });
    const resetUrl = `http://localhost:5173/reset-password?token=${token}`;
    const subject = "Reset Your Password - Talnova Onboarding";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px; font-family: 'Inter', sans-serif;">Talnova Onboarding</h2>
        <p>Hello,</p>
        <p>We received a request to reset your password. Click the button below to choose a new password. This link is valid for 1 hour.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #64748b;">If the button doesn't work, copy and paste this link into your browser: <br/> <a href="${resetUrl}">${resetUrl}</a></p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendInvitationEmail(to: string, token: string, orgName: string): Promise<boolean> {
    EmailService.sentEmails.push({ to, token });
    const inviteUrl = `http://localhost:5173/register?token=${token}`;
    const subject = `Invitation to join ${orgName} on Talnova`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #4f46e5; margin-bottom: 20px; font-family: 'Inter', sans-serif;">Talnova Onboarding</h2>
        <p>Hello,</p>
        <p>You have been invited to join <strong>${orgName}</strong> on the Talnova Onboarding platform. Click the button below to accept the invitation and set up your account.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accept Invitation</a>
        </div>
        <p>If you did not expect this invitation, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #64748b;">If the button doesn't work, copy and paste this link into your browser: <br/> <a href="${inviteUrl}">${inviteUrl}</a></p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }
}

export default EmailService;
