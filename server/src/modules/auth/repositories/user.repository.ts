import { User, IUser } from "../models/user.model.js";
import mongoose from "mongoose";

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({
      "auth.email": email.toLowerCase(),
      isDeleted: false,
    });
  }

  async findById(id: string | mongoose.Types.ObjectId): Promise<IUser | null> {
    return User.findOne({
      _id: id,
      isDeleted: false,
    });
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return user.save();
  }

  async update(id: string | mongoose.Types.ObjectId, updateData: Partial<IUser>): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: updateData },
      { new: true }
    );
  }

  async incrementFailedLogin(id: string | mongoose.Types.ObjectId): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $inc: { "security.failedLoginAttempts": 1 } },
      { new: true }
    );
  }

  async resetFailedLogin(id: string | mongoose.Types.ObjectId): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { "security.failedLoginAttempts": 0, "security.lockedUntil": null } },
      { new: true }
    );
  }

  async lockAccount(id: string | mongoose.Types.ObjectId, lockedUntil: Date): Promise<IUser | null> {
    return User.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { "security.lockedUntil": lockedUntil } },
      { new: true }
    );
  }

  async findByResetToken(hashedToken: string): Promise<IUser | null> {
    return User.findOne({
      "security.passwordResetToken": hashedToken,
      "security.passwordResetExpires": { $gt: new Date() },
      isDeleted: false,
    });
  }
}

export default UserRepository;
