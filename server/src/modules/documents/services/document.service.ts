import mongoose from "mongoose";
import crypto from "crypto";
import DocumentTemplate, { IDocumentTemplate } from "../models/document-template.model.js";
import DocumentAssignment, { IDocumentAssignment } from "../models/document-assignment.model.js";
import User from "../../auth/models/user.model.js";
import Organization from "../../organizations/models/organization.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";
import eventBus from "../../../infrastructure/events/event-bus.js";

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
      isMandatory: data.isMandatory !== undefined ? data.isMandatory : false,
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
    if (data.isMandatory !== undefined) template.isMandatory = data.isMandatory;
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

    const employeeName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim() || "Employee";
    const managerId = user.employment?.managerId || (user.employment as any)?.managerUserId;

    // Send notification to employee (responsible)
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "document_assigned",
      title: "New Document Requires E-Signature",
      message: `You have been assigned "${template.title}" for electronic signature. Please review and sign by ${assignment.dueDate?.toLocaleDateString() || "due date"}.`,
      priority: "high",
      data: {
        documentId: assignment._id.toString(),
        templateId: template._id.toString(),
        deepLink: `/documents`,
      },
    });

    // Send notification to manager (relevant)
    if (managerId && managerId.toString() !== employeeId.toString() && managerId.toString() !== assignedByUserId.toString()) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: managerId,
        type: "document_assigned",
        title: `Compliance Document Assigned: ${employeeName}`,
        message: `"${template.title}" has been assigned to ${employeeName} for signature (Due: ${assignment.dueDate?.toLocaleDateString() || "due date"}).`,
        priority: "medium",
        data: {
          documentId: assignment._id.toString(),
          employeeId: employeeId.toString(),
          deepLink: `/compliance`,
        },
      }).catch((err) => console.warn("[DocumentService] Manager notification error:", err));
    }

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
      supervisorWitnessId?: string | mongoose.Types.ObjectId;
      supervisorPin?: string;
      kioskDeviceId?: string | mongoose.Types.ObjectId;
      kioskSessionToken?: string;
    },
    reqMetadata?: { ipAddress?: string; userAgent?: string },
    userRole?: string
  ) {
    const isFrontlineKiosk = userRole === "frontline_worker_kiosk" || Boolean(payload.kioskSessionToken);
    if (isFrontlineKiosk) {
      if (!payload.supervisorWitnessId || !payload.supervisorPin) {
        throw new AppError(403, "SUPERVISOR_PIN_REQUIRED", "Supervisor PIN authorization is required for frontline kiosk document execution (UQ-01).");
      }
    }

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

    // Verify supervisor witness authorization if supervisorPin or kioskDeviceId is provided
    let witnessUser: any = null;
    if (payload.supervisorPin || payload.supervisorWitnessId) {
      if (!payload.supervisorWitnessId) {
        throw new AppError(400, "BAD_REQUEST", "supervisorWitnessId is required for supervisor authorization");
      }
      witnessUser = await User.findOne({
        _id: new mongoose.Types.ObjectId(payload.supervisorWitnessId),
        organizationId: new mongoose.Types.ObjectId(orgId),
        isDeleted: false,
        "permissions.role": { $in: ["manager", "admin", "owner", "super_admin"] },
      });

      if (!witnessUser) {
        throw new AppError(404, "SUPERVISOR_NOT_FOUND", "Authorized supervisor witness not found");
      }

      if (payload.supervisorPin) {
        const pinHash = crypto.createHash("sha256").update(payload.supervisorPin.trim()).digest("hex");
        const stored = witnessUser.security?.supervisorPinHash;
        const isMatch = stored ? (stored === pinHash || stored === payload.supervisorPin.trim()) : false;
        if (!isMatch) {
          throw new AppError(401, "INVALID_SUPERVISOR_PIN", "Invalid supervisor authorization PIN");
        }
      }
    }

    const signedAt = new Date();
    const rawDataToHash = `${assignment.renderedContent || ""}:${payload.signatureDataUrl || payload.signerName}:${signedAt.toISOString()}:${reqMetadata?.ipAddress || ""}:${witnessUser?._id || ""}`;
    const sha256Hash = crypto.createHash("sha256").update(rawDataToHash).digest("hex");

    const witnessAuditText = witnessUser
      ? `Authorized, witnessed & co-signed at frontline kiosk by supervisor witness: ${witnessUser.profile?.fullName || witnessUser.auth?.email} (Role: ${witnessUser.permissions.role}).`
      : "";

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
      supervisorWitnessId: witnessUser ? witnessUser._id : (payload.supervisorWitnessId ? new mongoose.Types.ObjectId(payload.supervisorWitnessId) : undefined),
      kioskDeviceId: payload.kioskDeviceId ? new mongoose.Types.ObjectId(payload.kioskDeviceId) : undefined,
      notes: witnessAuditText || undefined,
    };

    assignment.auditTrail.push({
      action: "signed",
      performedBy: new mongoose.Types.ObjectId(employeeId),
      timestamp: signedAt,
      ipAddress: reqMetadata?.ipAddress,
      userAgent: reqMetadata?.userAgent,
      details: `E-Signature executed by ${payload.signerName}.${witnessAuditText} Checksum SHA-256: ${sha256Hash.substring(0, 16)}...`,
    });

    await assignment.save();

    // Publish DOCUMENT_SIGNED event
    try {
      await eventBus.publish({
        eventName: "DOCUMENT_SIGNED",
        organizationId: orgId,
        actorId: employeeId,
        entityId: assignment._id as any,
        payload: {
          assignmentId: assignment._id.toString(),
          templateId: assignment.templateId.toString(),
          templateTitle: assignment.templateTitle,
          employeeId: employeeId.toString(),
          recipientUserId: employeeId.toString(),
          signatureHash: sha256Hash,
        },
      });
    } catch (e) {
      console.error("Failed to publish DOCUMENT_SIGNED event:", e);
    }

    // 1. Send confirmation notification to employee (responsible)
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "document_signed",
      title: "Document E-Signature Completed",
      message: `Your signature on "${assignment.templateTitle}" has been successfully verified and saved with cryptographic audit log.`,
      priority: "medium",
      data: {
        documentId: assignment._id.toString(),
        templateId: assignment.templateId.toString(),
        deepLink: `/documents`,
      },
    });

    // 2. Notify manager and assigner (relevant users)
    const empUser = await User.findById(employeeId).select("employment.managerId profile.firstName profile.lastName");
    const empName = `${empUser?.profile?.firstName || ""} ${empUser?.profile?.lastName || ""}`.trim() || payload.signerName || "Employee";
    const mgrId = empUser?.employment?.managerId || (empUser?.employment as any)?.managerUserId;

    if (mgrId && mgrId.toString() !== employeeId.toString()) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: mgrId,
        type: "document_signed",
        title: `Document Signed: ${empName}`,
        message: `${empName} has completed electronic signature for "${assignment.templateTitle}". Cryptographic SHA-256 verified.`,
        priority: "medium",
        data: {
          documentId: assignment._id.toString(),
          employeeId: employeeId.toString(),
          deepLink: `/compliance`,
        },
      }).catch((err) => console.warn("[DocumentService] Manager signed notification error:", err));
    }

    if (assignment.assignedBy && assignment.assignedBy.toString() !== employeeId.toString() && assignment.assignedBy.toString() !== mgrId?.toString()) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: assignment.assignedBy,
        type: "document_signed",
        title: `Document Signed: ${empName}`,
        message: `${empName} has completed electronic signature for "${assignment.templateTitle}".`,
        priority: "medium",
        data: {
          documentId: assignment._id.toString(),
          employeeId: employeeId.toString(),
        },
      }).catch((err) => console.warn("[DocumentService] Assigner signed notification error:", err));
    }

    return assignment;
  }

  /**
   * Get audit signatures for a template
   */
  async getTemplateSignatures(orgId: string | mongoose.Types.ObjectId, templateId: string | mongoose.Types.ObjectId) {
    return DocumentAssignment.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      templateId: new mongoose.Types.ObjectId(templateId),
      status: "signed",
      isDeleted: false,
    })
      .populate("employeeId", "profile.fullName profile.firstName profile.lastName auth.email employment.department")
      .sort({ signedAt: -1 });
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

  /**
   * Enforce UQ-03 Legal Compliance Retention and Document Revocation upon Employee Termination
   */
  async handleEmployeeTermination(
    orgId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId
  ): Promise<{ revokedCount: number; preservedCount: number; legalHoldProtected: boolean }> {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const empObjectId = new mongoose.Types.ObjectId(employeeId.toString());

    const user = await User.findOne({ _id: empObjectId, organizationId: orgObjectId });
    if (user?.compliance?.legalHold) {
      return { revokedCount: 0, preservedCount: 0, legalHoldProtected: true };
    }

    const assignments = await DocumentAssignment.find({
      organizationId: orgObjectId,
      employeeId: empObjectId,
      isDeleted: false,
    });

    let revokedCount = 0;
    let preservedCount = 0;

    for (const assignment of assignments) {
      if (assignment.status === "pending" || assignment.status === "viewed") {
        assignment.status = "revoked";
        assignment.revokedAt = new Date();
        assignment.revokedReason = "employee_terminated";
        assignment.auditTrail.push({
          action: "revoked",
          performedBy: empObjectId,
          timestamp: new Date(),
          details: "Document assignment revoked due to employee termination prior to signature.",
        });
        await assignment.save();
        revokedCount++;
      } else if (assignment.status === "signed") {
        // DO NOT DELETE OR MUTATE cryptographic signature data or rendered content
        assignment.complianceRetention = true;
        assignment.archivedAt = new Date();
        await assignment.save();
        preservedCount++;
      }
    }

    return { revokedCount, preservedCount, legalHoldProtected: false };
  }
}

export const documentService = new DocumentService();
export default documentService;
