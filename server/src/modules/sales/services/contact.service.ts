import mongoose from "mongoose";
import Contact, { IContact } from "../models/contact.model.js";
import Company from "../models/company.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import { normalizeEmail, normalizePhone } from "../utils/normalize.js";
import {
  CreateContactInput,
  UpdateContactInput,
  ContactQueryParams,
} from "../schemas/contact.schemas.js";
import { PaginatedResponse } from "../types/sales.types.js";

export class ContactService {
  /**
   * List and filter CRM contacts
   */
  public async getContacts(params: ContactQueryParams): Promise<PaginatedResponse<IContact>> {
    const filter: Record<string, any> = {};

    if (params.search) {
      const escaped = params.search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      filter.$or = [
        { fullName: { $regex: escaped, $options: "i" } },
        { normalizedEmail: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
      ];
    }

    if (params.companyId && mongoose.Types.ObjectId.isValid(params.companyId)) {
      filter.companyId = new mongoose.Types.ObjectId(params.companyId);
    }
    if (params.role) filter.role = params.role;
    if (params.isPrimary !== undefined) filter.isPrimaryDecisionMaker = params.isPrimary;

    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const sort: Record<string, any> = {};
    sort[params.sortBy] = params.sortOrder === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      Contact.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("companyId", "name domain tier status")
        .lean(),
      Contact.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items as unknown as IContact[],
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single contact by ID
   */
  public async getContactById(id: string): Promise<IContact> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid contact ID: ${id}`);
    }

    const contact = await Contact.findById(id).populate("companyId", "name domain tier status");
    if (!contact) {
      throw new AppError(404, "CONTACT_NOT_FOUND", `Contact ${id} not found`);
    }

    return contact;
  }

  /**
   * Create new CRM contact
   */
  public async createContact(input: CreateContactInput, actorUserId?: string): Promise<IContact> {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedPhone = input.phone ? normalizePhone(input.phone) : undefined;
    const fullName = `${input.firstName} ${input.lastName}`.trim();

    const companyId = input.companyId && mongoose.Types.ObjectId.isValid(input.companyId)
      ? new mongoose.Types.ObjectId(input.companyId)
      : undefined;

    if (companyId) {
      const companyExists = await Company.exists({ _id: companyId });
      if (!companyExists) {
        throw new AppError(404, "COMPANY_NOT_FOUND", `Associated company ${companyId} not found`);
      }
    }

    // If marked as primary decision maker, unset others in the same company
    if (input.isPrimaryDecisionMaker && companyId) {
      await Contact.updateMany(
        { companyId, isPrimaryDecisionMaker: true },
        { $set: { isPrimaryDecisionMaker: false } }
      );
    }

    const contact = await Contact.create({
      ...input,
      fullName,
      normalizedEmail,
      normalizedPhone,
      companyId,
    });

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "CONTACT_CREATED",
        resourceType: "sales_contact",
        resourceId: contact._id,
        action: "create",
        description: `Created CRM contact ${contact.fullName} (${contact.email})`,
        metadata: { contactId: contact._id, fullName: contact.fullName, companyId },
        severity: "info",
      });
    } catch {}

    return contact;
  }

  /**
   * Update existing contact
   */
  public async updateContact(
    id: string,
    updates: UpdateContactInput,
    actorUserId?: string
  ): Promise<IContact> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid contact ID: ${id}`);
    }

    const contact = await Contact.findById(id);
    if (!contact) {
      throw new AppError(404, "CONTACT_NOT_FOUND", `Contact ${id} not found`);
    }

    const updateData: Record<string, any> = { ...updates };

    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      const first = updates.firstName ?? contact.firstName;
      const last = updates.lastName ?? contact.lastName;
      updateData.fullName = `${first} ${last}`.trim();
    }

    if (updates.email) {
      updateData.normalizedEmail = normalizeEmail(updates.email);
    }
    if (updates.phone !== undefined) {
      updateData.normalizedPhone = updates.phone ? normalizePhone(updates.phone) : undefined;
    }

    if (updates.companyId) {
      if (mongoose.Types.ObjectId.isValid(updates.companyId)) {
        updateData.companyId = new mongoose.Types.ObjectId(updates.companyId);
      }
    }

    const targetCompanyId = updateData.companyId || contact.companyId;

    if (updates.isPrimaryDecisionMaker && targetCompanyId) {
      await Contact.updateMany(
        { companyId: targetCompanyId, _id: { $ne: contact._id }, isPrimaryDecisionMaker: true },
        { $set: { isPrimaryDecisionMaker: false } }
      );
    }

    const updated = await Contact.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "CONTACT_UPDATED",
        resourceType: "sales_contact",
        resourceId: contact._id,
        action: "update",
        description: `Updated CRM contact ${contact.fullName}`,
        metadata: { contactId: contact._id, changes: updates },
        severity: "info",
      });
    } catch {}

    return updated!;
  }

  /**
   * Delete contact
   */
  public async deleteContact(id: string, actorUserId?: string): Promise<{ success: boolean; id: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid contact ID: ${id}`);
    }

    const contact = await Contact.findById(id);
    if (!contact) {
      throw new AppError(404, "CONTACT_NOT_FOUND", `Contact ${id} not found`);
    }

    await Contact.findByIdAndDelete(id);

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "CONTACT_DELETED",
        resourceType: "sales_contact",
        resourceId: contact._id,
        action: "delete",
        description: `Deleted CRM contact ${contact.fullName}`,
        metadata: { contactId: contact._id, fullName: contact.fullName },
        severity: "info",
      });
    } catch {}

    return { success: true, id };
  }
}

export default ContactService;
