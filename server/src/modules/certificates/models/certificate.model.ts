import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";

export function generateCertificateSignature(
  certificateNumber: string,
  employeeId: string,
  organizationId: string,
  issueDate: Date | string
): string {
  const dateStr = typeof issueDate === "string" ? issueDate : issueDate.toISOString();
  const raw = `${certificateNumber}:${employeeId}:${organizationId}:${dateStr}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function verifyCertificateSignature(
  certificateNumber: string,
  employeeId: string,
  organizationId: string,
  issueDate: Date | string,
  signature: string
): boolean {
  return generateCertificateSignature(certificateNumber, employeeId, organizationId, issueDate) === signature;
}

export interface ICertificate extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  assignmentId?: mongoose.Types.ObjectId;
  certificateNumber: string;
  recipientName: string;
  organizationName: string;
  journeyTitle: string;
  issueDate: Date;
  completionDate: Date;
  sha256Signature: string;
  status: "active" | "revoked";
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateSchema = new Schema<ICertificate>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignmentId: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeAssignment",
      index: true,
    },
    certificateNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    organizationName: {
      type: String,
      required: true,
      trim: true,
    },
    journeyTitle: {
      type: String,
      required: true,
      trim: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    completionDate: {
      type: Date,
      default: Date.now,
    },
    sha256Signature: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const Certificate =
  (mongoose.models.Certificate as mongoose.Model<ICertificate>) ||
  mongoose.model<ICertificate>("Certificate", CertificateSchema);
