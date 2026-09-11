import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Organization from '../modules/organizations/models/organization.model.js';
import User from '../modules/auth/models/user.model.js';
import Invoice from '../modules/super-admin/models/invoice.model.js';
import { hashPassword } from '../utils/crypto.js';

dotenv.config();

async function prepareLive() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);

  const superAdminEmail = 'superadmin@talnova.test';
  const password = 'Password123!';
  const passwordHash = await hashPassword(password);

  console.log('--- Ensuring Base Organization & SuperAdmin ---');
  let baseOrg = await Organization.findOne({ slug: 'talnova-hq', isDeleted: false });
  if (!baseOrg) {
    baseOrg = new Organization({
      name: 'Talnova HQ',
      slug: 'talnova-hq',
      domain: 'talnova.test',
      plan: 'Enterprise',
      status: 'Active',
      subscription: { plan: 'Enterprise', status: 'active', seatLimit: 500, billingCycle: 'annual' },
      limits: { maxUsers: 500, maxStorageGb: 50 },
      supportEmail: 'support@talnova.test',
      createdBy: new mongoose.Types.ObjectId()
    });
    await baseOrg.save();
    console.log('Created Talnova HQ org');
  }

  let superAdmin = await User.findOne({ 'auth.email': superAdminEmail });
  if (!superAdmin) {
    superAdmin = new User({
      organizationId: baseOrg._id,
      auth: { email: superAdminEmail, passwordHash, emailVerified: true },
      profile: { firstName: 'Super', lastName: 'Admin', fullName: 'Super Admin' },
      employment: { status: 'active', employmentType: 'full_time' },
      permissions: { role: 'super_admin', customRoles: [] }
    });
    await superAdmin.save();
    console.log('Created SuperAdmin user');
  } else {
    superAdmin.auth.passwordHash = passwordHash;
    superAdmin.permissions.role = 'super_admin';
    await superAdmin.save();
    console.log('Updated SuperAdmin user password & role');
  }

  console.log('\n--- Ensuring Active Tenant Records with Varying Plans ---');
  // Tenant 1: Starter
  let starterOrg = await Organization.findOne({ slug: 'starter-logistics-test' });
  if (!starterOrg) {
    starterOrg = await Organization.create({
      name: 'Starter Logistics Inc',
      slug: 'starter-logistics-test',
      domain: 'starter-logistics.test',
      plan: 'Starter',
      status: 'Active',
      subscription: { plan: 'Starter', status: 'active', seatLimit: 25, billingCycle: 'monthly' },
      limits: { maxUsers: 25, maxStorageGb: 10 },
      createdBy: baseOrg.createdBy,
      isDeleted: false
    });
    console.log('Created Starter tenant');
  } else {
    starterOrg.status = 'Active';
    starterOrg.plan = 'Starter';
    await starterOrg.save();
  }

  // Tenant 2: Pro / Professional
  let proOrg = await Organization.findOne({ slug: 'pro-tech-test' });
  if (!proOrg) {
    proOrg = await Organization.create({
      name: 'Pro Tech Systems',
      slug: 'pro-tech-test',
      domain: 'protech.test',
      plan: 'Professional',
      status: 'Active',
      subscription: { plan: 'Professional', status: 'active', seatLimit: 100, billingCycle: 'monthly' },
      limits: { maxUsers: 100, maxStorageGb: 25 },
      createdBy: baseOrg.createdBy,
      isDeleted: false
    });
    console.log('Created Pro tenant');
  } else {
    proOrg.status = 'Active';
    proOrg.plan = 'Professional';
    await proOrg.save();
  }

  // Tenant 3: Enterprise
  let entOrg = await Organization.findOne({ slug: 'apex-enterprise-test' });
  if (!entOrg) {
    entOrg = await Organization.create({
      name: 'Apex Enterprise Global',
      slug: 'apex-enterprise-test',
      domain: 'apexglobal.test',
      plan: 'Enterprise',
      status: 'Active',
      subscription: { plan: 'Enterprise', status: 'active', seatLimit: 1000, billingCycle: 'annual' },
      limits: { maxUsers: 1000, maxStorageGb: 100 },
      createdBy: baseOrg.createdBy,
      isDeleted: false
    });
    console.log('Created Enterprise tenant');
  } else {
    entOrg.status = 'Active';
    entOrg.plan = 'Enterprise';
    await entOrg.save();
  }

  console.log('\n--- Ensuring Test Invoices Exist ---');
  const countInvoices = await Invoice.countDocuments();
  if (countInvoices < 3) {
    await Invoice.create([
      {
        invoiceNo: 'INV-8891',
        organization: 'Apex Enterprise Global',
        amount: 11988,
        type: 'Invoice',
        status: 'Paid',
        dueDate: '2026-08-30',
        description: 'Annual Enterprise Plan Renewal'
      },
      {
        invoiceNo: 'INV-8892',
        organization: 'Pro Tech Systems',
        amount: 299,
        type: 'Invoice',
        status: 'Pending',
        dueDate: '2026-09-30',
        description: 'Pro Monthly Tier Subscription'
      },
      {
        invoiceNo: 'INV-8893',
        organization: 'Starter Logistics Inc',
        amount: 99,
        type: 'Invoice',
        status: 'Overdue',
        dueDate: '2026-09-01',
        description: 'Starter Plan - Late Balance'
      }
    ]);
    console.log('Seeded 3 sample invoices');
  }

  // Live HTTP Test against local backend
  console.log('\n--- Testing Live API Endpoint (POST /api/v1/auth/login) ---');
  const loginRes = await fetch('http://localhost:8080/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: superAdminEmail, password })
  });
  const loginData = await loginRes.json();
  const token = loginData.data?.accessToken || loginData.data?.tokens?.accessToken || loginData.accessToken || loginData.data?.token || loginData.token;
  console.log('Login status:', loginRes.status);
  console.log('Token received:', token ? token.substring(0, 25) + '...' : 'NONE');

  console.log('\n--- Testing Live API Endpoint (GET /api/v1/super-admin/finance) ---');
  const finRes = await fetch('http://localhost:8080/api/v1/super-admin/finance', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const finData = await finRes.json();
  console.log('Finance status:', finRes.status);
  console.log('Finance Summary:', JSON.stringify(finData.data?.summary, null, 2));
  console.log('Tier Distribution:', JSON.stringify(finData.data?.tierDistribution, null, 2));

  await mongoose.disconnect();
}

prepareLive().catch(console.error);
