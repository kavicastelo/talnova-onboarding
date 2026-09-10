import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../modules/organizations/models/organization.model.js';
import User from '../modules/auth/models/user.model.js';
import AuditLog from '../modules/audit-logs/models/audit-log.model.js';
import { hashPassword } from '../utils/crypto.js';

dotenv.config();

async function prepare() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const superAdminEmail = 'superadmin@talnova.test';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  let baseOrg = await Organization.findOne({ slug: 'talnova-hq', isDeleted: false });
  if (!baseOrg) {
    baseOrg = new Organization({
      name: 'Talnova HQ',
      slug: 'talnova-hq',
      domain: 'talnova.test',
      plan: 'Enterprise',
      status: 'Active',
      supportEmail: 'support@talnova.test',
      createdBy: new mongoose.Types.ObjectId()
    });
    await baseOrg.save();
  }

  // Ensure Super Admin user
  let superAdmin = await User.findOne({ 'auth.email': superAdminEmail });
  if (!superAdmin) {
    superAdmin = new User({
      organizationId: baseOrg._id,
      auth: { email: superAdminEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Super', lastName: 'Admin', fullName: 'Super Admin' },
      employment: { status: 'active', employmentType: 'full_time' },
      permissions: { role: 'super_admin', customRoles: [] }
    });
    await superAdmin.save();
  } else {
    superAdmin.auth.passwordHash = passwordHash;
    superAdmin.permissions.role = 'super_admin';
    await superAdmin.save();
  }

  // Clean up Global Logistics Corp so UI can provision it cleanly
  const targetDomain = 'globallogistics.test';
  const targetEmail = 'admin@globallogistics.test';
  const targetOrgName = 'Global Logistics Corp';

  const existing = await Organization.find({
    $or: [{ domain: targetDomain }, { name: targetOrgName }]
  });
  for (const org of existing) {
    await User.deleteMany({ organizationId: org._id });
    await AuditLog.deleteMany({ organizationId: org._id });
    await Organization.deleteOne({ _id: org._id });
  }
  await User.deleteMany({ 'auth.email': targetEmail });

  console.log('✅ Database prepared for UJ-SUP-001 browser test.');
  await mongoose.disconnect();
}

prepare();
