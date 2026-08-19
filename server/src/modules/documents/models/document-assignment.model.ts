import mongoose, { Schema, Document } from "mongoose";

export interface ISignatureData {
  type: "draw" | "type";
  signatureDataUrl?: string;
  signerName: string;
  signedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  sha256Hash: string; // Cryptographic integrity checksum
}

export interface IDocumentAuditEntry {
  action: "assigned" | "viewed" | "signed" | "declined";
  performedBy: mongoose.Types.ObjectId;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}

export interface IDocumentAssignment extends Document {
  organizationId: mongoose.Types.ObjectId;
  templateId: mongoose.Types.ObjectId;
  templateTitle: string;
  templateVersion: number;
  employeeId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  status: "pending" | "viewed" | "signed" | "declined" | "expired";
  assignedAt: Date;
  dueDate?: Date;
  signedAt?: Date;
  declinedAt?: Date;
  declineReason?: string;
  renderedContent?: string; // Content with interpolated user fields
  signatureData?: ISignatureData;
  auditTrail: IDocumentAuditEntry[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SignatureDataSchema = new Schema({
  type: { type: String, enum: ["draw", "type"], required: true },
  signatureDataUrl: { type: String },
  signerName: { type: String, required: true },
  signedAt: { type: Date, required: true },
  ipAddress: { type: String },
  userAgent: { type: String },
  sha256Hash: { type: String, required: true },
});

const DocumentAuditEntrySchema = new Schema({
  action: { type: String, enum: ["assigned", "viewed", "signed", "declined"], required: true },
  performedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  timestamp: { type: Date, required: true, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
  details: { type: String },
});

const DocumentAssignmentSchema = new Schema<IDocumentAssignment>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    templateId: { type: Schema.Types.ObjectId, required: true, ref: "DocumentTemplate" },
    templateTitle: { type: String, required: true },
    templateVersion: { type: Number, required: true, default: 1 },
    employeeId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    status: {
      type: String,
      enum: ["pending", "viewed", "signed", "declined", "expired"],
      default: "pending",
    },
    assignedAt: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date },
    signedAt: { type: Date },
    declinedAt: { type: Date },
    declineReason: { type: String },
    renderedContent: { type: String },
    signatureData: { type: SignatureDataSchema },
    auditTrail: { type: [DocumentAuditEntrySchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

DocumentAssignmentSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
DocumentAssignmentSchema.index({ organizationId: 1, templateId: 1 });

export const DocumentAssignment = mongoose.model<IDocumentAssignment>("DocumentAssignment", DocumentAssignmentSchema);
export default DocumentAssignment;
