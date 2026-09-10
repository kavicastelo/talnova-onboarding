import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import { Certificate } from "../models/certificate.model.js";

export class CertificateController {
  getMyCertificates = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    if (!user) {
      return reply.status(401).send({
        success: false,
        message: "Unauthorized",
      });
    }

    try {
      const rawId = user.userId || user.id || user._id;
      if (!rawId) {
        return reply.status(200).send({
          success: true,
          data: { certificates: [] },
        });
      }
      const userObjectId = new mongoose.Types.ObjectId(rawId);
      const certificates = await Certificate.find({
        employeeId: userObjectId,
        status: "active",
      }).sort({ createdAt: -1 });

      return reply.status(200).send({
        success: true,
        data: {
          certificates: certificates.map((cert) => ({
            id: cert._id,
            _id: cert._id,
            certificateNumber: cert.certificateNumber,
            certificateId: cert.certificateNumber,
            recipientName: cert.recipientName,
            organizationName: cert.organizationName,
            journeyTitle: cert.journeyTitle,
            issueDate: cert.issueDate,
            completionDate: cert.completionDate,
            sha256Signature: cert.sha256Signature,
            status: cert.status,
          })),
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: "Failed to retrieve certificates",
      });
    }
  };

  getPublicCertificate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    if (!id) {
      return reply.status(404).send({
        success: false,
        message: "No certificates found",
      });
    }

    try {
      let certificate: any = null;

      if (mongoose.Types.ObjectId.isValid(id)) {
        certificate = await Certificate.findOne({
          $or: [
            { _id: new mongoose.Types.ObjectId(id) },
            { assignmentId: new mongoose.Types.ObjectId(id) },
          ],
          status: "active",
        });
      }

      if (!certificate) {
        certificate = await Certificate.findOne({
          certificateNumber: id,
          status: "active",
        });
      }

      if (!certificate) {
        // Fallback: check EmployeeAssignment if issued
        if (mongoose.Types.ObjectId.isValid(id)) {
          const assignment: any = await mongoose
            .model("EmployeeAssignment")
            .findById(id);
          if (assignment && assignment.status === "completed" && assignment.certificate?.issued) {
            const employee: any = await mongoose.model("User").findById(assignment.employeeId);
            const org: any = await mongoose.model("Organization").findById(assignment.organizationId);

            return reply.status(200).send({
              success: true,
              message: "Certificate verified successfully",
              data: {
                id: assignment._id,
                certificateNumber: assignment.certificate.certificateId?.toString() || assignment._id.toString(),
                certificateId: assignment.certificate.certificateId?.toString() || assignment._id.toString(),
                recipientName:
                  employee?.profile?.fullName ||
                  `${employee?.profile?.firstName || ""} ${employee?.profile?.lastName || ""}`.trim() ||
                  "Employee",
                organizationName: org?.name || "Talnova Onboarding",
                journeyTitle: assignment.journey?.title || "Onboarding Journey",
                issueDate: assignment.certificate.issuedAt || assignment.completedAt || assignment.updatedAt,
                completionDate: assignment.completedAt || assignment.updatedAt,
                sha256Signature: assignment.certificate.sha256Signature || "LEGACY_VERIFIED_SIGNATURE",
                status: "active",
                verified: true,
                branding: {
                  orgName: org?.name || "Talnova Onboarding",
                  primaryColor: org?.branding?.primaryColor || "#4F46E5",
                  logoUrl: org?.branding?.logo?.publicUrl || "",
                },
                certificate: org?.certificate || { template: "classic" },
              },
            });
          }
        }

        return reply.status(404).send({
          success: false,
          message: "No certificates found",
        });
      }

      const org: any = await mongoose.model("Organization").findById(certificate.organizationId);

      // Sanitize payload strictly: hide sensitive user metadata, email, and password hashes
      return reply.status(200).send({
        success: true,
        message: "Certificate verified successfully",
        data: {
          id: certificate._id,
          certificateNumber: certificate.certificateNumber,
          certificateId: certificate.certificateNumber,
          recipientName: certificate.recipientName,
          organizationName: certificate.organizationName || org?.name || "Talnova Onboarding",
          journeyTitle: certificate.journeyTitle,
          issueDate: certificate.issueDate,
          completionDate: certificate.completionDate,
          sha256Signature: certificate.sha256Signature,
          status: certificate.status,
          verified: true,
          branding: {
            orgName: org?.name || certificate.organizationName || "Talnova Onboarding",
            primaryColor: org?.branding?.primaryColor || "#4F46E5",
            logoUrl: org?.branding?.logo?.publicUrl || "",
          },
          certificate: org?.certificate || { template: "classic" },
        },
      });
    } catch (error) {
      return reply.status(404).send({
        success: false,
        message: "No certificates found",
      });
    }
  };
}
