import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from '../modules/tasks/models/task.model.js';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  await Task.updateOne(
    { title: 'Upload Photo for Security Badge' },
    { $set: { status: 'pending', completedAt: null, completedBy: null } }
  );
  console.log('Reset task to pending for browser verification');
  await mongoose.disconnect();
}

main().catch(console.error);
