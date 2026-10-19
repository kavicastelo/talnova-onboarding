import mongoose from "mongoose";
import Company, { ICompany } from "../models/company.model.js";
import Contact, { IContact } from "../models/contact.model.js";
import Deal, { IDeal } from "../models/deal.model.js";
import SalesTask, { ISalesTask } from "../models/task.model.js";
import CommThread, { ICommThread } from "../models/comm-thread.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import {
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanyQueryParams,
} from "../schemas/company.schemas.js";
import { PaginatedResponse } from "../types/sales.types.js";

export function normalizeDomain(rawDomain: string): string {
  let cleaned = rawDomain.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/^www\./, "");
  cleaned = cleaned.split("/")[0].split("?")[0].split("#")[0];
  return cleaned;
}

export interface Company360Overview {
  company: ICompany;
  contacts: IContact[];
  deals: IDeal[];
  tasks: ISalesTask[];
  threads: ICommThread[];
  metrics: {
    totalContacts: number;
    totalDeals: number;
    openDeals: number;
    wonDeals: number;
    totalPipelineValue: number;
    primaryContact?: IContact;
  };
}

export class CompanyService {
  /**
   * List and filter prospective CRM companies
   */
  public async getCompanies(params: CompanyQueryParams): Promise<PaginatedResponse<ICompany>> {
    const filter: Record<string, any> = {};

    if (params.search) {
      const escaped = params.search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { domain: { $regex: escaped, $options: "i" } },
        { industry: { $regex: escaped, $options: "i" } },
      ];
    }

    if (params.industry) filter.industry = params.industry;
    if (params.tier) filter.tier = params.tier;
    if (params.status) filter.status = params.status;
    if (params.country) filter.country = params.country;
    if (params.ownerId && mongoose.Types.ObjectId.isValid(params.ownerId)) {
      filter.accountOwnerId = new mongoose.Types.ObjectId(params.ownerId);
    }

    const page = params.page || 1;
    const limit = params.limit || 25;
    const skip = (page - 1) * limit;

    const sort: Record<string, any> = {};
    sort[params.sortBy] = params.sortOrder === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      Company.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("accountOwnerId", "name email")
        .populate("convertedOrganizationId", "name slug")
        .lean(),
      Company.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: items as unknown as ICompany[],
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
   * Get single company by ID
   */
  public async getCompanyById(id: string): Promise<ICompany> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid company ID: ${id}`);
    }

    const company = await Company.findById(id)
      .populate("accountOwnerId", "name email")
      .populate("convertedOrganizationId", "name slug");

    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", `Company ${id} not found`);
    }

    return company;
  }

  /**
   * Create new prospective company
   */
  public async createCompany(input: CreateCompanyInput, actorUserId?: string): Promise<ICompany> {
    const domain = normalizeDomain(input.domain || input.website || "");
    if (!domain) {
      throw new AppError(400, "INVALID_DOMAIN", "A valid domain or website URL is required");
    }

    const company = await Company.create({
      ...input,
      domain,
      accountOwnerId: input.accountOwnerId && mongoose.Types.ObjectId.isValid(input.accountOwnerId)
        ? new mongoose.Types.ObjectId(input.accountOwnerId)
        : undefined,
    });

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "COMPANY_CREATED",
        resourceType: "sales_company",
        resourceId: company._id,
        action: "create",
        description: `Created prospective CRM company ${company.name} (${company.domain})`,
        metadata: { companyId: company._id, name: company.name, domain: company.domain },
        severity: "info",
      });
    } catch {}

    return company;
  }

  /**
   * Update existing company
   */
  public async updateCompany(
    id: string,
    updates: UpdateCompanyInput,
    actorUserId?: string
  ): Promise<ICompany> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid company ID: ${id}`);
    }

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", `Company ${id} not found`);
    }

    const updateData: Record<string, any> = { ...updates };
    if (updates.domain) {
      updateData.domain = normalizeDomain(updates.domain);
    }
    if (updates.accountOwnerId) {
      updateData.accountOwnerId = mongoose.Types.ObjectId.isValid(updates.accountOwnerId)
        ? new mongoose.Types.ObjectId(updates.accountOwnerId)
        : undefined;
    }

    const updated = await Company.findByIdAndUpdate(
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
        eventType: "COMPANY_UPDATED",
        resourceType: "sales_company",
        resourceId: company._id,
        action: "update",
        description: `Updated prospective CRM company ${company.name}`,
        metadata: { companyId: company._id, changes: updates },
        severity: "info",
      });
    } catch {}

    return updated!;
  }

  /**
   * Delete company (prevented if active deals exist)
   */
  public async deleteCompany(id: string, actorUserId?: string): Promise<{ success: boolean; id: string }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid company ID: ${id}`);
    }

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", `Company ${id} not found`);
    }

    // Guard: Prevent deletion if active deals exist
    const activeDealsCount = await Deal.countDocuments({
      companyId: company._id,
      stage: { $nin: ["closed_won", "closed_lost"] },
    });

    if (activeDealsCount > 0) {
      throw new AppError(
        400,
        "CANNOT_DELETE_COMPANY_WITH_ACTIVE_DEALS",
        `Cannot delete company '${company.name}' because it has ${activeDealsCount} active deal(s).`
      );
    }

    await Company.findByIdAndDelete(id);

    // Unlink contacts associated with this company
    await Contact.updateMany({ companyId: company._id }, { $unset: { companyId: 1 } });

    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "COMPANY_DELETED",
        resourceType: "sales_company",
        resourceId: company._id,
        action: "delete",
        description: `Deleted prospective CRM company ${company.name}`,
        metadata: { companyId: company._id, name: company.name },
        severity: "info",
      });
    } catch {}

    return { success: true, id };
  }

  /**
   * Fetch complete 360 overview of a company (contacts, deals, tasks, threads, metrics)
   */
  public async getCompany360(id: string): Promise<Company360Overview> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid company ID: ${id}`);
    }

    const company = await Company.findById(id)
      .populate("accountOwnerId", "name email")
      .populate("convertedOrganizationId", "name slug");

    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", `Company ${id} not found`);
    }

    const [contacts, deals, tasks, threads] = await Promise.all([
      Contact.find({ companyId: company._id }).sort({ isPrimaryDecisionMaker: -1, createdAt: -1 }),
      Deal.find({ companyId: company._id }).sort({ createdAt: -1 }),
      SalesTask.find({ companyId: company._id }).sort({ dueDate: 1 }),
      CommThread.find({ companyId: company._id }).sort({ lastMessageAt: -1 }),
    ]);

    const openDeals = deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage));
    const wonDeals = deals.filter((d) => d.stage === "closed_won");
    const totalPipelineValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
    const primaryContact = contacts.find((c) => c.isPrimaryDecisionMaker) || contacts[0];

    return {
      company,
      contacts,
      deals,
      tasks,
      threads,
      metrics: {
        totalContacts: contacts.length,
        totalDeals: deals.length,
        openDeals: openDeals.length,
        wonDeals: wonDeals.length,
        totalPipelineValue,
        primaryContact,
      },
    };
  }

  /**
   * Add note to company
   */
  public async addNote(id: string, content: string, actorUserId?: string): Promise<ICompany> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(400, "INVALID_ID", `Invalid company ID: ${id}`);
    }

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", `Company ${id} not found`);
    }

    company.notes.push({
      content,
      createdBy: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
        ? new mongoose.Types.ObjectId(actorUserId)
        : undefined,
      createdAt: new Date(),
    });

    await company.save();
    return company;
  }
}

export default CompanyService;
