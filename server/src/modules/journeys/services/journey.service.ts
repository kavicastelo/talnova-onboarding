import JourneyRepository, { JourneyFilter, PaginationOptions } from "../repositories/journey.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";

export class JourneyService {
  constructor(private readonly journeyRepository: JourneyRepository) {}

  private slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars
      .replace(/\-\-+/g, "-"); // Replace multiple - with single -
  }

  async getJourney(id: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    const journey = await this.journeyRepository.findByIdAndOrg(id, orgId);
    if (!journey) {
      throw new AppError(404, "NOT_FOUND", "Journey not found");
    }
    return journey;
  }

  async listJourneys(filter: JourneyFilter, pagination: PaginationOptions) {
    return this.journeyRepository.find(filter, pagination);
  }

  async createJourney(
    orgId: string | mongoose.Types.ObjectId,
    journeyData: { title: string; description: string; category?: string; tags?: string[] },
    userId: string | mongoose.Types.ObjectId
  ) {
    const slug = this.slugify(journeyData.title) + "-" + Math.random().toString(36).substring(2, 6);
    
    const newJourney = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      title: journeyData.title,
      slug,
      description: journeyData.description,
      category: journeyData.category,
      tags: journeyData.tags || [],
      audience: {},
      modules: [],
      certificate: { enabled: false },
      publishing: { status: "draft" as const, version: 1 },
      analytics: {
        totalAssignments: 0,
        totalCompletions: 0,
        completionRate: 0,
        averageScore: 0,
        averageDurationMinutes: 0,
      },
      settings: {
        allowSkipLessons: false,
        requireSequentialCompletion: true,
        allowRetakes: true,
      },
      createdBy: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    };

    return this.journeyRepository.create(newJourney as any);
  }

  async updateJourney(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    updateData: any,
    userId: string | mongoose.Types.ObjectId
  ) {
    const journey = await this.getJourney(id, orgId);

    // If title changes, update slug
    if (updateData.title && updateData.title !== journey.title) {
      updateData.slug = this.slugify(updateData.title) + "-" + Math.random().toString(36).substring(2, 6);
    }

    updateData.updatedBy = new mongoose.Types.ObjectId(userId);

    // Ensure _ids are present on modules/lessons if added
    if (updateData.modules) {
      for (const m of updateData.modules) {
        if (!m._id) m._id = new mongoose.Types.ObjectId();
        if (m.lessons) {
          for (const l of m.lessons) {
            if (!l._id) l._id = new mongoose.Types.ObjectId();
            if (l.contentBlocks) {
              for (const cb of l.contentBlocks) {
                if (!cb._id) cb._id = new mongoose.Types.ObjectId();
              }
            }
            if (l.attachments) {
              for (const att of l.attachments) {
                if (!att._id) att._id = new mongoose.Types.ObjectId();
              }
            }
            if (l.quiz) {
              if (!l.quiz._id) l.quiz._id = new mongoose.Types.ObjectId();
              if (l.quiz.questions) {
                for (const q of l.quiz.questions) {
                  if (!q._id) q._id = new mongoose.Types.ObjectId();
                  if (q.options) {
                    for (const opt of q.options) {
                      if (!opt._id) opt._id = new mongoose.Types.ObjectId();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return this.journeyRepository.update(id, updateData);
  }

  async deleteJourney(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    await this.getJourney(id, orgId);
    return this.journeyRepository.softDelete(id, userId);
  }

  async publishJourney(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    const journey = await this.getJourney(id, orgId);

    // Validation: Require at least one module and lesson to publish
    if (!journey.modules || journey.modules.length === 0) {
      throw new AppError(400, "BAD_REQUEST", "Journey must contain at least one module to be published.");
    }
    const hasLessons = journey.modules.some((m) => m.lessons && m.lessons.length > 0);
    if (!hasLessons) {
      throw new AppError(400, "BAD_REQUEST", "Journey must contain at least one lesson to be published.");
    }

    const version = journey.publishing.status === "published" ? journey.publishing.version + 1 : journey.publishing.version;

    const publishing = {
      status: "published" as const,
      publishedAt: new Date(),
      version,
    };

    return this.journeyRepository.update(id, {
      publishing,
      updatedBy: new mongoose.Types.ObjectId(userId),
    } as any);
  }

  async archiveJourney(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ) {
    await this.getJourney(id, orgId);

    const publishing = {
      status: "archived" as const,
      version: 1, // reset or keep version
    };

    return this.journeyRepository.update(id, {
      publishing,
      updatedBy: new mongoose.Types.ObjectId(userId),
    } as any);
  }

  async duplicateJourney(
    id: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    newTitle: string,
    userId: string | mongoose.Types.ObjectId
  ) {
    const journey = await this.getJourney(id, orgId);
    const newSlug = this.slugify(newTitle) + "-" + Math.random().toString(36).substring(2, 6);
    
    const clone = await this.journeyRepository.duplicate(journey._id, newTitle, newSlug, userId);
    if (!clone) {
      throw new AppError(500, "INTERNAL_SERVER_ERROR", "Could not clone journey");
    }
    return clone;
  }
}

export default JourneyService;
