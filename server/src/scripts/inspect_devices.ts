import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { KioskDeviceRepository } from '../modules/kiosk/repositories/kiosk-device.repository.js';
dotenv.config();

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/talnova';
  await mongoose.connect(uri);
  const devices = await mongoose.connection.collection('kioskdevices').find({ isDeleted: { $ne: true } }).toArray();
  console.log('Devices found:', devices.length);
  for (const d of devices) {
    console.log(JSON.stringify({
      id: d._id,
      name: d.name,
      deviceId: d.deviceId,
      hardwareGuid: d.hardwareGuid,
      organizationId: d.organizationId,
      status: d.status,
      paired: d.paired,
      lastSeen: d.lastSeen,
      lastHeartbeatAt: d.lastHeartbeatAt,
      telemetry: d.telemetry
    }, null, 2));
  }
  await mongoose.disconnect();
}
run().catch(console.error);
