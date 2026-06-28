const mongoose = require('mongoose');
const argon2 = require('argon2');
const uri = "mongodb+srv://talnovainfo_db_user:sE6tqPUsf58Rcags@talnova.6ay8jvc.mongodb.net/Talnova-Onboarding?retryWrites=true&w=majority";

async function run() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB!");

  // Clear existing users and organizations to prevent duplicates
  await mongoose.connection.db.collection('users').deleteMany({});
  await mongoose.connection.db.collection('organizations').deleteMany({});
  console.log("Cleared old users and organizations.");

  const orgId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const employeeId = new mongoose.Types.ObjectId();

  // Create Organization
  const organization = {
    _id: orgId,
    name: "Northwind Labs",
    slug: "northwind",
    supportEmail: "support@northwind.com",
    branding: {
      primaryColor: "#4F46E5",
      secondaryColor: "#10B981",
      accentColor: "#F59E0B"
    },
    workspace: {
      timezone: "UTC",
      locale: "en-US",
      dateFormat: "YYYY-MM-DD",
      firstDayOfWeek: 0
    },
    departments: [
      { _id: new mongoose.Types.ObjectId(), name: "Engineering", active: true },
      { _id: new mongoose.Types.ObjectId(), name: "Product", active: true },
      { _id: new mongoose.Types.ObjectId(), name: "Design", active: true }
    ],
    teams: [],
    jobTitles: [],
    locations: [],
    notificationSettings: {
      assignmentEmail: true,
      reminderEmail: true,
      weeklyDigest: true
    },
    securitySettings: {
      allowPasswordLogin: true,
      enforceMfa: false,
      sessionTimeout: 3600
    },
    analytics: {
      totalEmployees: 2,
      activeEmployees: 2,
      journeys: 0,
      completionRate: 0
    },
    createdBy: adminId,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await mongoose.connection.db.collection('organizations').insertOne(organization);
  console.log("Organization inserted!");

  // Hash passwords
  const adminHash = await argon2.hash("AdminPass123!", { type: argon2.argon2id });
  const employeeHash = await argon2.hash("EmployeePass123!", { type: argon2.argon2id });

  // Create Users
  const adminUser = {
    _id: adminId,
    organizationId: orgId,
    auth: {
      email: "admin@talnova.com",
      passwordHash: adminHash,
      emailVerified: true
    },
    profile: {
      firstName: "Admin",
      lastName: "User",
      fullName: "Admin User"
    },
    employment: {
      employmentType: "full_time",
      status: "active"
    },
    permissions: {
      role: "owner",
      customRoles: []
    },
    preferences: {
      language: "en",
      theme: "dark",
      emailNotifications: true
    },
    statistics: {
      assignedJourneys: 0,
      completedJourneys: 0,
      certificates: 0,
      completionRate: 0
    },
    security: {
      mfaEnabled: false,
      failedLoginAttempts: 0
    },
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const employeeUser = {
    _id: employeeId,
    organizationId: orgId,
    auth: {
      email: "employee@talnova.com",
      passwordHash: employeeHash,
      emailVerified: true
    },
    profile: {
      firstName: "Employee",
      lastName: "User",
      fullName: "Employee User"
    },
    employment: {
      employmentType: "full_time",
      status: "active"
    },
    permissions: {
      role: "employee",
      customRoles: []
    },
    preferences: {
      language: "en",
      theme: "dark",
      emailNotifications: true
    },
    statistics: {
      assignedJourneys: 0,
      completedJourneys: 0,
      certificates: 0,
      completionRate: 0
    },
    security: {
      mfaEnabled: false,
      failedLoginAttempts: 0
    },
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await mongoose.connection.db.collection('users').insertMany([adminUser, employeeUser]);
  console.log("Users inserted!");

  await mongoose.disconnect();
  console.log("Done!");
}

run().catch(console.error);
