import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../modules/organizations/models/organization.model.js';
import User from '../modules/auth/models/user.model.js';
import Task from '../modules/tasks/models/task.model.js';
import { hashPassword } from '../utils/crypto.js';

dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJIT001Tests() {
  console.log('========================================================================');
  console.log('=== RUNNING JOURNEY TEST UJ-IT-001: IT Hardware Provisioning Workflow ===');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const itEmail = 'it_operator@talnova.test';
  const newHireEmail = 'new_hire_alex@talnova.test';
  const unauthEmployeeEmail = 'unauth_emp@talnova.test';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  console.log('Step 0: Initializing test tenant, users, and IT provisioning task...');

  // 1. Organization
  let org = await Organization.findOne({ slug: 'talnova-hq', isDeleted: false });
  if (!org) {
    org = new Organization({
      name: 'Talnova HQ',
      slug: 'talnova-hq',
      domain: 'talnova.test',
      plan: 'Enterprise',
      status: 'Active',
      supportEmail: 'support@talnova.test',
      createdBy: new mongoose.Types.ObjectId()
    });
    await org.save();
  }

  // 2. IT Operator
  let itOperator = await User.findOne({ 'auth.email': itEmail });
  if (!itOperator) {
    itOperator = new User({
      organizationId: org._id,
      auth: { email: itEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Marcus', lastName: 'Vance', fullName: 'Marcus Vance' },
      employment: { department: 'IT Operations', jobTitle: 'IT Systems Engineer', status: 'active', employmentType: 'full_time' },
      permissions: { role: 'employee', customRoles: ['it_admin'] }
    });
    await itOperator.save();
  } else {
    itOperator.auth.passwordHash = passwordHash;
    await itOperator.save();
  }

  // 3. New Hire Target Employee
  let newHire = await User.findOne({ 'auth.email': newHireEmail });
  if (!newHire) {
    newHire = new User({
      organizationId: org._id,
      auth: { email: newHireEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Alex', lastName: 'Mercer', fullName: 'Alex Mercer' },
      employment: { department: 'Engineering', jobTitle: 'Senior Frontend Engineer', status: 'active', employmentType: 'full_time' },
      permissions: { role: 'employee', customRoles: [] }
    });
    await newHire.save();
  }

  // 4. Unauthorized Regular Employee
  let unauthEmp = await User.findOne({ 'auth.email': unauthEmployeeEmail });
  if (!unauthEmp) {
    unauthEmp = new User({
      organizationId: org._id,
      auth: { email: unauthEmployeeEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Diana', lastName: 'Prince', fullName: 'Diana Prince' },
      employment: { department: 'Marketing', jobTitle: 'Marketing Specialist', status: 'active', employmentType: 'full_time' },
      permissions: { role: 'employee', customRoles: [] }
    });
    await unauthEmp.save();
  }

  // 5. Clean up & Seed Task: task-it-hardware-01
  const taskCode = 'task-it-hardware-01';
  await Task.deleteMany({ taskCode });

  const itTask = new Task({
    organizationId: org._id,
    taskCode,
    title: 'Order Laptop & Provision Access',
    description: 'Order Dell XPS 15 laptop, configure Okta SSO, issue VPN certificate, and record asset tag.',
    category: 'it_setup',
    stage: 'preboarding',
    priority: 'high',
    status: 'pending',
    assignedToUserId: itOperator._id,
    employeeId: newHire._id,
    createdBy: org.createdBy || itOperator._id,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    comments: [],
    statusHistory: [
      {
        status: 'pending',
        changedBy: itOperator._id,
        changedAt: new Date(),
        note: 'Task initialized by onboarding trigger'
      }
    ]
  });
  await itTask.save();
  console.log(`✅ Seeded IT provisioning task ${taskCode} for employee Alex Mercer assigned to Marcus Vance.`);

  // Login helper
  async function login(email: string): Promise<string> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Login failed for ${email}: ${JSON.stringify(data)}`);
    }
    return data.data.accessToken;
  }

  console.log('Authenticating test actors...');
  const itToken = await login(itEmail);
  const unauthToken = await login(unauthEmployeeEmail);
  console.log('✅ Both actors authenticated successfully.');

  // =========================================================================
  // 1. Negative Test: Unauthorized Non-Assignee Attempt
  // =========================================================================
  console.log('\n--- Test Phase 1: Authorization Boundary (Non-Assignee Mutation Rejection) ---');
  const unauthRes = await fetch(`${API_BASE}/tasks/${taskCode}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${unauthToken}`
    },
    body: JSON.stringify({ status: 'completed' })
  });
  const unauthData = await unauthRes.json();
  console.log(`[Unauth Attempt Network Log] Status: ${unauthRes.status}`, unauthData);

  if (unauthRes.status === 403 && (unauthData.code === 'FORBIDDEN_TASK_MUTATION' || unauthData.error?.code === 'FORBIDDEN_TASK_MUTATION' || unauthData.message?.includes('assigned'))) {
    console.log('✅ PASS: Unauthorized employee strictly rejected with HTTP 403 Forbidden (FORBIDDEN_TASK_MUTATION).');
  } else {
    throw new Error(`AUTHORIZATION_FAILURE: Expected 403 Forbidden, got ${unauthRes.status}`);
  }

  // =========================================================================
  // 2. Query / Filter Tasks by Category: it_setup
  // =========================================================================
  console.log('\n--- Test Phase 2: Category Filter Query (category=it_setup) ---');
  const filterRes = await fetch(`${API_BASE}/tasks?category=it_setup`, {
    headers: { Authorization: `Bearer ${itToken}` }
  });
  const filterData = await filterRes.json();
  console.log(`[Category Filter Network Log] Status: ${filterRes.status}, Count: ${filterData.data?.length}`);

  if (filterRes.status !== 200 || !filterData.success) {
    throw new Error(`Failed to list tasks: ${JSON.stringify(filterData)}`);
  }
  const foundTask = filterData.data.find((t: any) => t.taskCode === taskCode);
  if (!foundTask) {
    throw new Error(`Task ${taskCode} not returned under category filter 'it_setup'`);
  }
  if (foundTask.category !== 'it_setup') {
    throw new Error(`Task category mismatch: expected it_setup, got ${foundTask.category}`);
  }
  console.log(`✅ PASS: Located task "${foundTask.title}" with category it_setup and status ${foundTask.status}.`);

  // =========================================================================
  // 3. Alternative Path: Flag in_progress while awaiting shipment
  // =========================================================================
  console.log('\n--- Test Phase 3: Alternative Path - Transition to in_progress ---');
  const inProgRes = await fetch(`${API_BASE}/tasks/${taskCode}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${itToken}`
    },
    body: JSON.stringify({ status: 'in_progress', note: 'Awaiting hardware shipment from Dell' })
  });
  const inProgData = await inProgRes.json();
  console.log(`[in_progress Network Log] Status: ${inProgRes.status}`, inProgData.data?.status);

  if (inProgRes.status !== 200 || inProgData.data?.status !== 'in_progress') {
    throw new Error(`Failed to transition to in_progress: ${JSON.stringify(inProgData)}`);
  }
  const inProgDbTask = await Task.findOne({ taskCode });
  if (inProgDbTask?.status !== 'in_progress') {
    throw new Error(`MongoDB status mismatch: expected in_progress, got ${inProgDbTask?.status}`);
  }
  console.log('✅ PASS: Task status transitioned to in_progress in MongoDB.');

  // =========================================================================
  // 4. Add Comment with Hardware Asset Tag & Serial Number
  // =========================================================================
  console.log('\n--- Test Phase 4: Record Asset Tag and Serial Number Comment ---');
  const commentText = 'Configured Dell XPS 15. Asset Tag #TAL-IT-4891. Serial #SN-884912.';
  const commentRes = await fetch(`${API_BASE}/tasks/${taskCode}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${itToken}`
    },
    body: JSON.stringify({ comment: commentText })
  });
  const commentData = await commentRes.json();
  console.log(`[Comment Network Log] Status: ${commentRes.status}`, commentData.data?.comments?.slice(-1));

  if (commentRes.status !== 200 || !commentData.success) {
    throw new Error(`Failed to add comment: ${JSON.stringify(commentData)}`);
  }
  const lastComment = commentData.data?.comments?.slice(-1)[0];
  if (!lastComment || !lastComment.comment.includes('SN-884912')) {
    throw new Error(`Comment text mismatch: ${JSON.stringify(lastComment)}`);
  }
  console.log(`✅ PASS: Comment recorded with serial number: "${lastComment.comment}".`);

  // =========================================================================
  // 5. Happy Path: Complete IT Task
  // =========================================================================
  console.log('\n--- Test Phase 5: Complete IT Hardware Setup Task ---');
  const completeRes = await fetch(`${API_BASE}/tasks/${taskCode}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${itToken}`
    },
    body: JSON.stringify({ status: 'completed' })
  });
  const completeData = await completeRes.json();
  console.log(`[Complete Network Log] Status: ${completeRes.status}`, completeData.data?.status);

  if (completeRes.status !== 200 || completeData.data?.status !== 'completed') {
    throw new Error(`Failed to complete task: ${JSON.stringify(completeData)}`);
  }
  console.log('✅ PASS: Task status transitioned to completed.');

  // =========================================================================
  // 6. Data Integrity & Persistence Checks in MongoDB
  // =========================================================================
  console.log('\n--- Test Phase 6: MongoDB Data Integrity Verification ---');
  const finalDbTask = await Task.findOne({ taskCode });
  if (!finalDbTask) {
    throw new Error(`Task ${taskCode} not found in MongoDB`);
  }

  if (finalDbTask.category !== 'it_setup') {
    throw new Error(`DATA_INTEGRITY_FAILURE: Expected Task.category == 'it_setup', got ${finalDbTask.category}`);
  }
  if (finalDbTask.status !== 'completed') {
    throw new Error(`DATA_INTEGRITY_FAILURE: Expected Task.status == 'completed', got ${finalDbTask.status}`);
  }
  if (!finalDbTask.completedAt || !finalDbTask.completedBy) {
    throw new Error(`DATA_INTEGRITY_FAILURE: completedAt or completedBy not populated`);
  }

  // Verify status history
  const historyStatuses = finalDbTask.statusHistory.map((h) => h.status);
  console.log('MongoDB statusHistory entries:', historyStatuses);
  if (!historyStatuses.includes('in_progress') || !historyStatuses.includes('completed')) {
    throw new Error(`DATA_INTEGRITY_FAILURE: statusHistory does not contain expected transitions: ${historyStatuses}`);
  }

  // Verify comment persistence
  const hasHardwareComment = finalDbTask.comments.some((c) => c.comment.includes('SN-884912'));
  if (!hasHardwareComment) {
    throw new Error(`DATA_INTEGRITY_FAILURE: Comment with serial number SN-884912 not persisted in MongoDB`);
  }
  console.log('✅ PASS: Data integrity confirmed. Category=it_setup, Status=completed, History recorded, Comment persisted.');

  console.log('\n========================================================================');
  console.log('=== ALL UJ-IT-001 BACKEND & INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
  console.log('========================================================================');

  await mongoose.disconnect();
}

runUJIT001Tests().catch((err) => {
  console.error('\n❌ UJ-IT-001 TEST RUN FAILED:', err);
  process.exit(1);
});
