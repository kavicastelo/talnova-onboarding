import mongoose from "mongoose";
import Lead, { ILead } from "../models/lead.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import AppError from "../../../common/errors/app-error.js";
import { normalizeEmail, normalizePhone } from "../utils/normalize.js";
import LeadScoringService from "./lead-scoring.service.js";
import { QueueService } from "../../../infrastructure/queue/queue.service.js";

export interface CsvPreviewResult {
  headers: string[];
  suggestedMapping: Record<string, string>;
  sampleRows: Array<Record<string, string>>;
  sampleMapped: Array<Record<string, any>>;
  totalRows: number;
}

export interface ImportExecuteOptions {
  csvContent: string;
  mapping?: Record<string, string>;
  duplicateStrategy?: "skip" | "overwrite" | "create_duplicate";
  defaultValues?: {
    source?: string;
    assignedOwnerId?: string;
    tags?: string[];
  };
  actorUserId?: string;
  organizationId?: string;
}

export interface ImportExecuteResult {
  batchId: string;
  totalRows: number;
  validRows: number;
  created: number;
  updated: number;
  duplicatesSkipped: number;
  invalidCount: number;
  errors: Array<{ row: number; email?: string; reason: string }>;
}

const CANONICAL_FIELD_SYNONYMS: Record<string, string[]> = {
  name: ["name", "fullname", "full_name", "leadname", "lead_name", "contactname", "contact_name", "person"],
  email: ["email", "emailaddress", "email_address", "workemail", "work_email", "contactemail", "mail"],
  phone: ["phone", "phonenumber", "phone_number", "mobile", "mobilenumber", "telephone", "tel", "cell"],
  whatsapp: ["whatsapp", "whatsappnumber", "wa"],
  companySize: ["companysize", "company_size", "size", "employees", "numberofemployees", "headcount"],
  companyName: ["company", "companyname", "company_name", "organization", "organisation", "org", "business", "account", "accountname"],
  jobTitle: ["title", "jobtitle", "job_title", "role", "position", "designation"],
  industry: ["industry", "sector", "industrysector", "vertical", "domain"],
  country: ["country", "nation", "location"],
  region: ["region", "state", "province", "city"],
  source: ["source", "leadsource", "lead_source", "channel", "acquisition"],
  estimatedBudget: ["budget", "estimatedbudget", "estimated_budget", "dealvalue", "revenue", "annualrevenue"],
  interestedProduct: ["product", "interestedproduct", "service", "solution"],
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Robust CSV string parser handling quotes, escaped quotes, and commas/semicolons/tabs
 */
export function parseCsvRows(rawCsv: string, delimiterOverride?: string): string[][] {
  const cleaned = rawCsv.replace(/^\uFEFF/, "").trim();
  if (!cleaned) return [];

  // Determine delimiter if not specified
  let delimiter = delimiterOverride;
  if (!delimiter) {
    const firstLine = cleaned.split(/\r?\n/)[0] || "";
    let commaCount = 0;
    let semiCount = 0;
    let tabCount = 0;
    let insideQuote = false;

    for (const char of firstLine) {
      if (char === '"') insideQuote = !insideQuote;
      else if (!insideQuote) {
        if (char === ",") commaCount++;
        else if (char === ";") semiCount++;
        else if (char === "\t") tabCount++;
      }
    }

    if (semiCount > commaCount && semiCount > tabCount) delimiter = ";";
    else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";
    else delimiter = ",";
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < cleaned.length) {
    const char = cleaned[i];

    if (char === '"') {
      if (inQuotes && cleaned[i + 1] === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i++;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      i++;
      continue;
    }

    if ((char === "\r" || char === "\n") && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      if (currentRow.some((field) => field.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      if (char === "\r" && cleaned[i + 1] === "\n") i++;
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  // Final field and row
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Auto-detect canonical field mapping for a list of CSV headers
 */
export function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    let matchedCanonical: string | null = null;

    // Pass 1: Exact synonym match
    for (const [canonicalField, synonyms] of Object.entries(CANONICAL_FIELD_SYNONYMS)) {
      for (const synonym of synonyms) {
        const normalizedSynonym = synonym.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normalized === normalizedSynonym) {
          matchedCanonical = canonicalField;
          break;
        }
      }
      if (matchedCanonical) break;
    }

    // Pass 2: Prefix / contains match for unambiguous compound headers
    if (!matchedCanonical) {
      for (const [canonicalField, synonyms] of Object.entries(CANONICAL_FIELD_SYNONYMS)) {
        for (const synonym of synonyms) {
          const normalizedSynonym = synonym.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (normalizedSynonym.length >= 4 && normalized.includes(normalizedSynonym)) {
            matchedCanonical = canonicalField;
            break;
          }
        }
        if (matchedCanonical) break;
      }
    }

    if (matchedCanonical) {
      mapping[header] = matchedCanonical;
    }
  }

  return mapping;
}

export class LeadImportService {
  private scoringService = new LeadScoringService();
  private queue = QueueService.getInstance();

  /**
   * Preview CSV headers and top 10 rows with suggested field auto-mapping
   */
  public parsePreview(rawCsv: string): CsvPreviewResult {
    const rows = parseCsvRows(rawCsv);
    if (rows.length === 0) {
      throw new AppError(400, "EMPTY_CSV", "CSV content is empty or contains no records");
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const suggestedMapping = autoMapHeaders(headers);

    const sampleDataRows = dataRows.slice(0, 10);
    const sampleRows: Array<Record<string, string>> = [];
    const sampleMapped: Array<Record<string, any>> = [];

    for (const row of sampleDataRows) {
      const rawObj: Record<string, string> = {};
      const mappedObj: Record<string, any> = {};

      headers.forEach((header, idx) => {
        const val = row[idx] || "";
        rawObj[header] = val;

        const targetField = suggestedMapping[header];
        if (targetField && val) {
          if (targetField === "estimatedBudget") {
            const num = parseFloat(val.replace(/[^0-9.]/g, ""));
            mappedObj[targetField] = isNaN(num) ? undefined : num;
          } else {
            mappedObj[targetField] = val;
          }
        }
      });

      sampleRows.push(rawObj);
      sampleMapped.push(mappedObj);
    }

    return {
      headers,
      suggestedMapping,
      sampleRows,
      sampleMapped,
      totalRows: dataRows.length,
    };
  }

  /**
   * Execute lead import with validation, duplicate resolution strategy, and audit logging
   */
  public async executeImport(options: ImportExecuteOptions): Promise<ImportExecuteResult> {
    const {
      csvContent,
      mapping = {},
      duplicateStrategy = "skip",
      defaultValues = {},
      actorUserId,
    } = options;

    const rows = parseCsvRows(csvContent);
    if (rows.length <= 1) {
      throw new AppError(400, "EMPTY_CSV", "CSV must contain a header row and at least one data row");
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const batchId = new mongoose.Types.ObjectId().toString();

    // Determine final mapping: provided mapping merged with auto-mapped
    const activeMapping = { ...autoMapHeaders(headers), ...mapping };

    let created = 0;
    let updated = 0;
    let duplicatesSkipped = 0;
    let invalidCount = 0;
    const errors: Array<{ row: number; email?: string; reason: string }> = [];

    for (let idx = 0; idx < dataRows.length; idx++) {
      const row = dataRows[idx];
      const rowNum = idx + 2; // Row 1 is header

      const rowData: Record<string, any> = {};
      headers.forEach((header, colIdx) => {
        const targetField = activeMapping[header];
        const val = row[colIdx] ? row[colIdx].trim() : "";
        if (targetField && val) {
          if (targetField === "estimatedBudget") {
            const num = parseFloat(val.replace(/[^0-9.]/g, ""));
            rowData[targetField] = isNaN(num) ? undefined : num;
          } else {
            rowData[targetField] = val;
          }
        }
      });

      // Validation
      const email = rowData.email ? rowData.email.trim() : "";
      const name = rowData.name ? rowData.name.trim() : "";
      let companyName = rowData.companyName ? rowData.companyName.trim() : "";

      if (!email) {
        errors.push({ row: rowNum, reason: "Missing required field 'email'" });
        invalidCount++;
        continue;
      }

      if (!EMAIL_REGEX.test(email)) {
        errors.push({ row: rowNum, email, reason: `Invalid email format '${email}'` });
        invalidCount++;
        continue;
      }

      if (!name) {
        errors.push({ row: rowNum, email, reason: "Missing required field 'name'" });
        invalidCount++;
        continue;
      }

      if (!companyName) {
        // Derive company name from email domain if possible
        const domain = email.split("@")[1];
        if (domain && !domain.includes("gmail") && !domain.includes("yahoo") && !domain.includes("outlook")) {
          companyName = domain.split(".")[0];
          companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1);
        } else {
          errors.push({ row: rowNum, email, reason: "Missing required field 'companyName'" });
          invalidCount++;
          continue;
        }
      }

      const normalizedEmail = normalizeEmail(email);
      const normalizedPhone = rowData.phone ? normalizePhone(rowData.phone) : undefined;

      // Duplicate Check
      const duplicateQuery: any = { normalizedEmail };
      if (normalizedPhone) {
        duplicateQuery.$or = [{ normalizedEmail }, { normalizedPhone }];
        delete duplicateQuery.normalizedEmail;
      }

      const existingLead = await Lead.findOne(duplicateQuery);

      if (existingLead) {
        if (duplicateStrategy === "skip") {
          duplicatesSkipped++;
          continue;
        }

        if (duplicateStrategy === "overwrite") {
          // Overwrite with non-empty incoming fields
          existingLead.name = name;
          existingLead.companyName = companyName;
          if (rowData.phone) {
            existingLead.phone = rowData.phone;
            existingLead.normalizedPhone = normalizedPhone;
          }
          if (rowData.jobTitle) existingLead.jobTitle = rowData.jobTitle;
          if (rowData.industry) existingLead.industry = rowData.industry;
          if (rowData.companySize) existingLead.companySize = rowData.companySize;
          if (rowData.country) existingLead.country = rowData.country;
          if (rowData.region) existingLead.region = rowData.region;
          if (rowData.estimatedBudget) existingLead.estimatedBudget = rowData.estimatedBudget;
          if (rowData.interestedProduct) existingLead.interestedProduct = rowData.interestedProduct;

          await existingLead.save();
          await this.scoringService.recalculateLeadScore(existingLead._id.toString());
          updated++;
          continue;
        }

        // If duplicateStrategy === "create_duplicate", proceed to create
      }

      // Create New Lead
      const newLead = await Lead.create({
        name,
        email,
        normalizedEmail,
        phone: rowData.phone || undefined,
        normalizedPhone: normalizedPhone || undefined,
        whatsapp: rowData.whatsapp || undefined,
        companyName,
        jobTitle: rowData.jobTitle || undefined,
        industry: rowData.industry || undefined,
        companySize: rowData.companySize || undefined,
        country: rowData.country || undefined,
        region: rowData.region || undefined,
        source: (rowData.source as any) || defaultValues.source || "import",
        sourceDetails: `Imported via Batch ${batchId}`,
        status: "new",
        score: 0,
        priority: "normal",
        estimatedBudget: rowData.estimatedBudget || undefined,
        interestedProduct: rowData.interestedProduct || undefined,
        assignedOwnerId: defaultValues.assignedOwnerId
          ? new mongoose.Types.ObjectId(defaultValues.assignedOwnerId)
          : undefined,
        tags: defaultValues.tags || ["csv-import"],
      });

      await this.scoringService.recalculateLeadScore(newLead._id.toString());
      created++;
    }

    const validRows = created + updated + duplicatesSkipped;

    // Record Audit Log
    try {
      await AuditLog.create({
        actorUserId: actorUserId && mongoose.Types.ObjectId.isValid(actorUserId)
          ? new mongoose.Types.ObjectId(actorUserId)
          : undefined,
        actorType: actorUserId ? "user" : "system",
        eventCategory: "admin",
        eventType: "LEAD_IMPORT_BATCH",
        resourceType: "sales_lead",
        resourceId: new mongoose.Types.ObjectId(),
        action: "create",
        description: `Import batch ${batchId} completed: ${created} created, ${updated} updated, ${duplicatesSkipped} duplicates skipped, ${invalidCount} invalid rows.`,
        metadata: {
          batchId,
          totalRows: dataRows.length,
          validRows,
          created,
          updated,
          duplicatesSkipped,
          invalidCount,
          errorsCount: errors.length,
          duplicateStrategy,
        },
        severity: errors.length > 0 ? "warning" : "info",
      });
    } catch {}

    return {
      batchId,
      totalRows: dataRows.length,
      validRows,
      created,
      updated,
      duplicatesSkipped,
      invalidCount,
      errors,
    };
  }
}

export default LeadImportService;
