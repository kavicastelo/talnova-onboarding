import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from '../modules/tasks/models/task.model.js';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJONB003Tests() {
  console.log('=== RUNNING JOURNEY TEST UJ-ONB-003: Execute Personal Checklist Tasks ===\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing in .env');
  await mongoose.connect(mongoUri);

  const employeeEmail = 'employee@talnova.test';
  const adminEmail = 'admin@talnova.test';
  const password = 'Password123!';

  // Step 0: Ensure Preconditions
  console.log('Step 0: Ensuring organization, employee, and IT admin exist...');
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
      profile: { firstName: 'Employee', lastName: 'User', fullName: 'Employee User' },
      employment: { employmentType: 'full_time', status: 'active' },
      permissions: { role: 'employee', customRoles: [] }
    });
    await employee.save();
  } else {
    employee.auth.passwordHash = passwordHash;
    await employee.save();
  }

  let admin = await User.findOne({ 'auth.email': adminEmail.toLowerCase(), isDeleted: false });
  if (!admin) {
    admin = new User({
      organizationId: org._id,
      auth: { email: adminEmail.toLowerCase(), passwordHash, emailVerified: true },
      profile: { firstName: 'Admin', lastName: 'User', fullName: 'Admin User' },
      employment: { employmentType: 'full_time', status: 'active' },
      permissions: { role: 'admin', customRoles: [] }
    });
    await admin.save();
  } else {
    admin.auth.passwordHash = passwordHash;
    await admin.save();
  }

  // Create or reset Personal Task for Employee
  await Task.deleteMany({
    organizationId: org._id,
    title: 'Upload Photo for Security Badge'
  });

  const personalTask = new Task({
    organizationId: org._id,
    createdBy: admin._id,
    assignedToUserId: employee._id,
    employeeId: employee._id,
    title: 'Upload Photo for Security Badge',
    description: 'Submit a high-resolution headshot photograph for your physical facility keycard and badge issuance.',
    category: 'general',
    stage: 'day_1',
    priority: 'high',
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        changedBy: admin._id,
        changedAt: new Date(),
        note: 'Task seeded for onboarding checklist'
      }
    ]
  });
  await personalTask.save();
  console.log(`Created personal task: "${personalTask.title}" (ID: ${personalTask._id}) for employee ${employee._id}`);

  // Create Administrator / IT Task (assigned to admin)
  await Task.deleteMany({
    organizationId: org._id,
    title: 'Provision Corporate Laptop & Hardware Token'
  });

  const itTask = new Task({
    organizationId: org._id,
    createdBy: admin._id,
    assignedToUserId: admin._id,
    employeeId: employee._id,
    title: 'Provision Corporate Laptop & Hardware Token',
    description: 'Configure corporate security certificates and ship developer laptop.',
    category: 'it_setup',
    stage: 'preboarding',
    priority: 'critical',
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        changedBy: admin._id,
        changedAt: new Date(),
        note: 'IT provisioning task'
      }
    ]
  });
  await itTask.save();
  console.log(`Created IT task: "${itTask.title}" (ID: ${itTask._id}) assigned to admin ${admin._id}`);

  // Step 1: Authenticate as Employee
  console.log('\nStep 1: Authenticating as employee...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: employeeEmail, password })
  });
  const loginData = await loginRes.json();
  if (loginRes.status !== 200 || !loginData.data?.accessToken) {
    throw new Error(`Login failed for employee: ${JSON.stringify(loginData)}`);
  }
  const employeeToken = loginData.data.accessToken;
  console.log('✓ Step 1 Passed: Authenticated employee token obtained');

  // Step 2: Negative Test 1 — Attempt to mutate Administrator / IT Task
  console.log('\nStep 2: Negative Test — Attempting to mutate IT Admin task with employee token...');
  const unauthorizedRes = await fetch(`${API_BASE}/tasks/${itTask._id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employeeToken}`
    },
    body: JSON.stringify({ status: 'completed' })
  });
  const unauthorizedData = await unauthorizedRes.json();
  console.log('Unauthorized task mutation status:', unauthorizedRes.status);
  console.log('Unauthorized task mutation response:', unauthorizedData);

  if (unauthorizedRes.status !== 403) {
    throw new Error(`Expected HTTP 403 Forbidden, got ${unauthorizedRes.status}`);
  }
  if (unauthorizedData.error?.code !== 'FORBIDDEN_TASK_MUTATION') {
    throw new Error(`Expected error code FORBIDDEN_TASK_MUTATION, got ${unauthorizedData.error?.code}`);
  }
  console.log('✓ Step 2 Passed: Unauthorized mutation blocked with HTTP 403 Forbidden (FORBIDDEN_TASK_MUTATION)');

  // Step 3: Happy Path — Complete Personal Task
  console.log('\nStep 3: Happy Path — Completing personal task...');
  const completeRes = await fetch(`${API_BASE}/tasks/${personalTask._id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employeeToken}`
    },
    body: JSON.stringify({ status: 'completed', note: 'Badge photo uploaded via web' })
  });
  const completeData = await completeRes.json();
  console.log('Task complete status:', completeRes.status);
  console.log('Task complete body:', completeData);

  if (completeRes.status !== 200) {
    throw new Error(`Expected HTTP 200 OK, got ${completeRes.status}`);
  }
  if (completeData.data?.status !== 'completed') {
    throw new Error(`Expected status 'completed', got '${completeData.data?.status}'`);
  }
  console.log('✓ Step 3 Passed: Personal task marked completed with HTTP 200 OK');

  // Step 4: Alternative Path — Revert / Uncheck Task
  console.log('\nStep 4: Alternative Path — Unchecking task back to pending...');
  const revertRes = await fetch(`${API_BASE}/tasks/${personalTask._id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employeeToken}`
    },
    body: JSON.stringify({ status: 'pending', note: 'Reverted for re-upload' })
  });
  const revertData = await revertRes.json();
  console.log('Task revert status:', revertRes.status);

  if (revertRes.status !== 200 || revertData.data?.status !== 'pending') {
    throw new Error(`Expected status 'pending', got '${revertData.data?.status}'`);
  }
  console.log('✓ Step 4 Passed: Task status successfully reverted to pending');

  // Re-complete task for final persistent state
  console.log('Re-completing personal task for final verification...');
  const reCompleteRes = await fetch(`${API_BASE}/tasks/${personalTask._id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${employeeToken}`
    },
    body: JSON.stringify({ status: 'completed' })
  });
  if (reCompleteRes.status !== 200) {
    throw new Error('Failed to re-complete personal task');
  }

  // Step 5: Data Integrity Checks in MongoDB Atlas
  console.log('\nStep 5: Verifying MongoDB Atlas document state and statusHistory...');
  const dbTask = await Task.findById(personalTask._id);
  if (!dbTask) throw new Error('Task not found in MongoDB');

  console.log('MongoDB Task State:', {
    _id: dbTask._id.toString(),
    title: dbTask.title,
    status: dbTask.status,
    completedBy: dbTask.completedBy?.toString(),
    statusHistoryCount: dbTask.statusHistory.length,
    latestHistory: dbTask.statusHistory[dbTask.statusHistory.length - 1]
  });

  if (dbTask.status !== 'completed') {
    throw new Error(`DATA_INTEGRITY_FAILURE: Expected status 'completed', got '${dbTask.status}'`);
  }
  if (dbTask.completedBy?.toString() !== employee._id.toString()) {
    throw new Error(`DATA_INTEGRITY_FAILURE: Expected completedBy ${employee._id}, got ${dbTask.completedBy}`);
  }

  const latestHistory = dbTask.statusHistory[dbTask.statusHistory.length - 1];
  if (latestHistory.status !== 'completed' || latestHistory.changedBy?.toString() !== employee._id.toString()) {
    throw new Error(`DATA_INTEGRITY_FAILURE: statusHistory latest entry invalid: ${JSON.stringify(latestHistory)}`);
  }
  console.log('✓ Step 5 Passed: MongoDB document verified with status: "completed" and statusHistory audit trail');

  await mongoose.disconnect();
  console.log('\n=== ALL UJ-ONB-003 PROGRAMMATIC & INTEGRITY CHECKS PASSED ===');
}

runUJONB003Tests().catch((err) => {
  console.error('UJ-ONB-003 Test Error:', err);
  process.exit(1);
});
