import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { MilestoneTemplate } from '../modules/milestones/models/milestone-template.model.js';
import { EmployeeMilestone, MilestonePlan } from '../modules/milestones/models/employee-milestone.model.js';
import { Notification } from '../modules/notifications/models/notification.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJMGR002Tests() {
  console.log('========================================================================');
  console.log('=== RUNNING JOURNEY TEST UJ-MGR-002: Evaluate & Approve 30-60-90 Milestones ===');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const managerEmail = 'manager@talnova.test';
  const otherManagerEmail = 'other_manager@talnova.test';
  const directHireEmail = 'direct_hire@talnova.test';
  const otherHireEmail = 'other_hire@talnova.test';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  // Step 0: Ensure Organization and Users
  console.log('Step 0: Initializing test tenant, managers, and direct reports in MongoDB...');
  let org = await Organization.findOne({ isDeleted: false });
  if (!org) {
    org = new Organization({
      name: 'Talnova Corp',
      slug: `talnova-corp-${Date.now()}`,
      supportEmail: 'support@talnova.test',
    });
    await org.save();
  }

  // Manager User
  let manager = await User.findOne({ 'auth.email': managerEmail.toLowerCase(), isDeleted: false });
  if (!manager) {
    manager = new User({
      organizationId: org._id,
      auth: { email: managerEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Sarah', lastName: 'Connor', fullName: 'Sarah Connor' },
      employment: { department: 'Engineering', jobTitle: 'Engineering Manager', status: 'active' },
      permissions: { role: 'manager', customRoles: [] },
    });
    await manager.save();
  }

  // Other Manager User
  let otherManager = await User.findOne({ 'auth.email': otherManagerEmail.toLowerCase(), isDeleted: false });
  if (!otherManager) {
    otherManager = new User({
      organizationId: org._id,
      auth: { email: otherManagerEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Miles', lastName: 'Dyson', fullName: 'Miles Dyson' },
      employment: { department: 'Cyberdyne', jobTitle: 'Director of AI', status: 'active' },
      permissions: { role: 'manager', customRoles: [] },
    });
    await otherManager.save();
  }

  // Direct Report Employee
  let directHire = await User.findOne({ 'auth.email': directHireEmail.toLowerCase(), isDeleted: false });
  if (!directHire) {
    directHire = new User({
      organizationId: org._id,
      auth: { email: directHireEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'John', lastName: 'Connor', fullName: 'John Connor' },
      employment: {
        department: 'Engineering',
        jobTitle: 'Software Engineer',
        status: 'in_progress',
        managerId: manager._id,
        hireDate: new Date('2026-08-01T00:00:00.000Z'),
      },
      permissions: { role: 'employee', customRoles: [] },
    });
    await directHire.save();
  } else {
    directHire.employment = directHire.employment || {};
    directHire.employment.managerId = manager._id;
    await directHire.save();
  }

  // Other Employee (Unmanaged by manager)
  let otherHire = await User.findOne({ 'auth.email': otherHireEmail.toLowerCase(), isDeleted: false });
  if (!otherHire) {
    otherHire = new User({
      organizationId: org._id,
      auth: { email: otherHireEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Danny', lastName: 'Dyson', fullName: 'Danny Dyson' },
      employment: {
        department: 'Cyberdyne',
        jobTitle: 'Systems Architect',
        status: 'active',
        managerId: otherManager._id,
        hireDate: new Date('2026-07-15T00:00:00.000Z'),
      },
      permissions: { role: 'employee', customRoles: [] },
    });
    await otherHire.save();
  } else {
    otherHire.employment = otherHire.employment || {};
    otherHire.employment.managerId = otherManager._id;
    await otherHire.save();
  }

  // Milestone Template for Day 30
  let template = await MilestoneTemplate.findOne({ organizationId: org._id, targetDay: 30, isDeleted: false });
  if (!template) {
    template = new MilestoneTemplate({
      organizationId: org._id,
      title: 'Day 30 Onboarding Milestone',
      description: 'First month reflection and confidence check-in on role readiness and team integration.',
      targetDay: 30,
      goals: [
        { title: 'Independent ticket resolution and PR approvals', description: 'Ship at least 2 features to production' },
        { title: 'Complete all mandatory compliance and security onboarding', description: 'Review security policies and sign NDA' },
      ],
      checkinQuestions: [
        { question: 'Confidence in Role', type: 'rating', required: true },
        { question: 'What were your biggest wins and what support is needed?', type: 'text', required: true },
      ],
      createdBy: manager._id,
    });
    await template.save();
  }

  // Setup Direct Report's Day 30 Milestone in "pending_manager_review" state
  await EmployeeMilestone.deleteMany({
    organizationId: org._id,
    employeeId: directHire._id,
    targetDay: 30,
  });

  const directMilestone = new EmployeeMilestone({
    organizationId: org._id,
    templateId: template._id,
    employeeId: directHire._id,
    assignedBy: manager._id,
    milestoneTitle: 'Day 30 Onboarding Milestone',
    milestoneCode: 'mls-eval-01',
    targetDay: 30,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'pending_manager_review',
    employeeRating: 4,
    comments: 'Ramping up fast on codebase. Deployed first sprint feature ahead of schedule.',
    submittedAt: new Date(Date.now() - 3600000),
    goalsProgress: [
      { goalTitle: 'Independent ticket resolution and PR approvals', completed: true, completedAt: new Date() },
      { goalTitle: 'Complete all mandatory compliance and security onboarding', completed: true, completedAt: new Date() },
    ],
    employeeSelfCheck: {
      completedAt: new Date(Date.now() - 3600000),
      submittedAt: new Date(Date.now() - 3600000),
      responses: [
        { questionId: new mongoose.Types.ObjectId(), question: 'Confidence in Role', answer: '4' },
      ],
      confidenceRating: 4,
      employeeRating: 4,
      comments: 'Ramping up fast on codebase. Deployed first sprint feature ahead of schedule.',
      reflectionNotes: 'Ramping up fast on codebase. Deployed first sprint feature ahead of schedule.',
    },
  });
  await directMilestone.save();

  // Setup Other Hire's Day 30 Milestone
  await EmployeeMilestone.deleteMany({
    organizationId: org._id,
    employeeId: otherHire._id,
    targetDay: 30,
  });

  const unmanagedMilestone = new EmployeeMilestone({
    organizationId: org._id,
    templateId: template._id,
    employeeId: otherHire._id,
    assignedBy: otherManager._id,
    milestoneTitle: 'Day 30 Cyberdyne Systems Review',
    milestoneCode: 'mls-other-01',
    targetDay: 30,
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'pending_manager_review',
    employeeRating: 5,
    comments: 'Neural network architecture initialized.',
  });
  await unmanagedMilestone.save();

  console.log(`✓ Direct hire milestone created: ${directMilestone._id} (code: ${directMilestone.milestoneCode})`);
  console.log(`✓ Unmanaged milestone created: ${unmanagedMilestone._id} (code: ${unmanagedMilestone.milestoneCode})`);

  // Step 1: Authenticate as Manager
  console.log('\nStep 1: Authenticating as manager@talnova.test...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: managerEmail, password }),
  });
  const loginData = await loginRes.json();
  const managerToken = loginData.data?.accessToken;
  if (!managerToken) throw new Error('Manager login failed');
  console.log('✓ Manager token acquired');

  // Step 2: Negative Test 1 — Invalid Rating < 1
  console.log('\nStep 2: Negative Test — Submitting evaluation with rating: 0 (less than 1)...');
  const neg0Res = await fetch(`${API_BASE}/milestones/${directMilestone._id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({
      status: 'approved',
      managerRating: 0,
      managerFeedback: 'Invalid rating test',
    }),
  });
  console.log(`Negative test (rating 0) response status: ${neg0Res.status}`);
  if (neg0Res.status !== 400) {
    throw new Error(`Expected HTTP 400 for rating 0, got ${neg0Res.status}`);
  }
  const neg0Json = await neg0Res.json();
  console.log('Negative response message:', neg0Json.message);
  console.log('✓ Negative Test 1 Passed: Rating 0 rejected with HTTP 400 Bad Request');

  // Step 3: Negative Test 2 — Invalid Rating > 5
  console.log('\nStep 3: Negative Test — Submitting evaluation with rating: 6 (greater than 5)...');
  const neg6Res = await fetch(`${API_BASE}/milestones/${directMilestone._id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({
      status: 'approved',
      managerRating: 6,
      managerFeedback: 'Invalid rating test',
    }),
  });
  console.log(`Negative test (rating 6) response status: ${neg6Res.status}`);
  if (neg6Res.status !== 400) {
    throw new Error(`Expected HTTP 400 for rating 6, got ${neg6Res.status}`);
  }
  const neg6Json = await neg6Res.json();
  console.log('Negative response message:', neg6Json.message);
  console.log('✓ Negative Test 2 Passed: Rating 6 rejected with HTTP 400 Bad Request');

  // Step 4: Authorization Test — Evaluate milestone belonging to unmanaged employee
  console.log('\nStep 4: Authorization Test — Manager attempting to evaluate unmanaged employee milestone...');
  const authRes = await fetch(`${API_BASE}/milestones/${unmanagedMilestone._id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({
      status: 'approved',
      managerRating: 5,
      managerFeedback: 'Unauthorized approval attempt',
    }),
  });
  console.log(`Authorization test response status: ${authRes.status}`);
  if (authRes.status !== 403) {
    throw new Error(`Expected HTTP 403 for unauthorized milestone evaluation, got ${authRes.status}`);
  }
  const authJson = await authRes.json();
  console.log('Authorization response message:', authJson.message);
  console.log('✓ Authorization Test Passed: Non-direct-report evaluation rejected with HTTP 403 Forbidden');

  // Step 5: Alternative Path — Request Revision
  console.log('\nStep 5: Alternative Path — Manager requests revision with notes...');
  const revRes = await fetch(`${API_BASE}/milestones/${directMilestone._id}/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({
      status: 'revision_requested',
      approvalStatus: 'revision_requested',
      managerRating: 3,
      managerFeedback: 'Please add reflections on recent automated integration tests.',
    }),
  });
  console.log(`Revision request response status: ${revRes.status}`);
  if (revRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for revision request, got ${revRes.status}`);
  }
  const revJson = await revRes.json();
  console.log('Revision response status in body:', revJson.data?.status);
  if (revJson.data?.status !== 'revision_requested') {
    throw new Error(`Expected status to be revision_requested, got ${revJson.data?.status}`);
  }
  console.log('✓ Alternative Path Passed: Revision requested successfully');

  // Reset to pending_manager_review for Happy Path
  directMilestone.status = 'pending_manager_review';
  directMilestone.managerRating = undefined;
  directMilestone.managerFeedback = undefined;
  directMilestone.evaluatedAt = undefined;
  await directMilestone.save();

  // Step 6: Happy Path — Fetch team milestones
  console.log('\nStep 6: Happy Path — Fetching team milestones via GET /api/v1/milestones/team-milestones...');
  const teamRes = await fetch(`${API_BASE}/milestones/team-milestones`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  if (teamRes.status !== 200) {
    throw new Error(`Expected HTTP 200 from team-milestones, got ${teamRes.status}`);
  }
  const teamJson = await teamRes.json();
  const directM = teamJson.data?.find((m: any) => m.milestoneCode === 'mls-eval-01' || String(m._id) === String(directMilestone._id));
  if (!directM) {
    throw new Error('Day 30 milestone for direct report not found in team-milestones response!');
  }
  const unmanagedM = teamJson.data?.find((m: any) => String(m._id) === String(unmanagedMilestone._id));
  if (unmanagedM) {
    throw new Error('Data leakage detected: Unmanaged milestone appeared in team-milestones!');
  }
  console.log(`✓ Direct report milestone located: ${directM.milestoneTitle}, status: ${directM.status}`);
  console.log(`✓ Verified employee rating: ${directM.employeeRating}/5, comments: "${directM.comments}"`);
  console.log('✓ Verified zero cross-manager data leakage in team milestones list');

  // Step 7: Happy Path — Manager Approves Milestone via POST /api/v1/milestones/mls-eval-01/evaluate
  console.log('\nStep 7: Happy Path — Submitting formal approval via POST /api/v1/milestones/mls-eval-01/evaluate...');
  const evalRes = await fetch(`${API_BASE}/milestones/mls-eval-01/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({
      status: 'approved',
      managerRating: 5,
      managerFeedback: 'Exceeded expectations on ramp-up. Completed initial project ahead of schedule.',
    }),
  });
  console.log(`Evaluation POST response status: ${evalRes.status}`);
  if (evalRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for evaluate POST, got ${evalRes.status}`);
  }
  const evalJson = await evalRes.json();
  console.log('Evaluate response payload:', {
    success: evalJson.success,
    id: evalJson.data?._id,
    milestoneCode: evalJson.data?.milestoneCode,
    status: evalJson.data?.status,
    managerRating: evalJson.data?.managerRating,
    managerFeedback: evalJson.data?.managerFeedback,
  });
  if (evalJson.data?.status !== 'approved') {
    throw new Error(`Expected response status to be 'approved', got ${evalJson.data?.status}`);
  }
  if (evalJson.data?.managerRating !== 5) {
    throw new Error(`Expected managerRating to be 5, got ${evalJson.data?.managerRating}`);
  }
  console.log('✓ Step 7 Passed: POST /api/v1/milestones/mls-eval-01/evaluate returned 200 OK');

  // Step 8: Data Integrity Checks in MongoDB
  console.log('\nStep 8: Verifying MongoDB MilestonePlan state...');
  const verifiedMilestone = await MilestonePlan.findOne({ milestoneCode: 'mls-eval-01' }).lean();
  if (!verifiedMilestone) {
    throw new Error('MilestonePlan not found in MongoDB!');
  }
  console.log('MongoDB MilestonePlan record:', {
    _id: verifiedMilestone._id,
    milestoneCode: verifiedMilestone.milestoneCode,
    status: verifiedMilestone.status,
    managerRating: verifiedMilestone.managerRating,
    managerFeedback: verifiedMilestone.managerFeedback,
    evaluatedAt: verifiedMilestone.evaluatedAt,
    managerReviewStatus: verifiedMilestone.managerReview?.approvalStatus,
    managerReviewRating: verifiedMilestone.managerReview?.performanceRating,
  });

  if (verifiedMilestone.status !== 'approved') {
    throw new Error(`Expected MongoDB status == "approved", got "${verifiedMilestone.status}"`);
  }
  if (verifiedMilestone.managerRating !== 5) {
    throw new Error(`Expected MongoDB managerRating == 5, got ${verifiedMilestone.managerRating}`);
  }
  if (!verifiedMilestone.evaluatedAt) {
    throw new Error('Expected MongoDB evaluatedAt to be populated');
  }
  if (!verifiedMilestone.managerFeedback?.includes('Exceeded expectations')) {
    throw new Error('Expected MongoDB managerFeedback to match submitted text');
  }
  console.log('✓ Step 8 Passed: MongoDB MilestonePlan strictly has status="approved", managerRating=5, and evaluatedAt set');

  // Step 9: Integration Check — Employee Notification
  console.log('\nStep 9: Integration Check — Employee Notification verification...');
  const employeeNotification = await Notification.findOne({
    organizationId: org._id,
    recipientUserId: directHire._id,
    title: { $regex: /Milestone.*Approved/i },
  }).sort({ createdAt: -1 });

  if (!employeeNotification) {
    throw new Error('Expected notification to direct hire upon milestone approval!');
  }
  console.log('Employee notification found:', {
    id: employeeNotification._id,
    recipientUserId: employeeNotification.recipientUserId,
    title: employeeNotification.title,
    message: employeeNotification.message,
    priority: employeeNotification.priority,
  });
  console.log('✓ Step 9 Passed: Employee received milestone approval notification');

  // Step 10: Reset milestone status back to pending_manager_review for live browser UI verification
  console.log('\nStep 10: Preparing clean pending_manager_review state for Browser Subagent...');
  await EmployeeMilestone.updateOne(
    { milestoneCode: 'mls-eval-01' },
    {
      $set: {
        status: 'pending_manager_review',
      },
      $unset: {
        managerRating: 1,
        managerFeedback: 1,
        evaluatedAt: 1,
        managerReview: 1,
      },
    }
  );
  console.log('✓ Direct hire milestone reset to pending_manager_review for Browser UI testing');

  console.log('\n========================================================================');
  console.log('=== ALL AUTOMATED TESTS FOR UJ-MGR-002 COMPLETED SUCCESSFULLY (PASS) ===');
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runUJMGR002Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
