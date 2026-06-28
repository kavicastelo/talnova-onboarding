import { Session, ISession } from "../models/session.model.js";
import mongoose from "mongoose";

export class SessionRepository {
  async create(sessionData: Partial<ISession>): Promise<ISession> {
    const session = new Session(sessionData);
    return session.save();
  }

  async findById(id: string | mongoose.Types.ObjectId): Promise<ISession | null> {
    return Session.findOne({ _id: id, isValid: true });
  }

  async invalidateSession(id: string | mongoose.Types.ObjectId): Promise<ISession | null> {
    return Session.findOneAndUpdate(
      { _id: id },
      { $set: { isValid: false } },
      { new: true }
    );
  }

  async invalidateAllUserSessions(userId: string | mongoose.Types.ObjectId): Promise<void> {
    await Session.updateMany(
      { userId, isValid: true },
      { $set: { isValid: false } }
    );
  }

  async incrementTokenVersion(id: string | mongoose.Types.ObjectId): Promise<ISession | null> {
    return Session.findOneAndUpdate(
      { _id: id, isValid: true },
      { $inc: { tokenVersion: 1 }, $set: { lastActivityAt: new Date() } },
      { new: true }
    );
  }
}

export default SessionRepository;
