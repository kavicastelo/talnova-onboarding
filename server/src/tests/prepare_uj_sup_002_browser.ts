import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../modules/organizations/models/organization.model.js';
import User from '../modules/auth/models/user.model.js';
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

  // Ensure Super Admin
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
  }

  // Reset org-test-01 to Professional with 50 seats
  const targetSlug = 'org-test-01';
  let targetOrg = await Organization.findOne({ slug: targetSlug });
  if (targetOrg) {
    targetOrg.name = 'Acme Logistics Test';
    targetOrg.plan = 'Professional';
    targetOrg.subscription = {
      plan: 'Professional',
      status: 'active',
      seatLimit: 50,
      billingCycle: 'monthly'
    };
    targetOrg.limits = {
      maxUsers: 50,
      maxStorageGb: 10
    };
    targetOrg.status = 'Active';
    targetOrg.isDeleted = false;
    await targetOrg.save();
  } else {
    targetOrg = new Organization({
      name: 'Acme Logistics Test',
      slug: targetSlug,
      domain: 'acmelogistics.test',
      plan: 'Professional',
      subscription: {
        plan: 'Professional',
        status: 'active',
        seatLimit: 50,
        billingCycle: 'monthly'
      },
      limits: {
        maxUsers: 50,
        maxStorageGb: 10
      },
      status: 'Active',
      supportEmail: 'billing@acmelogistics.test',
      createdBy: superAdmin._id
    });
    await targetOrg.save();
  }

  console.log('✅ DB prepared for UJ-SUP-002: org-test-01 initialized with plan: Professional, seats: 50.');
  await mongoose.disconnect();
}

prepare();
