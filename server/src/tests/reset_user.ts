import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const u = await User.findOne({ 'auth.email': 'reset_target@talnova.test' });
  if (u) {
    u.auth.passwordHash = await hashPassword('OldPassword123!');
    u.security.passwordResetToken = null as any;
    u.security.passwordResetExpires = null as any;
    await u.save();
    console.log('Target user reset to OldPassword123!');
  }
  await mongoose.disconnect();
}

main().catch(console.error);
