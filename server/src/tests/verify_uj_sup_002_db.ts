import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../modules/organizations/models/organization.model.js';

dotenv.config();

async function check() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const org = await Organization.findOne({ slug: 'org-test-01' });
  console.log('--- MongoDB Organization State for org-test-01 ---');
  console.log(JSON.stringify({
    id: org?._id.toString(),
    slug: org?.slug,
    name: org?.name,
    plan: org?.plan,
    subscriptionPlan: org?.subscription?.plan,
    seatLimit: org?.subscription?.seatLimit,
    maxUsers: org?.limits?.maxUsers,
    status: org?.status
  }, null, 2));

  await mongoose.disconnect();
}

check();
