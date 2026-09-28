import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { connectDatabase } from '../src/database/connection.js';

async function run() {
  await connectDatabase();
  
  const orgs = await mongoose.connection.collection('organizations').find({ isDeleted: false }).toArray();
  console.log('=== ORGANIZATIONS ===');
  for (const o of orgs) {
    console.log(`Org: ${o.name} (ID: ${o._id}, Slug: ${o.slug})`);
    console.log(`  Limits:`, o.limits);
  }

  const kioskDevices = await mongoose.connection.collection('kioskdevices').find({}).toArray();
  console.log('=== KIOSK DEVICES (' + kioskDevices.length + ') ===');
  for (const d of kioskDevices) {
    console.log(`Device: ${d.name || d.deviceId} (Org: ${d.organizationId}, Status: ${d.status})`);
  }

  const kioskJourneys = await mongoose.connection.collection('kioskjourneys').find({}).toArray();
  console.log('=== KIOSK JOURNEYS (' + kioskJourneys.length + ') ===');
  for (const j of kioskJourneys) {
    console.log(`Kiosk Journey: "${j.title}" (Org: ${j.organizationId}, Deleted: ${j.isDeleted})`);
  }

  const journeys = await mongoose.connection.collection('journeys').find({}).toArray();
  console.log('=== STANDARD JOURNEYS (' + journeys.length + ') ===');
  for (const j of journeys) {
    console.log(`Standard Journey: "${j.title}" (Org: ${j.organizationId}, Deleted: ${j.isDeleted})`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
