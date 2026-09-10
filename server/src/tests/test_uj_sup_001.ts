import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../modules/organizations/models/organization.model.js';
import User from '../modules/auth/models/user.model.js';
import AuditLog from '../modules/audit-logs/models/audit-log.model.js';
import { hashPassword } from '../utils/crypto.js';

dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJSUP001Tests() {
  console.log('========================================================================');
  console.log('=== RUNNING JOURNEY TEST UJ-SUP-001: Tenant Provisioning & Health Oversight ===');
  console.log('========================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const superAdminEmail = 'superadmin@talnova.test';
  const ownerEmail = 'regular_owner@talnova.test';
  const hrAdminEmail = 'hr_admin@talnova.test';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  console.log('Step 0: Initializing test environment and users...');

  // Base org for regular users
  let baseOrg = await Organization.findOne({ slug: 'talnova-hq', isDeleted: false });
  if (!baseOrg) {
    baseOrg = new Organization({
      name: 'Talnova HQ',
      slug: 'talnova-hq',
      domain: 'talnova.test',
      plan: 'Enterprise',
      status: 'Active',
      supportEmail: 'support@talnova.test',
      createdBy: new mongoose.Types.ObjectId()
    });
    await baseOrg.save();
  }

  // Super Admin
  let superAdmin = await User.findOne({ 'auth.email': superAdminEmail, isDeleted: false });
  if (!superAdmin) {
    superAdmin = new User({
      organizationId: baseOrg._id,
      auth: { email: superAdminEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Super', lastName: 'Admin', fullName: 'Super Admin' },
      employment: { status: 'active', employmentType: 'full_time' },
      permissions: { role: 'super_admin', customRoles: [] }
    });
    await superAdmin.save();
  }

  // Regular Owner
  let regularOwner = await User.findOne({ 'auth.email': ownerEmail, isDeleted: false });
  if (!regularOwner) {
    regularOwner = new User({
      organizationId: baseOrg._id,
      auth: { email: ownerEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Regular', lastName: 'Owner', fullName: 'Regular Owner' },
      employment: { status: 'active', employmentType: 'full_time' },
      permissions: { role: 'owner', customRoles: [] }
    });
    await regularOwner.save();
  }

  // HR Admin
  let hrAdmin = await User.findOne({ 'auth.email': hrAdminEmail, isDeleted: false });
  if (!hrAdmin) {
    hrAdmin = new User({
      organizationId: baseOrg._id,
      auth: { email: hrAdminEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'HR', lastName: 'Admin', fullName: 'HR Admin' },
      employment: { status: 'active', employmentType: 'full_time' },
      permissions: { role: 'admin', customRoles: [] }
    });
    await hrAdmin.save();
  }

  // Clean up any previous test tenant records
  const targetDomain = 'globallogistics.test';
  const targetEmail = 'admin@globallogistics.test';
  const targetOrgName = 'Global Logistics Corp';

  const existingTargetOrgs = await Organization.find({
    $or: [{ domain: targetDomain }, { name: targetOrgName }]
  });
  for (const org of existingTargetOrgs) {
    await User.deleteMany({ organizationId: org._id });
    await AuditLog.deleteMany({ organizationId: org._id });
    await Organization.deleteOne({ _id: org._id });
  }
  await User.deleteMany({ 'auth.email': targetEmail });

  // Helper login function
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

  console.log('Authenticating test users...');
  const superAdminToken = await login(superAdminEmail);
  const ownerToken = await login(ownerEmail);
  const hrAdminToken = await login(hrAdminEmail);
  console.log('✅ All test users authenticated successfully.');

  // =========================================================================
  // 1. Authorization Tests
  // =========================================================================
  console.log('\n--- Test Phase 1: Authorization Controls (Non-SuperAdmin Rejection) ---');
  
  // Organization Owner attempt
  const ownerAttempt = await fetch(`${API_BASE}/super-admin/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`
    },
    body: JSON.stringify({
      name: 'Unauthorized Org By Owner',
      domain: 'unauth-owner.test',
      adminEmail: 'owner@unauth-owner.test'
    })
  });
  console.log(`[Auth Check - Org Owner] Status: ${ownerAttempt.status}`);
  if (ownerAttempt.status === 403) {
    console.log('✅ PASS: Organization Owner rejected with HTTP 403 Forbidden.');
  } else {
    throw new Error(`AUTHORIZATION_FAILURE: Expected 403 Forbidden, got ${ownerAttempt.status}`);
  }

  // HR Admin attempt
  const hrAttempt = await fetch(`${API_BASE}/super-admin/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hrAdminToken}`
    },
    body: JSON.stringify({
      name: 'Unauthorized Org By HR Admin',
      domain: 'unauth-hr.test',
      adminEmail: 'admin@unauth-hr.test'
    })
  });
  console.log(`[Auth Check - HR Admin] Status: ${hrAttempt.status}`);
  if (hrAttempt.status === 403) {
    console.log('✅ PASS: HR Admin rejected with HTTP 403 Forbidden.');
  } else {
    throw new Error(`AUTHORIZATION_FAILURE: Expected 403 Forbidden, got ${hrAttempt.status}`);
  }

  // =========================================================================
  // 2. SuperAdmin Stats & Health Endpoint
  // =========================================================================
  console.log('\n--- Test Phase 2: SuperAdmin Stats & System Health Oversight ---');
  const statsRes = await fetch(`${API_BASE}/super-admin/stats`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const statsBody = await statsRes.json();
  console.log(`[Stats Endpoint] Status: ${statsRes.status}`, statsBody.data);

  if (statsRes.status !== 200 || !statsBody.success) {
    throw new Error(`Stats endpoint failed with status ${statsRes.status}`);
  }
  if (typeof statsBody.data.totalTenants !== 'number' ||
      typeof statsBody.data.systemHealth !== 'number' ||
      typeof statsBody.data.mrr !== 'number') {
    throw new Error(`Stats payload missing required metrics fields: ${JSON.stringify(statsBody.data)}`);
  }
  console.log(`✅ PASS: Global metrics verified. Total Tenants: ${statsBody.data.totalTenants}, Health: ${statsBody.data.systemHealth}%, MRR: $${statsBody.data.mrr}`);

  // =========================================================================
  // 3. Happy Path: Provision New Tenant
  // =========================================================================
  console.log('\n--- Test Phase 3: Provision New Tenant (Global Logistics Corp) ---');
  const provisionPayload = {
    name: targetOrgName,
    domain: targetDomain,
    adminEmail: targetEmail,
    plan: 'Enterprise'
  };

  const provisionRes = await fetch(`${API_BASE}/super-admin/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify(provisionPayload)
  });
  const provisionData = await provisionRes.json();
  console.log(`[Provision Network Log] Status: ${provisionRes.status}`, provisionData);

  if (provisionRes.status !== 201 || !provisionData.success) {
    throw new Error(`Provisioning failed with status ${provisionRes.status}: ${JSON.stringify(provisionData)}`);
  }

  const newOrgId = provisionData.data.id;
  const newOwnerId = provisionData.data.owner?.id;

  if (!newOrgId || !newOwnerId) {
    throw new Error(`DATA_INTEGRITY_FAILURE: Response missing newOrgId or newOwnerId`);
  }
  console.log(`✅ PASS: Tenant provisioned. Org ID: ${newOrgId}, Owner ID: ${newOwnerId}`);

  // =========================================================================
  // 4. Data Integrity Checks in MongoDB
  // =========================================================================
  console.log('\n--- Test Phase 4: MongoDB Data Integrity Verification ---');
  const createdOrg = await Organization.findById(newOrgId);
  if (!createdOrg) {
    throw new Error(`DATA_INTEGRITY_FAILURE: Organization record not found in MongoDB for ID ${newOrgId}`);
  }
  if (createdOrg.name !== targetOrgName) {
    throw new Error(`Org name mismatch: expected ${targetOrgName}, got ${createdOrg.name}`);
  }
  if (createdOrg.domain !== targetDomain) {
    throw new Error(`Org domain mismatch: expected ${targetDomain}, got ${createdOrg.domain}`);
  }
  if (createdOrg.status !== 'Active') {
    throw new Error(`Org status mismatch: expected Active, got ${createdOrg.status}`);
  }
  if (createdOrg.plan !== 'Enterprise') {
    throw new Error(`Org plan mismatch: expected Enterprise, got ${createdOrg.plan}`);
  }
  console.log('✅ MongoDB Organization record verified:', {
    id: createdOrg._id.toString(),
    name: createdOrg.name,
    domain: createdOrg.domain,
    plan: createdOrg.plan,
    status: createdOrg.status
  });

  const createdOwner = await User.findById(newOwnerId);
  if (!createdOwner) {
    throw new Error(`DATA_INTEGRITY_FAILURE: Initial Owner user record not found in MongoDB for ID ${newOwnerId}`);
  }
  if (createdOwner.auth.email !== targetEmail) {
    throw new Error(`Owner email mismatch: expected ${targetEmail}, got ${createdOwner.auth.email}`);
  }
  if (createdOwner.organizationId.toString() !== createdOrg._id.toString()) {
    throw new Error(`DATA_INTEGRITY_FAILURE: Owner organizationId (${createdOwner.organizationId}) does not match Org ID (${createdOrg._id})`);
  }
  if (createdOwner.permissions.role !== 'owner') {
    throw new Error(`DATA_INTEGRITY_FAILURE: User role mismatch: expected owner, got ${createdOwner.permissions.role}`);
  }
  console.log('✅ MongoDB Initial Owner User record verified:', {
    id: createdOwner._id.toString(),
    email: createdOwner.auth.email,
    organizationId: createdOwner.organizationId.toString(),
    role: createdOwner.permissions.role
  });

  // Integration Check: Security Audit Log
  const auditLog = await AuditLog.findOne({
    organizationId: createdOrg._id,
    eventType: 'TENANT_PROVISIONED'
  });
  if (!auditLog) {
    throw new Error(`INTEGRATION_FAILURE: Security audit log for TENANT_PROVISIONED not found for org ${createdOrg._id}`);
  }
  console.log('✅ Security Audit Log verified:', {
    eventType: auditLog.eventType,
    description: auditLog.description,
    organizationId: auditLog.organizationId.toString()
  });

  // =========================================================================
  // 5. Negative Test: Duplicate Domain Rejection
  // =========================================================================
  console.log('\n--- Test Phase 5: Negative Test - Duplicate Domain Conflict ---');
  const duplicateRes = await fetch(`${API_BASE}/super-admin/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({
      name: 'Duplicate Logistics Ltd',
      domain: targetDomain,
      adminEmail: 'duplicate@globallogistics.test',
      plan: 'Growth'
    })
  });
  const duplicateData = await duplicateRes.json();
  console.log(`[Duplicate Domain Network Log] Status: ${duplicateRes.status}`, duplicateData);

  if (duplicateRes.status === 409 && (duplicateData.code === 'DOMAIN_ALREADY_EXISTS' || duplicateData.message?.includes('registered') || duplicateData.message?.includes('already in use'))) {
    console.log(`✅ PASS: Duplicate domain rejected with HTTP 409 Conflict (code: ${duplicateData.code || 'DOMAIN_ALREADY_EXISTS'}).`);
  } else {
    throw new Error(`Expected HTTP 409 Conflict with DOMAIN_ALREADY_EXISTS, got ${duplicateRes.status}: ${JSON.stringify(duplicateData)}`);
  }

  // =========================================================================
  // 6. Organizations Roster Retrieval
  // =========================================================================
  console.log('\n--- Test Phase 6: Organizations Roster Verification ---');
  const rosterRes = await fetch(`${API_BASE}/super-admin/organizations?search=Global+Logistics`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const rosterData = await rosterRes.json();
  console.log(`[Roster Network Log] Status: ${rosterRes.status}`, rosterData.data?.data);

  if (rosterRes.status !== 200 || !rosterData.data?.data) {
    throw new Error(`Failed to retrieve roster: ${JSON.stringify(rosterData)}`);
  }
  const matchingOrg = rosterData.data.data.find((o: any) => o.id === newOrgId.toString());
  if (!matchingOrg) {
    throw new Error(`Provisioned tenant not found in roster response`);
  }
  if (matchingOrg.status !== 'Active') {
    throw new Error(`Roster tenant status mismatch: expected Active, got ${matchingOrg.status}`);
  }
  console.log(`✅ PASS: Tenant appears in organizations roster with Active status and domain: ${matchingOrg.domain}`);

  // =========================================================================
  // 7. Alternative Path: SuperAdmin Suspends Tenant
  // =========================================================================
  console.log('\n--- Test Phase 7: Alternative Path - Suspend Tenant ---');
  const suspendRes = await fetch(`${API_BASE}/super-admin/organizations/${newOrgId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ status: 'Suspended' })
  });
  const suspendData = await suspendRes.json();
  console.log(`[Suspend Network Log] Status: ${suspendRes.status}`, suspendData);

  if (suspendRes.status !== 200 || suspendData.data?.status !== 'Suspended') {
    throw new Error(`Failed to suspend organization: ${JSON.stringify(suspendData)}`);
  }

  const suspendedOrgInDb = await Organization.findById(newOrgId);
  if (suspendedOrgInDb?.status !== 'Suspended') {
    throw new Error(`MongoDB Organization status was not updated to Suspended: ${suspendedOrgInDb?.status}`);
  }
  console.log(`✅ PASS: Tenant successfully suspended in MongoDB.`);

  // Reactivate back to Active for final clean state
  const reactivateRes = await fetch(`${API_BASE}/super-admin/organizations/${newOrgId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    },
    body: JSON.stringify({ status: 'Active' })
  });
  const reactivateData = await reactivateRes.json();
  if (reactivateRes.status === 200 && reactivateData.data?.status === 'Active') {
    console.log(`✅ PASS: Tenant reactivated back to Active state.`);
  }

  console.log('\n========================================================================');
  console.log('=== ALL UJ-SUP-001 BACKEND & INTEGRATION TESTS COMPLETED SUCCESSFULLY! ===');
  console.log('========================================================================');

  await mongoose.disconnect();
}

runUJSUP001Tests().catch((err) => {
  console.error('\n❌ UJ-SUP-001 TEST RUN FAILED:', err);
  process.exit(1);
});
