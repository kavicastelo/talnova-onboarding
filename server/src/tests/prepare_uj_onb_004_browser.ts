import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { EmployeeAssignment } from '../modules/assignments/models/assignment.model.js';
import { DocumentAssignment } from '../modules/documents/models/document-assignment.model.js';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const employee = await User.findOne({ 'auth.email': 'employee@talnova.test' });
  if (!employee) throw new Error('Employee not found');

  // Ensure compliance documents are signed
  await DocumentAssignment.updateMany(
    { employeeId: employee._id, isDeleted: false },
    { $set: { status: 'signed', signedAt: new Date() } }
  );

  // Reset the latest Engineering Onboarding assignment to 0%
  const assignment = await EmployeeAssignment.findOne({
    employeeId: employee._id,
    'journey.title': 'Engineering Onboarding & Technical Values'
  }).sort({ createdAt: -1 });

  if (assignment) {
    assignment.progress.completedLessons = 0;
    assignment.progress.completedModules = 0;
    assignment.progress.completionPercentage = 0;
    assignment.completedLessonIds = [];
    assignment.modules[0].completed = false;
    assignment.modules[0].lessons.forEach(l => {
      l.status = 'not_started';
      l.contentBlocks.forEach(b => {
        b.viewed = false;
        b.viewedPercentage = 0;
      });
    });
    await assignment.save();
    console.log(`Assignment ${assignment._id} reset to 0% for browser test`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
