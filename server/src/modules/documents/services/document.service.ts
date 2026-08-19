import mongoose from "mongoose";
import crypto from "crypto";
import DocumentTemplate, { IDocumentTemplate } from "../models/document-template.model.js";
import DocumentAssignment, { IDocumentAssignment } from "../models/document-assignment.model.js";
import User from "../../auth/models/user.model.js";
import Organization from "../../organizations/models/organization.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";

const notificationService = new NotificationService(new NotificationRepository());

export class DocumentService {
  /**
   * Create document template
   */
  async createTemplate(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: Partial<IDocumentTemplate>
  ) {
    const template = await DocumentTemplate.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      title: data.title,
      description: data.description,
      category: data.category || "custom",
      content: data.content,
      signatureRequired: data.signatureRequired !== undefined ? data.signatureRequired : true,
      version: 1,
      audience: data.audience || {},
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    return template;
  }

  /**
   * List document templates for an organization
   */
  async listTemplates(orgId: string | mongoose.Types.ObjectId) {
    return DocumentTemplate.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    }).sort({ createdAt: -1 });
  }

  /**
   * Get template by ID
   */
  async getTemplate(orgId: string | mongoose.Types.ObjectId, templateId: string | mongoose.Types.ObjectId) {
    const template = await DocumentTemplate.findOne({
      _id: new mongoose.Types.ObjectId(templateId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Document template not found");
    }

    return template;
  }

  /**
   * Update template
   */
  async updateTemplate(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: Partial<IDocumentTemplate>
  ) {
    const template = await this.getTemplate(orgId, templateId);

    if (data.title) template.title = data.title;
    if (data.description !== undefined) template.description = data.description;
    if (data.category) template.category = data.category;
    if (data.content) {
      template.content = data.content;
      template.version += 1;
    }
    if (data.signatureRequired !== undefined) template.signatureRequired = data.signatureRequired;
    if (data.audience) template.audience = { ...template.audience, ...data.audience };

    template.updatedBy = new mongoose.Types.ObjectId(userId);
    await template.save();

    return template;
  }

  /**
   * Soft delete template
   */
  async deleteTemplate(orgId: string | mongoose.Types.ObjectId, templateId: string | mongoose.Types.ObjectId) {
    const template = await this.getTemplate(orgId, templateId);
    template.isDeleted = true;
    template.deletedAt = new Date();
    await template.save();
  }

  /**
   * Variable Interpolator
   */
  private interpolateContent(content: string, user: any, orgName: string): string {
    const employeeName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() || "Employee";
    const email = user.auth?.email || "";
    const department = user.employment?.department || "General";
    const jobTitle = user.employment?.jobTitle || user.employment?.designation || "Team Member";
    const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    return content
      .replace(/\{\{\s*employeeName\s*\}\}/g, employeeName)
      .replace(/\{\{\s*employeeEmail\s*\}\}/g, email)
      .replace(/\{\{\s*department\s*\}\}/g, department)
      .replace(/\{\{\s*jobTitle\s*\}\}/g, jobTitle)
      .replace(/\{\{\s*companyName\s*\}\}/g, orgName)
      .replace(/\{\{\s*date\s*\}\}/g, date);
  }

  /**
   * Assign document template to employee
   */
  async assignDocument(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    assignedByUserId: string | mongoose.Types.ObjectId,
    dueDate?: Date
  ) {
    const template = await this.getTemplate(orgId, templateId);
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(employeeId), organizationId: new mongoose.Types.ObjectId(orgId), isDeleted: false });
    if (!user) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }

    const org = await Organization.findById(orgId);
    const orgName = org?.name || "Company";

    const renderedContent = this.interpolateContent(template.content, user, orgName);

    const assignment = await DocumentAssignment.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      templateId: template._id,
      templateTitle: template.title,
      templateVersion: template.version,
      employeeId: new mongoose.Types.ObjectId(employeeId),
      assignedBy: new mongoose.Types.ObjectId(assignedByUserId),
      status: "pending",
      assignedAt: new Date(),
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      renderedContent,
      auditTrail: [
        {
          action: "assigned",
          performedBy: new mongoose.Types.ObjectId(assignedByUserId),
          timestamp: new Date(),
          details: `Document "${template.title}" assigned to employee`,
        },
      ],
    });

    // Send notification to employee
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "journey_assigned",
      title: "New Document Requires E-Signature",
      message: `You have been assigned "${template.title}" for electronic signature. Please review and sign by ${assignment.dueDate?.toLocaleDateString() || "due date"}.`,
      priority: "high",
    });

    return assignment;
  }

  /**
   * Get employee document inbox
   */
  async getEmployeeDocumentInbox(orgId: string | mongoose.Types.ObjectId, employeeId: string | mongoose.Types.ObjectId) {
    return DocumentAssignment.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }).sort({ assignedAt: -1 });
  }

  /**
   * Get single document assignment for signing / viewing
   */
  async getDocumentAssignment(
    orgId: string | mongoose.Types.ObjectId,
    assignmentId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    role: string,
    reqMetadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const assignment = await DocumentAssignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Document assignment not found");
    }

    // Role security check
    if (role === "employee" && assignment.employeeId.toString() !== userId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You can only view your own documents");
    }

    // Log viewed audit event if pending
    if (assignment.status === "pending" && assignment.employeeId.toString() === userId.toString()) {
      assignment.status = "viewed";
      assignment.auditTrail.push({
        action: "viewed",
        performedBy: new mongoose.Types.ObjectId(userId),
        timestamp: new Date(),
        ipAddress: reqMetadata?.ipAddress,
        userAgent: reqMetadata?.userAgent,
        details: "Document opened for viewing",
      });
      await assignment.save();
    }

    return assignment;
  }

  /**
   * In-App E-Signature Submission (DOC-003, DOC-004)
   */
  async signDocument(
    orgId: string | mongoose.Types.ObjectId,
    assignmentId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    payload: {
      type: "draw" | "type";
      signatureDataUrl?: string;
      signerName: string;
    },
    reqMetadata?: { ipAddress?: string; userAgent?: string }
  ) {
    const assignment = await DocumentAssignment.findOne({
      _id: new mongoose.Types.ObjectId(assignmentId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    });

    if (!assignment) {
      throw new AppError(404, "NOT_FOUND", "Document assignment not found");
    }

    if (assignment.status === "signed") {
      throw new AppError(400, "ALREADY_SIGNED", "Document has already been signed");
    }

    const signedAt = new Date();
    const rawDataToHash = `${assignment.renderedContent || ""}:${payload.signatureDataUrl || payload.signerName}:${signedAt.toISOString()}:${reqMetadata?.ipAddress || ""}`;
    const sha256Hash = crypto.createHash("sha256").update(rawDataToHash).digest("hex");

    assignment.status = "signed";
    assignment.signedAt = signedAt;
    assignment.signatureData = {
      type: payload.type,
      signatureDataUrl: payload.signatureDataUrl,
      signerName: payload.signerName,
      signedAt,
      ipAddress: reqMetadata?.ipAddress,
      userAgent: reqMetadata?.userAgent,
      sha256Hash,
    };

    assignment.auditTrail.push({
      action: "signed",
      performedBy: new mongoose.Types.ObjectId(employeeId),
      timestamp: signedAt,
      ipAddress: reqMetadata?.ipAddress,
      userAgent: reqMetadata?.userAgent,
      details: `E-Signature executed by ${payload.signerName}. Checksum SHA-256: ${sha256Hash.substring(0, 16)}...`,
    });

    await assignment.save();

    // Send confirmation notification
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "journey_completed",
      title: "Document E-Signature Completed",
      message: `Your signature on "${assignment.templateTitle}" has been successfully verified and saved with cryptographic audit log.`,
      priority: "medium",
    });

    return assignment;
  }

  /**
   * Auto-assign document templates to new hires on USER_CREATED event
   */
  async autoAssignDocumentsToNewHire(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const templates = await DocumentTemplate.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      "audience.autoAssignNewHires": true,
      isDeleted: false,
    });

    let count = 0;
    for (const template of templates) {
      try {
        await this.assignDocument(orgId, template._id, userId, template.createdBy);
        count++;
      } catch (err: any) {
        // Skip duplicate or error
      }
    }

    return count;
  }
}

export const documentService = new DocumentService();
export default documentService;
