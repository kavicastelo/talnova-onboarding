import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { Journey } from '../modules/journeys/models/journey.model.js';
import { EmployeeAssignment } from '../modules/assignments/models/assignment.model.js';
import { DocumentAssignment } from '../modules/documents/models/document-assignment.model.js';
import GamificationProfile from '../modules/gamification/models/gamification-profile.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJONB005Tests() {
  console.log('=== RUNNING JOURNEY TEST UJ-ONB-005: Take LMS Assessment Quiz & Progress Gating ===\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing in .env');
  await mongoose.connect(mongoUri);

  const employeeEmail = 'employee@talnova.test';
  const password = 'Password123!';

  // Step 0: Ensure Preconditions
  console.log('Step 0: Ensuring organization and employee exist...');
  let org = await Organization.findOne({ isDeleted: false });
  if (!org) {
    org = new Organization({
      name: 'Talnova Corp',
      slug: `talnova-corp-${Date.now()}`,
      supportEmail: 'support@talnova.test',
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
      permissions: { role: 'employee', customRoles: [] },
    });
    await employee.save();
  }

  // Precondition 1: Ensure compliance documents are signed
  await DocumentAssignment.updateMany(
    { employeeId: employee._id, isDeleted: false },
    { $set: { status: 'signed', signedAt: new Date() } }
  );

  // Precondition 2: Create LMS Journey with prerequisite lesson + Quiz lesson
  const lesson1Id = new mongoose.Types.ObjectId();
  const block1Id = new mongoose.Types.ObjectId();
  const quizLessonId = new mongoose.Types.ObjectId();
  const quizId = new mongoose.Types.ObjectId();
  const q1Id = new mongoose.Types.ObjectId();
  const q1Opt1Id = new mongoose.Types.ObjectId(); // correct
  const q1Opt2Id = new mongoose.Types.ObjectId(); // incorrect
  const q2Id = new mongoose.Types.ObjectId();
  const q2Opt1Id = new mongoose.Types.ObjectId(); // correct
  const q2Opt2Id = new mongoose.Types.ObjectId(); // incorrect
  const moduleId = new mongoose.Types.ObjectId();

  await Journey.deleteMany({
    organizationId: org._id,
    title: 'Security & Compliance Onboarding',
  });

  const journey = new Journey({
    organizationId: org._id,
    title: 'Security & Compliance Onboarding',
    slug: `security-compliance-${Date.now()}`,
    description: 'Learn cybersecurity best practices and take the security compliance assessment.',
    category: 'security',
    modules: [
      {
        _id: moduleId,
        title: 'Cybersecurity & Data Privacy',
        description: 'Protocols for data protection and safe authentication',
        order: 1,
        estimatedDurationMinutes: 30,
        lessons: [
          {
            _id: lesson1Id,
            title: 'Data Protection Principles',
            description: 'Overview of TLS encryption and secure handling of credentials.',
            order: 1,
            estimatedDurationMinutes: 15,
            contentBlocks: [
              {
                _id: block1Id,
                type: 'text',
                title: 'Encryption Best Practices',
                content: 'All sensitive data in transit must use TLS 1.3 or higher.',
                order: 1,
              },
            ],
            attachments: [],
            completionRules: {
              requireContentCompletion: true,
              requireQuizCompletion: false,
            },
          },
          {
            _id: quizLessonId,
            title: 'Security Knowledge Assessment',
            description: 'Assessment covering data privacy and authentication policies.',
            order: 2,
            estimatedDurationMinutes: 15,
            contentBlocks: [],
            attachments: [],
            quiz: {
              _id: quizId,
              title: 'Security Compliance Assessment Quiz',
              passingScore: 80,
              questions: [
                {
                  _id: q1Id,
                  type: 'single_choice',
                  question: 'What is the required standard for encrypting data in transit across Talnova services?',
                  points: 50,
                  options: [
                    { _id: q1Opt1Id, text: 'TLS 1.3 with strong cipher suites', isCorrect: true },
                    { _id: q1Opt2Id, text: 'Unencrypted plain HTTP without certificate', isCorrect: false },
                  ],
                },
                {
                  _id: q2Id,
                  type: 'single_choice',
                  question: 'Which best practices define multi-factor authentication (MFA) requirements?',
                  points: 50,
                  options: [
                    { _id: q2Opt1Id, text: 'Combining something you know (password) with something you have (hardware token / authenticator app)', isCorrect: true },
                    { _id: q2Opt2Id, text: 'Writing your password on a sticky note attached to your monitor', isCorrect: false },
                  ],
                },
              ],
            },
            completionRules: {
              requireContentCompletion: false,
              requireQuizCompletion: true,
              minimumQuizScore: 80,
            },
          },
        ],
      },
    ],
    publishing: {
      status: 'published',
      publishedAt: new Date(),
      version: 1,
    },
    createdBy: employee._id,
  });
  await journey.save();
  console.log(`✓ Created Journey "${journey.title}" (ID: ${journey._id})`);

  // Create Assignment with prerequisite lesson already completed
  await EmployeeAssignment.deleteMany({
    organizationId: org._id,
    employeeId: employee._id,
  });

  const assignment = new EmployeeAssignment({
    organizationId: org._id,
    employeeId: employee._id,
    assignedBy: employee._id,
    journey: {
      journeyId: journey._id,
      title: journey.title,
      version: 1,
    },
    assignment: {
      assignedAt: new Date(),
      priority: 'high',
    },
    status: 'in_progress',
    progress: {
      totalModules: 1,
      completedModules: 0,
      totalLessons: 2,
      completedLessons: 1, // Lesson 1 is completed as precondition
      completionPercentage: 50,
      totalTimeSpentSeconds: 600,
    },
    completedLessonIds: [lesson1Id.toString()],
    quizAttempts: [],
    modules: [
      {
        moduleId,
        title: 'Cybersecurity & Data Privacy',
        completed: false,
        lessons: [
          {
            lessonId: lesson1Id,
            title: 'Data Protection Principles',
            status: 'completed',
            completedAt: new Date(),
            timeSpentSeconds: 600,
            contentBlocks: [
              {
                blockId: block1Id,
                type: 'text',
                viewed: true,
                viewedPercentage: 100,
                completedAt: new Date(),
              },
            ],
          },
          {
            lessonId: quizLessonId,
            title: 'Security Knowledge Assessment',
            status: 'not_started',
            timeSpentSeconds: 0,
            contentBlocks: [],
          },
        ],
      },
    ],
  });
  await assignment.save();
  console.log(`✓ Created Assignment (ID: ${assignment._id}) with prerequisite lesson 1 completed`);

  // Authenticate as employee
  console.log('\nAuthenticating as employee...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeEmail, password }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  if (!token) throw new Error('Employee login failed');
  console.log('✓ Step 1: Employee authenticated successfully');

  // Test 1: Negative Test — Submit empty answers array
  console.log('\nTest 1: Negative Test — Submitting empty answers array...');
  const emptyRes = await fetch(`${API_BASE}/assignments/${assignment._id}/submit-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      moduleId: moduleId.toString(),
      lessonId: quizLessonId.toString(),
      answers: [],
    }),
  });
  console.log(`Empty answers response status: ${emptyRes.status}`);
  const emptyData = await emptyRes.json();
  console.log('Response body:', emptyData);
  if (emptyRes.status !== 400) {
    throw new Error(`Expected HTTP 400 for empty answers, got ${emptyRes.status}`);
  }
  console.log('✓ Test 1 Passed: Empty answers rejected with HTTP 400 validation error');

  // Test 2: Authorization Test — Submitting quiz when compliance documents are pending
  console.log('\nTest 2: Authorization Test — Submitting quiz when compliance documents are pending...');
  const pendingDoc = new DocumentAssignment({
    organizationId: org._id,
    employeeId: employee._id,
    assignedBy: employee._id,
    templateId: new mongoose.Types.ObjectId(),
    templateTitle: 'Mandatory Data Privacy Agreement',
    status: 'pending',
    assignedAt: new Date(),
  });
  await pendingDoc.save();

  const complianceBlockRes = await fetch(`${API_BASE}/assignments/${assignment._id}/submit-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      moduleId: moduleId.toString(),
      lessonId: quizLessonId.toString(),
      answers: [
        { questionId: q1Id.toString(), selectedOptions: [q1Opt1Id.toString()] },
      ],
    }),
  });
  console.log(`Compliance blocked response status: ${complianceBlockRes.status}`);
  const complianceBlockData = await complianceBlockRes.json();
  console.log('Response body:', complianceBlockData);
  if (complianceBlockRes.status !== 400) {
    throw new Error(`Expected HTTP 400 for pending compliance documents, got ${complianceBlockRes.status}`);
  }
  console.log('✓ Test 2 Passed: Submitting quiz when compliance documents are pending is rejected with HTTP 400');

  // Clean up pending doc
  await DocumentAssignment.deleteOne({ _id: pendingDoc._id });

  // Test 3: Alternative Path — Failed Quiz attempt (50% < 80% passing)
  console.log('\nTest 3: Alternative Path — Submitting failed quiz attempt (score: 50%)...');
  const failedRes = await fetch(`${API_BASE}/assignments/${assignment._id}/submit-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      moduleId: moduleId.toString(),
      lessonId: quizLessonId.toString(),
      answers: [
        { questionId: q1Id.toString(), selectedOptions: [q1Opt1Id.toString()] }, // correct (50 pts)
        { questionId: q2Id.toString(), selectedOptions: [q2Opt2Id.toString()] }, // wrong (0 pts)
      ],
    }),
  });
  const failedData = await failedRes.json();
  console.log('Failed attempt response status:', failedRes.status);
  console.log('Failed attempt response body:', failedData);
  if (failedRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for failed attempt evaluation, got ${failedRes.status}`);
  }
  if (failedData.score !== 50 || failedData.passed !== false) {
    throw new Error(`Expected score: 50, passed: false, got score: ${failedData.score}, passed: ${failedData.passed}`);
  }
  // Verify assignment step remains incomplete
  const assignmentAfterFail = await EmployeeAssignment.findById(assignment._id);
  const quizLessonProg = assignmentAfterFail?.modules[0].lessons.find(
    (l) => l.lessonId.toString() === quizLessonId.toString()
  );
  if (quizLessonProg?.status === 'completed') {
    throw new Error('Lesson should remain incomplete after failed quiz attempt!');
  }
  console.log('✓ Test 3 Passed: Failed quiz returns score: 50, passed: false and step remains incomplete');

  // Test 4: Happy Path — Passed Quiz attempt (100% >= 80% passing)
  console.log('\nTest 4: Happy Path — Submitting passing quiz attempt (score: 100%)...');
  const passedRes = await fetch(`${API_BASE}/assignments/${assignment._id}/submit-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      moduleId: moduleId.toString(),
      lessonId: quizLessonId.toString(),
      answers: [
        { questionId: q1Id.toString(), selectedOptions: [q1Opt1Id.toString()] }, // correct (50 pts)
        { questionId: q2Id.toString(), selectedOptions: [q2Opt1Id.toString()] }, // correct (50 pts)
      ],
    }),
  });
  const passedData = await passedRes.json();
  console.log('Passed attempt response status:', passedRes.status);
  console.log('Passed attempt response body:', passedData);
  if (passedRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for passed attempt evaluation, got ${passedRes.status}`);
  }
  if (passedData.score !== 100 || passedData.passed !== true) {
    throw new Error(`Expected score: 100, passed: true, got score: ${passedData.score}, passed: ${passedData.passed}`);
  }
  if (passedData.attemptsCount !== 2) {
    throw new Error(`Expected attemptsCount: 2, got ${passedData.attemptsCount}`);
  }
  console.log('✓ Test 4 Passed: Body contains { score: 100, passed: true, attemptsCount: 2 }');

  // Test 5: Data Integrity Checks
  console.log('\nTest 5: Data Integrity Checks in MongoDB...');
  const finalAssignment = await EmployeeAssignment.findById(assignment._id);
  if (!finalAssignment) throw new Error('Assignment not found in MongoDB');

  console.log('Assignment.quizAttempts count:', finalAssignment.quizAttempts?.length);
  if (!finalAssignment.quizAttempts || finalAssignment.quizAttempts.length === 0) {
    throw new Error('Assignment.quizAttempts array is empty!');
  }
  const lastAttempt = finalAssignment.quizAttempts[finalAssignment.quizAttempts.length - 1];
  console.log('Last attempt recorded:', {
    attemptNumber: lastAttempt.attemptNumber,
    score: lastAttempt.score,
    passed: lastAttempt.passed,
    submittedAt: lastAttempt.submittedAt,
  });
  if (lastAttempt.score !== 100 || !lastAttempt.passed || !lastAttempt.submittedAt) {
    throw new Error('Recorded quiz attempt does not match passing submission!');
  }
  console.log('✓ Test 5 Passed: Assignment.quizAttempts recorded with timestamp, score, and passed status');

  // Test 6: Step marked completed & Journey progression
  console.log('\nTest 6: Step completion & Stage progression check...');
  const completedLessonProg = finalAssignment.modules[0].lessons.find(
    (l) => l.lessonId.toString() === quizLessonId.toString()
  );
  if (completedLessonProg?.status !== 'completed') {
    throw new Error(`Expected quiz lesson status 'completed', got '${completedLessonProg?.status}'`);
  }
  if (finalAssignment.progress.completedLessons !== 2) {
    throw new Error(`Expected 2 completed lessons, got ${finalAssignment.progress.completedLessons}`);
  }
  if (finalAssignment.progress.completionPercentage !== 100) {
    throw new Error(`Expected 100% completion, got ${finalAssignment.progress.completionPercentage}%`);
  }
  console.log(`✓ Test 6 Passed: Quiz step marked 'completed', module completed: ${finalAssignment.modules[0].completed}, progress: ${finalAssignment.progress.completionPercentage}%`);

  // Test 7: Integration Check — Gamification points awarded
  console.log('\nTest 7: Integration Check — Gamification points...');
  const gamificationProfile = await GamificationProfile.findOne({
    organizationId: org._id,
    userId: employee._id,
  });
  console.log('Gamification profile:', {
    points: gamificationProfile?.points,
    level: gamificationProfile?.level,
    historyCount: gamificationProfile?.pointHistory?.length,
  });
  const quizPointsEntry = gamificationProfile?.pointHistory?.find(
    (h) => h.action === 'quiz_completed'
  );
  if (!quizPointsEntry) {
    throw new Error('No quiz_completed points entry found in gamification profile!');
  }
  console.log('✓ Test 7 Passed: Gamification points awarded for passing quiz:', quizPointsEntry);

  // Leave assignment in fresh state with quiz not submitted yet so UI browser test can do the exact journey interactively!
  console.log('\nResetting quiz attempt on assignment for Browser Subagent interactive run...');
  finalAssignment.quizAttempts = [];
  finalAssignment.progress.completedLessons = 1;
  finalAssignment.progress.completionPercentage = 50;
  finalAssignment.progress.completedModules = 0;
  finalAssignment.modules[0].completed = false;
  finalAssignment.modules[0].lessons[1].status = 'not_started';
  finalAssignment.modules[0].lessons[1].quizAttempt = undefined;
  await finalAssignment.save();
  console.log(`✓ Assignment ${finalAssignment._id} ready for interactive browser test!`);

  console.log('\n======================================================');
  console.log('ALL PROGRAMMATIC TESTS FOR UJ-ONB-005 PASSED SUCCESSFULLY!');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

runUJONB005Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
