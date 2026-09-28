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
    if (process.env.NODE_ENV === "test") {
      return true;
    }
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
    console.log(`[EmailService] Password reset email dispatched to ${to} with token: ${token}`);
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

  async sendTenantWelcomeEmail(
    to: string,
    token: string,
    orgName: string,
    tempPassword?: string,
    isFirstLoginRequired = true
  ): Promise<boolean> {
    EmailService.sentEmails.push({ to, token });
    const inviteUrl = `http://localhost:5173/register?token=${token}`;
    const loginUrl = `http://localhost:5173/login`;
    const subject = `Welcome to ${orgName} on Talnova - Workspace Credentials & Activation`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 700;">Talnova Onboarding</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Enterprise Multi-Tenant Command Center</p>
        </div>
        <p style="color: #334155; font-size: 15px;">Hello,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">Your new organization workspace <strong>${orgName}</strong> has been provisioned on Talnova. You have been designated as the <strong>Workspace Owner</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 24px 0;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">Account Credentials</h3>
          <p style="margin: 6px 0; font-size: 14px; color: #1e293b;"><strong>Username / Email:</strong> <code style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px;">${to}</code></p>
          ${tempPassword ? `<p style="margin: 6px 0; font-size: 14px; color: #1e293b;"><strong>Temporary Password:</strong> <code style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>` : ""}
          ${isFirstLoginRequired ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #dc2626;">⚠️ For your security, you will be required to change your temporary password on your first sign-in.</p>` : ""}
        </div>

        <div style="margin: 28px 0; text-align: center;">
          <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Activate Workspace & Set Password</a>
        </div>

        <p style="color: #64748b; font-size: 13px; text-align: center;">Alternatively, sign in with your credentials at <a href="${loginUrl}" style="color: #4f46e5; font-weight: 500;">${loginUrl}</a>.</p>
        
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 28px 0;" />
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">If you have any questions or did not expect this workspace, please contact your Talnova platform administrator.</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendBulkEmployeeWelcomeEmail(
    to: string,
    token: string,
    orgName: string,
    tempPassword = "Welcome@2026!",
    employeeName?: string
  ): Promise<boolean> {
    EmailService.sentEmails.push({ to, token });
    const inviteUrl = `http://localhost:5173/register?token=${token}`;
    const loginUrl = `http://localhost:5173/login`;
    const subject = `Welcome to ${orgName} - Your Talnova Onboarding Account`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; margin-bottom: 8px; font-size: 22px;">Welcome to ${orgName}!</h2>
        <p style="color: #334155; font-size: 15px;">Hello${employeeName ? ` ${employeeName}` : ""},</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">An account has been created for you on the Talnova Onboarding platform for <strong>${orgName}</strong>.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 24px 0;">
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 14px; text-transform: uppercase; color: #475569;">Your Account Details</h3>
          <p style="margin: 6px 0; font-size: 14px; color: #1e293b;"><strong>Username / Email:</strong> <code style="background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px;">${to}</code></p>
          <p style="margin: 6px 0; font-size: 14px; color: #1e293b;"><strong>Temporary Password:</strong> <code style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>
          <p style="margin: 8px 0 0 0; font-size: 12px; color: #dc2626;">⚠️ You will be prompted to choose a new password upon first sign-in.</p>
        </div>

        <div style="margin: 28px 0; text-align: center;">
          <a href="${inviteUrl}" style="background-color: #4f46e5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Activate Account</a>
        </div>

        <p style="color: #64748b; font-size: 13px; text-align: center;">Or sign in directly at <a href="${loginUrl}" style="color: #4f46e5;">${loginUrl}</a>.</p>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }
}

export default EmailService;
