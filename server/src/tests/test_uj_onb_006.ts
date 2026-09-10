import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { MilestoneTemplate } from '../modules/milestones/models/milestone-template.model.js';
import { EmployeeMilestone } from '../modules/milestones/models/employee-milestone.model.js';
import { Notification } from '../modules/notifications/models/notification.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJONB006Tests() {
  console.log('=== RUNNING JOURNEY TEST UJ-ONB-006: Submit Day 30-60-90 Self-Rating ===\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing in .env');
  await mongoose.connect(mongoUri);

  const employeeEmail = 'employee@talnova.test';
  const managerEmail = 'manager@talnova.test';
  const otherEmployeeEmail = 'other_employee@talnova.test';
  const password = 'Password123!';

  // Step 0: Ensure Preconditions
  console.log('Step 0: Ensuring organization, manager, and employee exist...');
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

  let manager = await User.findOne({ 'auth.email': managerEmail.toLowerCase(), isDeleted: false });
  if (!manager) {
    manager = new User({
      organizationId: org._id,
      auth: { email: managerEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Team', lastName: 'Manager', fullName: 'Team Manager' },
      employment: { employmentType: 'full_time', status: 'active', jobTitle: 'Engineering Manager' },
      permissions: { role: 'manager', customRoles: [] },
    });
    await manager.save();
  }

  let employee = await User.findOne({ 'auth.email': employeeEmail.toLowerCase(), isDeleted: false });
  if (!employee) {
    employee = new User({
      organizationId: org._id,
      auth: { email: employeeEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Employee', lastName: 'Learner', fullName: 'Employee Learner' },
      employment: { employmentType: 'full_time', status: 'active', managerId: manager._id },
      permissions: { role: 'employee', customRoles: [] },
    });
    await employee.save();
  } else {
    // Ensure manager is linked
    employee.employment = employee.employment || {};
    employee.employment.managerId = manager._id;
    await employee.save();
  }

  let otherEmployee = await User.findOne({ 'auth.email': otherEmployeeEmail.toLowerCase(), isDeleted: false });
  if (!otherEmployee) {
    otherEmployee = new User({
      organizationId: org._id,
      auth: { email: otherEmployeeEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Other', lastName: 'Employee', fullName: 'Other Employee' },
      employment: { employmentType: 'full_time', status: 'active', managerId: manager._id },
      permissions: { role: 'employee', customRoles: [] },
    });
    await otherEmployee.save();
  }

  // Precondition 2: Create or verify Day 30 MilestoneTemplate
  let template = await MilestoneTemplate.findOne({ organizationId: org._id, targetDay: 30, isDeleted: false });
  if (!template) {
    template = new MilestoneTemplate({
      organizationId: org._id,
      title: 'Day 30 Milestone Evaluation',
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
  console.log(`✓ Milestone Template ready (ID: ${template._id})`);

  // Create Milestone for Employee
  await EmployeeMilestone.deleteMany({ organizationId: org._id, employeeId: employee._id, targetDay: 30 });
  const milestone = new EmployeeMilestone({
    organizationId: org._id,
    templateId: template._id,
    employeeId: employee._id,
    assignedBy: manager._id,
    milestoneTitle: 'Day 30 Milestone Evaluation',
    targetDay: 30,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'pending',
    goalsProgress: [
      { goalTitle: 'Independent ticket resolution and PR approvals', completed: true, completedAt: new Date() },
      { goalTitle: 'Complete all mandatory compliance and security onboarding', completed: true, completedAt: new Date() },
    ],
  });
  await milestone.save();
  console.log(`✓ Created Employee Milestone (ID: ${milestone._id})`);

  // Create Milestone for Other Employee (for authorization testing)
  await EmployeeMilestone.deleteMany({ organizationId: org._id, employeeId: otherEmployee._id, targetDay: 30 });
  const otherMilestone = new EmployeeMilestone({
    organizationId: org._id,
    templateId: template._id,
    employeeId: otherEmployee._id,
    assignedBy: manager._id,
    milestoneTitle: 'Day 30 Milestone Evaluation',
    targetDay: 30,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'pending',
    goalsProgress: [
      { goalTitle: 'Independent ticket resolution and PR approvals', completed: false },
    ],
  });
  await otherMilestone.save();

  // Step 1: Authenticate as Employee
  console.log('\nStep 1: Authenticating as employee...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeEmail, password }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken;
  if (!token) throw new Error('Employee login failed');
  console.log('✓ Step 1 Passed: Employee token obtained');

  // Step 2: Negative Test 1 — Invalid rating = 0 (Bounds: 1-5)
  console.log('\nStep 2: Negative Test — Submit rating with invalid value (0)...');
  const neg0Res = await fetch(`${API_BASE}/milestones/${milestone._id}/self-evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      employeeRating: 0,
      comments: 'Testing 0 rating boundary',
    }),
  });
  console.log(`Negative test (rating 0) response status: ${neg0Res.status}`);
  const neg0Data = await neg0Res.json();
  console.log('Response body:', neg0Data);
  if (neg0Res.status !== 400) {
    throw new Error(`Expected HTTP 400 for rating 0, got ${neg0Res.status}`);
  }
  console.log('✓ Negative Test 1 Passed: Rating 0 rejected with HTTP 400');

  // Step 3: Negative Test 2 — Invalid rating = 6 (Bounds: 1-5)
  console.log('\nStep 3: Negative Test — Submit rating with invalid value (6)...');
  const neg6Res = await fetch(`${API_BASE}/milestones/${milestone._id}/self-evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      employeeRating: 6,
      comments: 'Testing 6 rating boundary',
    }),
  });
  console.log(`Negative test (rating 6) response status: ${neg6Res.status}`);
  const neg6Data = await neg6Res.json();
  console.log('Response body:', neg6Data);
  if (neg6Res.status !== 400) {
    throw new Error(`Expected HTTP 400 for rating 6, got ${neg6Res.status}`);
  }
  console.log('✓ Negative Test 2 Passed: Rating 6 rejected with HTTP 400');

  // Step 4: Authorization Test — Employee submitting evaluation for another user's milestone
  console.log('\nStep 4: Authorization Test — Attempting to evaluate another user\'s milestone...');
  const authRes = await fetch(`${API_BASE}/milestones/${otherMilestone._id}/self-evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      employeeRating: 4,
      comments: 'Intruding on another milestone',
    }),
  });
  console.log(`Authorization test response status: ${authRes.status}`);
  const authData = await authRes.json();
  console.log('Response body:', authData);
  if (authRes.status !== 403) {
    throw new Error(`Expected HTTP 403 for cross-user milestone submission, got ${authRes.status}`);
  }
  console.log('✓ Authorization Test Passed: Rejected with HTTP 403 FORBIDDEN');

  // Step 5: Happy Path — Submit valid Day 30 self-evaluation (Rating 4)
  console.log('\nStep 5: Happy Path — Submitting valid Day 30 evaluation (Rating: 4)...');
  const happyRes = await fetch(`${API_BASE}/milestones/${milestone._id}/self-evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      employeeRating: 4,
      confidenceRating: 4,
      comments: 'Ramping up well on team workflows. Ready for independent tickets.',
      reflectionNotes: 'Ramping up well on team workflows. Ready for independent tickets.',
    }),
  });
  console.log(`Happy path response status: ${happyRes.status}`);
  const happyData = await happyRes.json();
  console.log('Response body:', happyData);
  if (happyRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for valid self-evaluation, got ${happyRes.status}`);
  }
  if (!happyData.success) {
    throw new Error('API reported success: false');
  }
  console.log('✓ Step 5 Passed: POST /api/v1/milestones/:id/self-evaluation returned 200 OK');

  // Step 6: Data Integrity Checks in MongoDB
  console.log('\nStep 6: Data Integrity Checks in MongoDB...');
  const savedMilestone = await EmployeeMilestone.findById(milestone._id);
  if (!savedMilestone) throw new Error('Milestone not found in database');

  console.log('Saved Milestone data:', {
    _id: savedMilestone._id,
    targetDay: savedMilestone.targetDay,
    status: savedMilestone.status,
    employeeRating: savedMilestone.employeeRating,
    submittedAt: savedMilestone.submittedAt,
    selfCheckConfidence: savedMilestone.employeeSelfCheck?.confidenceRating,
    selfCheckComments: savedMilestone.employeeSelfCheck?.comments,
  });

  if (savedMilestone.employeeRating !== 4) {
    throw new Error(`Expected employeeRating == 4, got ${savedMilestone.employeeRating}`);
  }
  if (!savedMilestone.submittedAt) {
    throw new Error('Expected submittedAt timestamp to be populated');
  }
  if (savedMilestone.status !== 'pending_manager_review' && savedMilestone.status !== 'in_review') {
    throw new Error(`Expected status to transition to pending_manager_review, got ${savedMilestone.status}`);
  }
  if (savedMilestone.employeeSelfCheck?.comments !== 'Ramping up well on team workflows. Ready for independent tickets.') {
    throw new Error('Comments in employeeSelfCheck did not match submitted text');
  }
  console.log('✓ Step 6 Passed: MongoDB record updated with employeeRating: 4, comments, submittedAt, and pending_manager_review status');

  // Step 7: Integration Check — Manager Notification
  console.log('\nStep 7: Integration Check — Manager Notification verification...');
  const managerNotification = await Notification.findOne({
    organizationId: org._id,
    recipientUserId: manager._id,
    title: { $regex: /Milestone.*Submitted/i },
  }).sort({ createdAt: -1 });

  if (!managerNotification) {
    throw new Error('Expected manager notification to be generated upon milestone self-evaluation submission!');
  }
  console.log('Manager notification found:', {
    id: managerNotification._id,
    recipientUserId: managerNotification.recipientUserId,
    title: managerNotification.title,
    message: managerNotification.message,
    priority: managerNotification.priority,
  });
  console.log('✓ Step 7 Passed: Manager notification verified in database');

  // Step 8: Prepare fresh state for Browser Subagent
  console.log('\nStep 8: Resetting milestone state for Browser Subagent execution...');
  savedMilestone.status = 'pending';
  savedMilestone.employeeRating = undefined;
  savedMilestone.submittedAt = undefined;
  savedMilestone.comments = undefined;
  savedMilestone.employeeSelfCheck = undefined;
  await savedMilestone.save();
  console.log(`✓ Milestone ${savedMilestone._id} reset to pending state for browser UI test!`);

  console.log('\n======================================================');
  console.log('ALL PROGRAMMATIC TESTS FOR UJ-ONB-006 PASSED SUCCESSFULLY!');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

runUJONB006Tests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
