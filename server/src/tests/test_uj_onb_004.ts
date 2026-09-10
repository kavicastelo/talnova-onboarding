import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { Journey } from '../modules/journeys/models/journey.model.js';
import { EmployeeAssignment } from '../modules/assignments/models/assignment.model.js';
import { DocumentAssignment } from '../modules/documents/models/document-assignment.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJONB004Tests() {
  console.log('=== RUNNING JOURNEY TEST UJ-ONB-004: Complete LMS Course Lessons & Video Verification ===\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing in .env');
  await mongoose.connect(mongoUri);

  const employeeEmail = 'employee@talnova.test';
  const otherEmployeeEmail = 'other_employee@talnova.test';
  const password = 'Password123!';

  // Step 0: Ensure Preconditions
  console.log('Step 0: Ensuring organization, employees, and course assignment exist...');
  let org = await Organization.findOne({ isDeleted: false });
  if (!org) {
    org = new Organization({
      name: 'Talnova Corp',
      slug: `talnova-corp-${Date.now()}`,
      supportEmail: 'support@talnova.test'
    });
    await org.save();
  }

  const passwordHash = await hashPassword(password);

  let employee = await User.findOne({ 'auth.email': employeeEmail.toLowerCase(), isDeleted: false });
  if (!employee) {
    employee = new User({
      organizationId: org._id,
      auth: { email: employeeEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Employee', lastName: 'Learner', fullName: 'Employee Learner' },
      employment: { employmentType: 'full_time', status: 'active' },
      permissions: { role: 'employee', customRoles: [] }
    });
    await employee.save();
  }

  let otherEmployee = await User.findOne({ 'auth.email': otherEmployeeEmail.toLowerCase(), isDeleted: false });
  if (!otherEmployee) {
    otherEmployee = new User({
      organizationId: org._id,
      auth: { email: otherEmployeeEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Other', lastName: 'Employee', fullName: 'Other Employee' },
      employment: { employmentType: 'full_time', status: 'active' },
      permissions: { role: 'employee', customRoles: [] }
    });
    await otherEmployee.save();
  }

  // Precondition 1: Ensure all compliance documents for employee are marked signed
  await DocumentAssignment.updateMany(
    { employeeId: employee._id, isDeleted: false },
    { $set: { status: 'signed', signedAt: new Date() } }
  );

  // Precondition 2: Create LMS Journey with Video and Text lessons
  const lesson1Id = new mongoose.Types.ObjectId();
  const block1Id = new mongoose.Types.ObjectId();
  const lesson2Id = new mongoose.Types.ObjectId();
  const block2Id = new mongoose.Types.ObjectId();
  const moduleId = new mongoose.Types.ObjectId();

  await Journey.deleteMany({
    organizationId: org._id,
    title: 'Engineering Onboarding & Technical Values'
  });

  const journey = new Journey({
    organizationId: org._id,
    title: 'Engineering Onboarding & Technical Values',
    slug: `engineering-onboarding-${Date.now()}`,
    description: 'Learn company engineering values and architectural foundations.',
    category: 'engineering',
    modules: [
      {
        _id: moduleId,
        title: 'Core Principles & Values',
        description: 'Foundations of engineering excellence',
        order: 1,
        estimatedDurationMinutes: 30,
        lessons: [
          {
            _id: lesson1Id,
            title: 'Welcome & Engineering Values',
            description: 'Watch video presentation on our engineering culture and core principles.',
            order: 1,
            estimatedDurationMinutes: 15,
            contentBlocks: [
              {
                _id: block1Id,
                type: 'video',
                title: 'Engineering Culture & Values Video',
                embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                order: 1
              }
            ],
            attachments: [],
            completionRules: {
              requireContentCompletion: true,
              requireQuizCompletion: false
            }
          },
          {
            _id: lesson2Id,
            title: 'Our Architecture & Systems',
            description: 'Technical deep-dive into microservices and event-driven patterns.',
            order: 2,
            estimatedDurationMinutes: 15,
            contentBlocks: [
              {
                _id: block2Id,
                type: 'text',
                title: 'System Architecture Overview',
                content: 'Overview of core platform microservices, database models, and queues.',
                order: 1
              }
            ],
            attachments: [],
            completionRules: {
              requireContentCompletion: true,
              requireQuizCompletion: false
            }
          }
        ]
      }
    ],
    publishing: {
      status: 'published',
      publishedAt: new Date(),
      version: 1
    },
    createdBy: employee._id
  });
  await journey.save();
  console.log(`Created Journey "${journey.title}" (ID: ${journey._id})`);

  // Create Assignment for employee
  await EmployeeAssignment.deleteMany({
    organizationId: org._id,
    employeeId: employee._id,
    'journey.journeyId': journey._id
  });

  const assignment = new EmployeeAssignment({
    organizationId: org._id,
    employeeId: employee._id,
    assignedBy: employee._id,
    journey: {
      journeyId: journey._id,
      title: journey.title,
      version: 1
    },
    assignment: {
      assignedAt: new Date(),
      priority: 'high'
    },
    status: 'in_progress',
    progress: {
      totalModules: 1,
      completedModules: 0,
      totalLessons: 2,
      completedLessons: 0,
      completionPercentage: 0,
      totalTimeSpentSeconds: 0
    },
    completedLessonIds: [],
    modules: [
      {
        moduleId,
        title: 'Core Principles & Values',
        completed: false,
        lessons: [
          {
            lessonId: lesson1Id,
            title: 'Welcome & Engineering Values',
            status: 'not_started',
            timeSpentSeconds: 0,
            contentBlocks: [
              {
                blockId: block1Id,
                type: 'video',
                viewed: false,
                viewedPercentage: 0
              }
            ]
          },
          {
            lessonId: lesson2Id,
            title: 'Our Architecture & Systems',
            status: 'not_started',
            timeSpentSeconds: 0,
            contentBlocks: [
              {
                blockId: block2Id,
                type: 'text',
                viewed: false,
                viewedPercentage: 0
              }
            ]
          }
        ]
      }
    ]
  });
  await assignment.save();
  console.log(`Created Assignment (ID: ${assignment._id}) for employee`);

  // Create another assignment for otherEmployee to test authorization boundary
  const otherAssignment = new EmployeeAssignment({
    organizationId: org._id,
    employeeId: otherEmployee._id,
    assignedBy: otherEmployee._id,
    journey: {
      journeyId: journey._id,
      title: journey.title,
      version: 1
    },
    assignment: {
      assignedAt: new Date(),
      priority: 'normal'
    },
    status: 'in_progress',
    progress: {
      totalModules: 1,
      completedModules: 0,
      totalLessons: 2,
      completedLessons: 0,
      completionPercentage: 0,
      totalTimeSpentSeconds: 0
    },
    completedLessonIds: [],
    modules: assignment.modules
  });
  await otherAssignment.save();

  // Step 1: Authenticate as Employee
  console.log('\nStep 1: Authenticating as employee...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeEmail, password })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  if (!token) throw new Error('Employee login failed');
  console.log('✓ Step 1 Passed: Employee token obtained');

  // Step 2: Negative Test 1 — Compliance Bypass Check on API
  console.log('\nStep 2: Negative Test — Compliance Bypass rejection on API...');
  // Create an unsigned compliance doc temporarily
  const unsignedDoc = new DocumentAssignment({
    organizationId: org._id,
    employeeId: employee._id,
    assignedBy: employee._id,
    templateId: new mongoose.Types.ObjectId(),
    templateTitle: 'Mandatory Policy Acknowledgment',
    status: 'pending',
    assignedAt: new Date()
  });
  await unsignedDoc.save();

  const complianceBlockRes = await fetch(`${API_BASE}/assignments/${assignment._id}/complete-lesson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      moduleId: moduleId.toString(),
      lessonId: lesson1Id.toString(),
      timeSpentSeconds: 120,
      completedBlockIds: [block1Id.toString()]
    })
  });
  const complianceBlockData = await complianceBlockRes.json();
  console.log('Compliance block status:', complianceBlockRes.status);
  console.log('Compliance block response:', complianceBlockData);

  if (complianceBlockRes.status !== 403) {
    throw new Error(`Expected HTTP 403 for compliance prerequisite check, got ${complianceBlockRes.status}`);
  }
  if (complianceBlockData.error?.code !== 'COMPLIANCE_PREREQUISITE_REQUIRED') {
    throw new Error(`Expected COMPLIANCE_PREREQUISITE_REQUIRED, got ${complianceBlockData.error?.code}`);
  }
  console.log('✓ Step 2 Passed: API strictly blocks lesson completion with HTTP 403 (COMPLIANCE_PREREQUISITE_REQUIRED)');

  // Clean up temporary compliance doc so happy path can proceed
  await DocumentAssignment.deleteOne({ _id: unsignedDoc._id });

  // Step 3: Negative Test 2 — Authorization Test (Mutating another user's assignment)
  console.log('\nStep 3: Authorization Test — Attempting to mutate other employee assignment...');
  const otherMutateRes = await fetch(`${API_BASE}/assignments/${otherAssignment._id}/complete-lesson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      moduleId: moduleId.toString(),
      lessonId: lesson1Id.toString(),
      timeSpentSeconds: 120,
      completedBlockIds: [block1Id.toString()]
    })
  });
  const otherMutateData = await otherMutateRes.json();
  console.log('Other user assignment mutation status:', otherMutateRes.status);

  if (otherMutateRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden for cross-user assignment mutation, got ${otherMutateRes.status}`);
  }
  console.log('✓ Step 3 Passed: Cross-user assignment mutation rejected with HTTP 403 Forbidden');

  // Step 4: Happy Path — Complete Lesson 1 (Video Lesson)
  console.log('\nStep 4: Happy Path — Completing Lesson 1 ("Welcome & Engineering Values")...');
  const completeRes = await fetch(`${API_BASE}/assignments/${assignment._id}/complete-lesson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      moduleId: moduleId.toString(),
      lessonId: lesson1Id.toString(),
      timeSpentSeconds: 150,
      completedBlockIds: [block1Id.toString()]
    })
  });
  const completeData = await completeRes.json();
  console.log('Complete lesson status:', completeRes.status);
  console.log('Complete lesson body:', JSON.stringify(completeData.data?.progress, null, 2));

  if (completeRes.status !== 200) {
    throw new Error(`Expected HTTP 200 OK, got ${completeRes.status}`);
  }
  if (completeData.data?.progress?.completedLessons !== 1) {
    throw new Error(`Expected completedLessons 1, got ${completeData.data?.progress?.completedLessons}`);
  }
  if (completeData.data?.progress?.completionPercentage !== 50) {
    throw new Error(`Expected completionPercentage 50%, got ${completeData.data?.progress?.completionPercentage}%`);
  }
  console.log('✓ Step 4 Passed: Lesson completed with HTTP 200 OK; progress advanced to 50%');

  // Step 5: Data Integrity Checks in MongoDB Atlas
  console.log('\nStep 5: Verifying MongoDB Atlas document state and completedLessonIds...');
  const updatedAssignment = await EmployeeAssignment.findById(assignment._id);
  if (!updatedAssignment) throw new Error('Assignment document missing in MongoDB');

  console.log('MongoDB Assignment State:', {
    completedLessonIds: updatedAssignment.completedLessonIds,
    completedLessons: updatedAssignment.progress.completedLessons,
    completionPercentage: updatedAssignment.progress.completionPercentage,
    lessonStatus: updatedAssignment.modules[0]?.lessons[0]?.status,
    lessonCompletedAt: updatedAssignment.modules[0]?.lessons[0]?.completedAt
  });

  if (!updatedAssignment.completedLessonIds?.includes(lesson1Id.toString())) {
    throw new Error(`DATA_INTEGRITY_FAILURE: completedLessonIds does not contain ${lesson1Id}`);
  }
  if (updatedAssignment.modules[0]?.lessons[0]?.status !== 'completed') {
    throw new Error(`DATA_INTEGRITY_FAILURE: Lesson status is not 'completed'`);
  }
  console.log('✓ Step 5 Passed: MongoDB assignment verified with completedLessonIds and 50% course progress');

  await mongoose.disconnect();
  console.log('\n=== ALL UJ-ONB-004 PROGRAMMATIC & INTEGRITY CHECKS PASSED ===');
}

runUJONB004Tests().catch(err => {
  console.error('UJ-ONB-004 Test Error:', err);
  process.exit(1);
});
