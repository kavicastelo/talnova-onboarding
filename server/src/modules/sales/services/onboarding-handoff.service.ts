import mongoose from "mongoose";
import Deal, { IDeal } from "../models/deal.model.js";
import Company, { ICompany } from "../models/company.model.js";
import Contact, { IContact } from "../models/contact.model.js";
import Package, { IPackage } from "../../super-admin/models/package.model.js";
import { Organization, IOrganization } from "../../organizations/models/organization.model.js";
import OrganizationRepository from "../../organizations/repositories/organization.repository.js";
import OrganizationService from "../../organizations/services/organization.service.js";
import CustomerAccount, { ICustomerAccount } from "../../super-admin/models/customer-account.model.js";
import User, { IUser } from "../../auth/models/user.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import { EventBus } from "../../../infrastructure/events/event-bus.js";
import AppError from "../../../common/errors/app-error.js";

export interface HandoffOptions {
  organizationName?: string;
  adminEmail?: string;
  notes?: string;
}

export interface HandoffResult {
  dealId: string;
  organizationId: string;
  customerAccountId: string;
  ownerUserId?: string;
  packageName: string;
  alreadyCompleted?: boolean;
}

export class OnboardingHandoffService {
  private readonly orgService: OrganizationService;
  private readonly eventBus: EventBus;

  constructor(
    orgService?: OrganizationService,
    eventBus?: EventBus
  ) {
    this.orgService = orgService || new OrganizationService(new OrganizationRepository());
    this.eventBus = eventBus || EventBus.getInstance();
  }

  /**
   * Bridges a closed-won sales deal into an active platform Organization,
   * provisions the Super Admin Finance CustomerAccount, links back to company/deal,
   * logs audit trails, and emits event bus notifications.
   */
  public async handoffDeal(
    dealId: string,
    actorId?: string,
    options?: HandoffOptions
  ): Promise<HandoffResult> {
    if (!dealId || !mongoose.Types.ObjectId.isValid(dealId)) {
      throw new AppError(400, "INVALID_DEAL_ID", "A valid deal ID is required for onboarding handoff");
    }

    const deal = await Deal.findById(dealId);
    if (!deal) {
      throw new AppError(404, "DEAL_NOT_FOUND", "Sales deal not found");
    }

    // 1. Idempotency safeguard: if already handed off and org linked, return existing without re-provisioning
    if (deal.wonDetails?.onboardingHandedOff && deal.wonDetails?.organizationId) {
      const existingOrgId = deal.wonDetails.organizationId;
      const existingAccount = await CustomerAccount.findOne({ organizationId: existingOrgId });
      const existingOrg = await Organization.findById(existingOrgId);
      const existingOwner = await User.findOne({ organizationId: existingOrgId, "permissions.role": "owner" });

      return {
        dealId: deal._id.toString(),
        organizationId: existingOrgId.toString(),
        customerAccountId: existingAccount?._id.toString() || "",
        ownerUserId: existingOwner?._id.toString(),
        packageName: existingOrg?.plan || "",
        alreadyCompleted: true,
      };
    }

    // 2. Validate Deal readiness: Package ID and Primary Contact
    if (!deal.packageId) {
      throw new AppError(
        400,
        "MISSING_PACKAGE_ID",
        "Deal must have an assigned package before handing off to enterprise onboarding"
      );
    }

    const pkg = await Package.findById(deal.packageId);
    if (!pkg) {
      throw new AppError(404, "PACKAGE_NOT_FOUND", "Assigned package could not be found");
    }

    if (!deal.primaryContactId) {
      throw new AppError(
        400,
        "MISSING_PRIMARY_CONTACT",
        "Deal must have an assigned primary contact before handing off to enterprise onboarding"
      );
    }

    const contact = await Contact.findById(deal.primaryContactId);
    if (!contact || !contact.email || !contact.email.trim()) {
      throw new AppError(
        400,
        "INVALID_PRIMARY_CONTACT",
        "Primary contact with a valid email address is required for onboarding handoff"
      );
    }

    // 3. Validate Associated Company
    const company = await Company.findById(deal.companyId);
    if (!company) {
      throw new AppError(404, "COMPANY_NOT_FOUND", "Associated sales company not found");
    }

    // 4. Resolve Target Organization Attributes
    const targetAdminEmail = (options?.adminEmail || contact.email).toLowerCase().trim();
    const targetOrgName = (options?.organizationName || company.name || deal.name).trim();
    const targetDomain = company.domain ? company.domain.toLowerCase().trim() : undefined;

    // 5. Wrap state updates in a Mongoose Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let finalOrg: IOrganization;
    let customerAccount: ICustomerAccount | null = null;
    let ownerUserId: string | undefined;

    try {
      // Check if an organization is already linked or existing by domain/slug
      let existingOrg: IOrganization | null = null;

      if (deal.wonDetails?.organizationId) {
        existingOrg = await Organization.findById(deal.wonDetails.organizationId).session(session);
      }
      if (!existingOrg && company.convertedOrganizationId) {
        existingOrg = await Organization.findById(company.convertedOrganizationId).session(session);
      }
      if (!existingOrg && targetDomain) {
        existingOrg = await Organization.findOne({ domain: targetDomain, isDeleted: false }).session(session);
      }

      if (existingOrg) {
        finalOrg = existingOrg;
        // Synchronize package if missing or updated
        if (!finalOrg.packageId || finalOrg.packageId.toString() !== pkg._id.toString()) {
          finalOrg.packageId = pkg._id;
          finalOrg.packageSlug = pkg.slug;
          finalOrg.plan = pkg.name;
          if (finalOrg.subscription) {
            finalOrg.subscription.packageId = pkg._id;
            finalOrg.subscription.packageSlug = pkg.slug;
            finalOrg.subscription.packageName = pkg.name;
            finalOrg.subscription.plan = pkg.name;
          }
          await finalOrg.save({ session });
        }
      } else {
        // Compute unique slug
        const rawSlug = (targetDomain ? targetDomain.replace(/\./g, "-") : targetOrgName.toLowerCase().replace(/[^a-z0-9]/g, "-"))
          .replace(/^-+|-+$/g, "") || "org";
        let uniqueSlug = rawSlug;
        let counter = 1;
        while (await Organization.findOne({ slug: uniqueSlug, isDeleted: false }).session(session)) {
          uniqueSlug = `${rawSlug}-${counter++}`;
        }

        // Call OrganizationService.createOrganization with primary contact as Owner
        finalOrg = await this.orgService.createOrganization(
          {
            name: targetOrgName,
            slug: uniqueSlug,
            domain: targetDomain,
            plan: pkg.name,
            packageId: pkg._id,
            packageSlug: pkg.slug,
            supportEmail: targetAdminEmail,
            createdBy: actorId,
            status: "Active",
            ownerEmail: targetAdminEmail,
            ownerFirstName: contact.firstName,
            ownerLastName: contact.lastName,
            limits: {
              maxUsers: pkg.limits?.maxUsers || 50,
              maxStorageGb: pkg.limits?.maxStorageGb || 10,
              maxJourneys: pkg.limits?.maxJourneys || 20,
              maxKiosks: pkg.limits?.maxKiosks || 5,
              aiTokenMonthlyLimit: pkg.limits?.aiTokenMonthlyLimit || 500000,
            },
            subscription: {
              packageId: pkg._id,
              packageSlug: pkg.slug,
              packageName: pkg.name,
              plan: pkg.name,
              status: "active",
              billingInterval: "annual",
              basePrice: deal.annualRecurringRevenue || deal.value || pkg.billing?.basePriceAnnual || 0,
              finalPrice: deal.annualRecurringRevenue || deal.value || 0,
              currency: deal.currency || "USD",
              seatLimit: pkg.limits?.maxUsers || 50,
            },
          },
          session
        );
      }

      const orgId = finalOrg._id;

      // Ensure Owner User is identified
      const ownerUser = await User.findOne({
        organizationId: orgId,
        "auth.email": targetAdminEmail,
      }).session(session);
      if (ownerUser) {
        ownerUserId = ownerUser._id.toString();
      }

      // 6. Create CustomerAccount in Super Admin Finance if not already present
      customerAccount = await CustomerAccount.findOne({ organizationId: orgId }).session(session);
      if (!customerAccount) {
        const [newAcc] = await CustomerAccount.create(
          [
            {
              organizationId: orgId,
              accountStatus: "good_standing",
              billingCycle: "annual",
              preferredCurrency: (deal.currency || "USD").toUpperCase(),
              creditLimit: 0,
              billingContact: {
                name: contact.fullName || `${contact.firstName} ${contact.lastName}`.trim(),
                email: targetAdminEmail,
                phone: contact.phone || "",
                address: company.country || "",
              },
              commercialNotes: `Provisioned from Won Deal: ${deal.name} (Deal ID: ${deal._id})`,
            },
          ],
          { session }
        );
        customerAccount = newAcc;
      }

      // 7. Link organizationId back to sales_deals
      deal.stage = "closed_won";
      deal.probability = 1.0;
      deal.actualCloseDate = deal.actualCloseDate || new Date();
      deal.wonDetails = {
        contractSignedDate: deal.wonDetails?.contractSignedDate || new Date(),
        approvedBy:
          actorId && mongoose.Types.ObjectId.isValid(actorId)
            ? new mongoose.Types.ObjectId(actorId)
            : deal.wonDetails?.approvedBy,
        onboardingHandedOff: true,
        handoffDate: new Date(),
        organizationId: orgId,
      };
      await deal.save({ session });

      // 8. Link organizationId back to sales_companies
      company.status = "customer";
      company.convertedOrganizationId = orgId;
      await company.save({ session });

      // Commit transaction
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    // 9. Post-commit: Log Audit trail
    try {
      await AuditLog.create({
        organizationId: finalOrg._id,
        actorUserId:
          actorId && mongoose.Types.ObjectId.isValid(actorId)
            ? new mongoose.Types.ObjectId(actorId)
            : undefined,
        actorType: actorId ? "user" : "system",
        eventCategory: "sales",
        eventType: "HANDOFF_INITIATED",
        resourceType: "sales_deal",
        resourceId: deal._id,
        action: "status_change",
        description: `Enterprise onboarding handoff completed for deal '${deal.name}' into organization '${finalOrg.name}'`,
        metadata: {
          dealId: deal._id,
          organizationId: finalOrg._id,
          companyId: company._id,
          customerAccountId: customerAccount?._id,
          packageName: pkg.name,
          ownerEmail: targetAdminEmail,
        },
        severity: "info",
      });
    } catch {
      // Non-fatal
    }

    // 10. Post-commit: Emit EventBus events
    try {
      await this.eventBus.publish({
        eventName: "sales.deal.won",
        organizationId: finalOrg._id,
        actorId,
        entityId: deal._id,
        payload: {
          dealId: deal._id,
          dealName: deal.name,
          value: deal.value,
          currency: deal.currency,
          companyId: company._id,
          organizationId: finalOrg._id,
          packageId: pkg._id,
          packageName: pkg.name,
        },
      });

      await this.eventBus.publish({
        eventName: "sales.onboarding.handoff_initiated",
        organizationId: finalOrg._id,
        actorId,
        entityId: deal._id,
        payload: {
          dealId: deal._id,
          dealName: deal.name,
          companyId: company._id,
          companyName: company.name,
          organizationId: finalOrg._id,
          contactId: contact._id,
          contactEmail: targetAdminEmail,
          packageId: pkg._id,
          packageName: pkg.name,
          customerAccountId: customerAccount?._id,
        },
      });
    } catch {
      // Event emission errors should not fail the API response
    }

    return {
      dealId: deal._id.toString(),
      organizationId: finalOrg._id.toString(),
      customerAccountId: customerAccount?._id.toString() || "",
      ownerUserId,
      packageName: pkg.name,
      alreadyCompleted: false,
    };
  }
}

export default OnboardingHandoffService;
