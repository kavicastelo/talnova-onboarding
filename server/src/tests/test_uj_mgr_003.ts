import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { Task } from '../modules/tasks/models/task.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJMGR003Tests() {
  console.log('========================================================================');
  console.log('=== RUNNING JOURNEY TEST UJ-MGR-003: Approve & Verify Direct Report Tasks ===');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const managerEmail = 'manager@talnova.test';
  const otherManagerEmail = 'other_manager@talnova.test';
  const directHireEmail = 'direct_hire@talnova.test';
  const otherHireEmail = 'other_hire@talnova.test';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  console.log('Step 0: Initializing test tenant, managers, and direct reports in MongoDB...');
  // Check if manager already exists
  let manager = await User.findOne({ 'auth.email': managerEmail.toLowerCase(), isDeleted: false });
  let org: any;
  if (manager && manager.organizationId) {
    org = await Organization.findById(manager.organizationId);
  }
  if (!org) {
    org = await Organization.findOne({ isDeleted: false });
  }
  if (!org) {
    org = new Organization({
      name: 'Talnova Corp',
      slug: `talnova-corp-${Date.now()}`,
      supportEmail: 'support@talnova.test',
    });
    await org.save();
  }

  // Manager User
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
        hireDate: new Date('2026-08-01T00:00:00.000Z'),
      },
      permissions: { role: 'employee', customRoles: [] },
    });
    await otherHire.save();
  } else {
    otherHire.employment = otherHire.employment || {};
    otherHire.employment.managerId = otherManager._id;
    await otherHire.save();
  }

  // Helper: Login
  async function login(email: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
    return data.data.accessToken;
  }

  console.log('\nAuthenticating test actors...');
  const managerToken = await login(managerEmail);
  const otherManagerToken = await login(otherManagerEmail);
  const employeeToken = await login(directHireEmail);
  console.log('✅ All actors authenticated successfully.');

  // Step 1: Clean and Seed Test Tasks
  console.log('\n--- Step 1: Seeding Tasks for UJ-MGR-003 ---');
  await Task.deleteMany({
    organizationId: org._id,
    taskCode: { $in: ['task-review-01', 'task-downstream-01', 'task-other-01'] },
  });

  const reviewTask = new Task({
    organizationId: org._id,
    taskCode: 'task-review-01',
    title: 'First Week Architecture Review',
    description: 'Review core architecture patterns, service boundaries, and security standards.',
    category: 'it_setup',
    stage: 'week_1',
    priority: 'high',
    status: 'completed',
    requiresVerification: true,
    assignedToUserId: directHire._id,
    employeeId: directHire._id,
    createdBy: manager._id,
    completedAt: new Date(),
    completedBy: directHire._id,
    statusHistory: [
      {
        status: 'pending',
        changedAt: new Date(Date.now() - 86400000 * 2),
        changedBy: manager._id,
      },
      {
        status: 'completed',
        changedAt: new Date(),
        changedBy: directHire._id,
        notes: 'Employee completed architecture review.',
      },
    ],
    comments: [
      {
        userId: directHire._id,
        comment: 'Completed reading through architecture RFCs and microservice diagrams. Attached notes and design proposals.',
        createdAt: new Date(),
      },
    ],
  });
  await reviewTask.save();
  console.log(`✅ Seeded Task "First Week Architecture Review" (taskCode: task-review-01, id: ${reviewTask._id})`);

  // Downstream task that requires task-review-01 as prerequisite
  const downstreamTask = new Task({
    organizationId: org._id,
    taskCode: 'task-downstream-01',
    title: 'Deploy Architecture RFC Service',
    description: 'Deploy the new service after architecture review is verified.',
    category: 'it_setup',
    stage: 'month_1',
    priority: 'normal',
    status: 'pending',
    assignedToUserId: directHire._id,
    employeeId: directHire._id,
    createdBy: manager._id,
    prerequisiteTaskIds: [reviewTask._id],
  });
  await downstreamTask.save();
  console.log(`✅ Seeded downstream prerequisite Task "Deploy Architecture RFC Service" (taskCode: task-downstream-01)`);

  // Other employee's task (Cyberdyne)
  const otherTask = new Task({
    organizationId: org._id,
    taskCode: 'task-other-01',
    title: 'Cyberdyne Secure Terminal Provisioning',
    description: 'Provision terminal access for Cyberdyne projects.',
    category: 'it_setup',
    stage: 'week_1',
    priority: 'high',
    status: 'completed',
    requiresVerification: true,
    assignedToUserId: otherHire._id,
    employeeId: otherHire._id,
    createdBy: otherManager._id,
  });
  await otherTask.save();
  console.log(`✅ Seeded Unmanaged Task (taskCode: task-other-01)`);
  const localFound = await Task.find({
    organizationId: org._id,
    isDeleted: false,
    $or: [
      { employeeId: { $in: [directHire._id] } },
      { assignedToUserId: { $in: [directHire._id] } },
    ]
  });
  console.log('Local MongoDB query found count:', localFound.length, 'org._id:', org._id);

  // Step 2: Query Tasks as Manager with direct reports filter
  console.log('\n--- Step 2: Manager Queries Tasks with Direct Reports Filter ---');
  const listRes = await fetch(`${API_BASE}/tasks?directReportsOnly=true`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  const listBody = await listRes.json();
  console.log(`GET /api/v1/tasks?directReportsOnly=true status: ${listRes.status}`);
  if (!listRes.ok) {
    throw new Error(`Failed to list direct report tasks: ${JSON.stringify(listBody)}`);
  }
  const returnedTasks = Array.isArray(listBody.data) ? listBody.data : (listBody.data?.tasks || []);
  console.log(`Returned tasks count: ${returnedTasks.length}`);
  console.log('Returned tasks:', JSON.stringify(returnedTasks, null, 2));
  const hasReviewTask = returnedTasks.some((t: any) => t.taskCode === 'task-review-01' || t.title === 'First Week Architecture Review');
  const hasOtherTask = returnedTasks.some((t: any) => t.taskCode === 'task-other-01');

  if (!hasReviewTask) {
    throw new Error('Expected task-review-01 to be returned in direct report tasks, but it was not.');
  }
  if (hasOtherTask) {
    throw new Error('SECURITY VIOLATION: task-other-01 belonging to unmanaged employee was leaked to manager!');
  }
  console.log('✅ Direct reports filter correctly returned direct report tasks without cross-manager data leakage.');

  // Step 3: Negative Test - Regular Employee Attempting Verification
  console.log('\n--- Step 3: Negative Test - Regular Employee Attempting Verification ---');
  const empVerifyRes = await fetch(`${API_BASE}/tasks/task-review-01/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${employeeToken}`,
    },
    body: JSON.stringify({ status: 'verified' }),
  });
  const empVerifyBody = await empVerifyRes.json();
  console.log(`Employee PATCH /api/v1/tasks/task-review-01/status status: ${empVerifyRes.status}`);
  if (empVerifyRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden when employee attempts self-verification, got ${empVerifyRes.status}`);
  }
  console.log(`✅ Negative Test Passed: Employee blocked with 403 Forbidden (${empVerifyBody.message || empVerifyBody.error})`);

  // Step 4: Negative Test - Manager Attempting Verification on Unmanaged Employee Task
  console.log('\n--- Step 4: Negative Test - Manager Attempting Verification on Unmanaged Employee Task ---');
  const unmanagedVerifyRes = await fetch(`${API_BASE}/tasks/task-other-01/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({ status: 'verified' }),
  });
  const unmanagedVerifyBody = await unmanagedVerifyRes.json();
  console.log(`Manager PATCH /api/v1/tasks/task-other-01/status status: ${unmanagedVerifyRes.status}`);
  if (unmanagedVerifyRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden when manager verifies unmanaged employee's task, got ${unmanagedVerifyRes.status}`);
  }
  console.log(`✅ Negative Test Passed: Manager blocked from verifying unmanaged task with 403 Forbidden (${unmanagedVerifyBody.message || unmanagedVerifyBody.error})`);

  // Step 5: Manager adds feedback comment before or during verification
  console.log('\n--- Step 5: Manager Adds Review Note / Feedback Comment ---');
  const commentRes = await fetch(`${API_BASE}/tasks/task-review-01/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({ comment: 'Architecture review looks thorough and well-documented. Verification granted.' }),
  });
  const commentBody = await commentRes.json();
  console.log(`POST /api/v1/tasks/task-review-01/comments status: ${commentRes.status}`);
  if (!commentRes.ok) {
    throw new Error(`Failed to add comment: ${JSON.stringify(commentBody)}`);
  }
  console.log('✅ Manager successfully posted feedback comment to task.');

  // Step 6: Happy Path - Manager Verifies Direct Report Task
  console.log('\n--- Step 6: Happy Path - Manager Verifies Direct Report Task ---');
  const verifyRes = await fetch(`${API_BASE}/tasks/task-review-01/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${managerToken}`,
    },
    body: JSON.stringify({ status: 'verified' }),
  });
  const verifyBody = await verifyRes.json();
  console.log(`Manager PATCH /api/v1/tasks/task-review-01/status status: ${verifyRes.status}`);
  if (verifyRes.status !== 200) {
    throw new Error(`Expected HTTP 200 OK on task verification, got ${verifyRes.status}: ${JSON.stringify(verifyBody)}`);
  }
  const verifiedTaskData = verifyBody.data;
  console.log(`Verified Task status in response: ${verifiedTaskData.status}`);
  if (verifiedTaskData.status !== 'verified') {
    throw new Error(`Expected status 'verified', got '${verifiedTaskData.status}'`);
  }
  console.log('✅ Task verification PATCH returned 200 OK with verified status.');

  // Step 7: MongoDB Data Integrity Check
  console.log('\n--- Step 7: MongoDB Data Integrity & Audit Checks ---');
  const dbTask = await Task.findById(reviewTask._id);
  if (!dbTask) throw new Error('Task not found in MongoDB');

  console.log(`MongoDB Task Status: ${dbTask.status}`);
  console.log(`MongoDB VerifiedAt: ${dbTask.verifiedAt}`);
  console.log(`MongoDB VerifiedBy: ${dbTask.verifiedBy}`);
  console.log(`MongoDB StatusHistory length: ${dbTask.statusHistory?.length}`);

  if (dbTask.status !== 'verified') {
    throw new Error(`Database task status mismatch. Expected 'verified', got '${dbTask.status}'`);
  }
  if (!dbTask.verifiedBy || dbTask.verifiedBy.toString() !== manager._id.toString()) {
    throw new Error(`Expected verifiedBy to be manager ${manager._id}, got ${dbTask.verifiedBy}`);
  }

  const verifiedHistoryEntry = dbTask.statusHistory?.find((h: any) => h.status === 'verified');
  if (!verifiedHistoryEntry) {
    throw new Error('Expected statusHistory entry for "verified" status, none found!');
  }
  if (verifiedHistoryEntry.changedBy?.toString() !== manager._id.toString()) {
    throw new Error(`Expected statusHistory.changedBy to be manager ${manager._id}, got ${verifiedHistoryEntry.changedBy}`);
  }
  console.log('✅ MongoDB Data Integrity: verifiedBy and statusHistory successfully recorded manager audit entry.');

  // Step 8: Integration Check - Downstream Prerequisite Unblocking
  console.log('\n--- Step 8: Integration Check - Downstream Prerequisite Verification ---');
  // Check if downstream task prerequisites are satisfied
  const downstreamDbTask = await Task.findById(downstreamTask._id);
  if (!downstreamDbTask) throw new Error('Downstream task not found in MongoDB');

  const prereqTasks = await Task.find({
    _id: { $in: downstreamDbTask.prerequisiteTaskIds },
    status: { $nin: ['completed', 'verified'] },
  });
  console.log(`Remaining uncompleted/unverified prerequisites count: ${prereqTasks.length}`);
  if (prereqTasks.length !== 0) {
    throw new Error('Expected downstream task prerequisites to be fully satisfied after verification!');
  }
  console.log('✅ Prerequisite check succeeded: Downstream task is unblocked by verified task.');

  // Step 9: Reset task-review-01 status to 'completed' for UI Browser Test
  console.log('\n--- Step 9: Preparing Task State for UI Browser Subagent ---');
  dbTask.status = 'completed';
  dbTask.verifiedAt = undefined;
  dbTask.verifiedBy = undefined;
  await dbTask.save();
  console.log('✅ Task "First Week Architecture Review" (task-review-01) reset to "completed" with requiresVerification=true.');
  console.log('Ready for live UI verification test in browser!');

  await mongoose.disconnect();
  console.log('\n========================================================================');
  console.log('=== UJ-MGR-003 AUTOMATED API & INTEGRATION SUITE: ALL TESTS PASSED ===');
  console.log('========================================================================\n');
}

runUJMGR003Tests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
