import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { KioskAnalyticsModel } from '../modules/kiosk/models/kiosk-analytics.model.js';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding');
  const records = await KioskAnalyticsModel.find({ eventType: 'PPE_COMPLIANCE_CONFIRMED' }).sort({ createdAt: -1 }).limit(3);
  console.log('Final DB KioskAnalytics records:', JSON.stringify(records, null, 2));
  await mongoose.disconnect();
}
check();
