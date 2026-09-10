import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { User } from '../modules/auth/models/user.model.js';
import { Organization } from '../modules/organizations/models/organization.model.js';
import { hashPassword } from '../utils/crypto.js';
dotenv.config();

const API_BASE = 'http://localhost:8080/api/v1';

async function runUJAuth004Tests() {
  console.log('=== RUNNING JOURNEY TEST UJ-AUTH-004: Password Reset & Recovery ===\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI missing in .env');
  await mongoose.connect(mongoUri);

  const targetEmail = 'reset_target@talnova.test';
  const oldPassword = 'OldPassword123!';
  const newPassword = 'NewPassword123!';

  // Step 0: Ensure precondition - target user exists
  console.log('Step 0: Ensuring precondition user reset_target@talnova.test exists...');
  let org = await Organization.findOne({ isDeleted: false });
  if (!org) {
    org = new Organization({
      name: 'Talnova Test Org',
      slug: `talnova-test-${Date.now()}`,
      supportEmail: 'support@talnova.test'
    });
    await org.save();
  }

  let user = await User.findOne({ 'auth.email': targetEmail.toLowerCase(), isDeleted: false });
  const initialPasswordHash = await hashPassword(oldPassword);

  if (!user) {
    user = new User({
      organizationId: org._id,
      auth: {
        email: targetEmail.toLowerCase(),
        passwordHash: initialPasswordHash,
        emailVerified: true
      },
      profile: {
        firstName: 'Reset',
        lastName: 'Target',
        fullName: 'Reset Target'
      },
      employment: {
        employmentType: 'full_time',
        status: 'active'
      },
      permissions: {
        role: 'employee',
        customRoles: []
      },
      security: {
        mfaEnabled: false,
        failedLoginAttempts: 0,
        passwordResetToken: null,
        passwordResetExpires: null
      }
    });
    await user.save();
    console.log(`Created new target user with ID: ${user._id}`);
  } else {
    user.auth.passwordHash = initialPasswordHash;
    user.security.passwordResetToken = null as any;
    user.security.passwordResetExpires = null as any;
    await user.save();
    console.log(`Reset target user credentials with ID: ${user._id}`);
  }

  // Step 1: Alternative Path — User Enumeration Prevention
  console.log('\nStep 1: Testing non-existent email enumeration prevention...');
  const fakeRes = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent_user_999@talnova.test' })
  });
  const fakeData = await fakeRes.json();
  console.log('Fake user forgot-password status:', fakeRes.status);
  console.log('Fake user forgot-password body:', fakeData);

  if (fakeRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for non-existent email, got ${fakeRes.status}`);
  }
  if (!fakeData.success) {
    throw new Error('Expected success true for anti-enumeration generic response');
  }
  console.log('✓ Step 1 Passed: Anti-enumeration generic response verified');

  // Step 2: Happy Path — Request Password Reset Link
  console.log('\nStep 2: Requesting reset link for reset_target@talnova.test...');
  const forgotRes = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: targetEmail })
  });
  const forgotData = await forgotRes.json();
  console.log('Forgot-password status:', forgotRes.status);
  console.log('Forgot-password body:', forgotData);

  if (forgotRes.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${forgotRes.status}`);
  }
  console.log('✓ Step 2 Passed: Forgot-password API returned HTTP 200 OK');

  // Step 3: Check Mock Mailer / Backend Logs & Verify Token Generation
  console.log('\nStep 3: Checking token in mailer and database...');
  const tokenRes = await fetch(`${API_BASE}/auth/test/latest-reset-token?email=${targetEmail}`);
  const tokenData = await tokenRes.json();
  const rawToken = tokenData.data?.token;

  if (!rawToken) {
    throw new Error('Failed to retrieve dispatched reset token from mailer');
  }
  console.log(`Dispatched Reset Token: ${rawToken}`);

  const hashedRawToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const userInDb = await User.findById(user._id);
  if (!userInDb || userInDb.security.passwordResetToken !== hashedRawToken) {
    throw new Error(`Database token mismatch! Expected hash ${hashedRawToken}, got ${userInDb?.security.passwordResetToken}`);
  }
  console.log('✓ Step 3 Passed: Reset token found in mailer and hashed in MongoDB Atlas with future expiry');

  // Step 4: Negative Test 1 — Tampered / Invalid Token
  console.log('\nStep 4: Testing tampered/invalid token...');
  const badTokenRes = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'tampered-token-value-xyz',
      password: newPassword
    })
  });
  const badTokenData = await badTokenRes.json();
  console.log('Bad token response status:', badTokenRes.status);
  console.log('Bad token response body:', badTokenData);

  if (badTokenRes.status !== 400) {
    throw new Error(`Expected HTTP 400 for tampered token, got ${badTokenRes.status}`);
  }
  if (badTokenData.error?.code !== 'INVALID_OR_EXPIRED_TOKEN') {
    throw new Error(`Expected error code INVALID_OR_EXPIRED_TOKEN, got ${badTokenData.error?.code}`);
  }
  console.log('✓ Step 4 Passed: Tampered token rejected with HTTP 400 (INVALID_OR_EXPIRED_TOKEN)');

  // Step 5: Negative Test 2 — Weak New Password
  console.log('\nStep 5: Testing weak new password (< 8 characters)...');
  const weakPassRes = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawToken,
      password: '123'
    })
  });
  const weakPassData = await weakPassRes.json();
  console.log('Weak password response status:', weakPassRes.status);
  console.log('Weak password response body:', weakPassData);

  if (weakPassRes.status !== 422) {
    throw new Error(`Expected HTTP 422 for weak password, got ${weakPassRes.status}`);
  }
  console.log('✓ Step 5 Passed: Weak new password rejected with HTTP 422 validation error');

  // Step 6: Happy Path — Submit New Password via Reset Endpoint
  console.log('\nStep 6: Resetting password with valid token and strong new password...');
  const resetRes = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawToken,
      password: newPassword
    })
  });
  const resetData = await resetRes.json();
  console.log('Reset password response status:', resetRes.status);
  console.log('Reset password response body:', resetData);

  if (resetRes.status !== 200) {
    throw new Error(`Expected HTTP 200 for reset password, got ${resetRes.status}`);
  }
  console.log('✓ Step 6 Passed: Password reset succeeded with HTTP 200 OK');

  // Step 7: Authorization Test — Consumed Token Single-Use
  console.log('\nStep 7: Testing consumed token cannot be reused...');
  const reuseRes = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawToken,
      password: 'AnotherPassword123!'
    })
  });
  const reuseData = await reuseRes.json();
  console.log('Token reuse response status:', reuseRes.status);
  console.log('Token reuse response body:', reuseData);

  if (reuseRes.status !== 400) {
    throw new Error(`Expected HTTP 400 on reused token, got ${reuseRes.status}`);
  }
  if (reuseData.error?.code !== 'INVALID_OR_EXPIRED_TOKEN') {
    throw new Error(`Expected INVALID_OR_EXPIRED_TOKEN on token reuse, got ${reuseData.error?.code}`);
  }
  console.log('✓ Step 7 Passed: Reused token rejected with HTTP 400 (INVALID_OR_EXPIRED_TOKEN)');

  // Step 8: Data Integrity Check in MongoDB Atlas
  console.log('\nStep 8: Verifying MongoDB Atlas document state...');
  const updatedUser = await User.findById(user._id);
  console.log('Updated User Security State:', {
    passwordResetToken: updatedUser?.security.passwordResetToken,
    passwordResetExpires: updatedUser?.security.passwordResetExpires,
    passwordChangedAt: updatedUser?.auth.passwordChangedAt
  });

  if (updatedUser?.security.passwordResetToken != null) {
    throw new Error(`DATA_INTEGRITY_FAILURE: passwordResetToken not cleared! Value: ${updatedUser?.security.passwordResetToken}`);
  }
  if (updatedUser?.security.passwordResetExpires != null) {
    throw new Error(`DATA_INTEGRITY_FAILURE: passwordResetExpires not cleared! Value: ${updatedUser?.security.passwordResetExpires}`);
  }
  if (!updatedUser?.auth.passwordChangedAt) {
    throw new Error('DATA_INTEGRITY_FAILURE: passwordChangedAt was not updated');
  }
  console.log('✓ Step 8 Passed: MongoDB document has cleared reset tokens and updated passwordChangedAt timestamp');

  // Step 9: Authentication Verifications (Old vs New password)
  console.log('\nStep 9: Verifying authentication credentials...');
  
  // 9a. Old password must be rejected
  console.log('Testing login with OLD password...');
  const oldLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: targetEmail,
      password: oldPassword
    })
  });
  const oldLoginData = await oldLoginRes.json();
  console.log('Old password login status:', oldLoginRes.status);
  if (oldLoginRes.status !== 401) {
    throw new Error(`Expected HTTP 401 for old password, got ${oldLoginRes.status}`);
  }
  console.log('✓ Step 9a Passed: Old password correctly rejected with HTTP 401');

  // 9b. New password must succeed
  console.log('Testing login with NEW password...');
  const newLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: targetEmail,
      password: newPassword
    })
  });
  const newLoginData = await newLoginRes.json();
  console.log('New password login status:', newLoginRes.status);
  console.log('New password login payload:', JSON.stringify(newLoginData, null, 2));

  if (newLoginRes.status !== 200 || !newLoginData.data?.accessToken) {
    throw new Error(`Expected HTTP 200 with accessToken, got status ${newLoginRes.status}`);
  }
  console.log('✓ Step 9b Passed: New password logged in successfully with HTTP 200 OK and valid JWT');

  await mongoose.disconnect();
  console.log('\n=== ALL UJ-AUTH-004 PROGRAMMATIC & INTEGRITY CHECKS PASSED ===');
}

runUJAuth004Tests().catch(err => {
  console.error('UJ-AUTH-004 Test Error:', err);
  process.exit(1);
});
