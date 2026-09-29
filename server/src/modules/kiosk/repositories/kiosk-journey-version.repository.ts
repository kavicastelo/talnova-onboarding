import mongoose from "mongoose";
import {
  KioskJourneyVersionModel,
  IKioskJourneyVersion
} from "../models/kiosk-journey-version.model.js";

export class KioskJourneyVersionRepository {
  /**
   * Persists an immutable journey version snapshot document.
   */
  async createSnapshot(
    data: Partial<IKioskJourneyVersion>
  ): Promise<IKioskJourneyVersion> {
    const version = new KioskJourneyVersionModel(data);
    return version.save();
  }

  /**
   * Retrieves the latest published version snapshot for a given journey.
   */
  async findLatestVersion(
    journeyId: string | mongoose.Types.ObjectId
  ): Promise<IKioskJourneyVersion | null> {
    return KioskJourneyVersionModel.findOne({
      journeyId: new mongoose.Types.ObjectId(journeyId)
    }).sort({ version: -1 });
  }

  /**
   * Retrieves a specific version snapshot of a journey by journeyId and version number.
   */
  async findByJourneyAndVersion(
    journeyId: string | mongoose.Types.ObjectId,
    version: number
  ): Promise<IKioskJourneyVersion | null> {
    return KioskJourneyVersionModel.findOne({
      journeyId: new mongoose.Types.ObjectId(journeyId),
      version
    });
  }

  /**
   * Lists all version snapshots for a given journey belonging to an organization, sorted newest first.
   */
  async listVersionsByJourney(
    journeyId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId
  ): Promise<IKioskJourneyVersion[]> {
    return KioskJourneyVersionModel.find({
      journeyId: new mongoose.Types.ObjectId(journeyId),
      organizationId: new mongoose.Types.ObjectId(orgId)
    }).sort({ version: -1 });
  }

  /**
   * Retrieves a snapshot by its MongoDB _id.
   */
  async findById(
    id: string | mongoose.Types.ObjectId
  ): Promise<IKioskJourneyVersion | null> {
    return KioskJourneyVersionModel.findById(id);
  }
}

export default KioskJourneyVersionRepository;
