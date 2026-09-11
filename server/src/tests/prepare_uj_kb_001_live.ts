import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Article } from '../modules/knowledge-base/models/article.model.js';
import User from '../modules/auth/models/user.model.js';
import Organization from '../modules/organizations/models/organization.model.js';

dotenv.config();

async function prepare() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB:', mongoUri);

  // Find users & organizations
  const orgs = await Organization.find({ isDeleted: false });
  console.log('Found organizations:', orgs.map(o => ({ id: o._id, name: o.name, slug: o.slug })));

  const users = await User.find({ 'employment.status': 'active' }).limit(5);
  console.log('Found active users:', users.map(u => ({ id: u._id, email: u.auth.email, role: u.permissions.role, orgId: u.organizationId })));

  // Target org is the first active org or default org
  const targetOrg = orgs[0];
  if (!targetOrg) {
    console.error('No active organization found!');
    await mongoose.disconnect();
    return;
  }

  // Find admin or employee user for that org
  let adminUser = users.find(u => u.organizationId.toString() === targetOrg._id.toString() && (u.permissions.role === 'admin' || u.permissions.role === 'owner'));
  if (!adminUser) {
    adminUser = users[0];
  }

  const articleTitle = "Employee Handbook & Remote Work Policy";

  // Check if article already exists
  let article = await Article.findOne({
    organizationId: targetOrg._id,
    title: articleTitle,
    isDeleted: false,
  });

  if (!article) {
    article = await Article.create({
      organizationId: targetOrg._id,
      title: articleTitle,
      slug: "employee-handbook-remote-work-policy",
      summary: "Comprehensive guidelines, equipment stipends, communication norms, and security protocols for remote work.",
      content: {
        blocks: [
          {
            type: "callout",
            content: "Welcome to our remote-first workplace! Please read through our flexible working policies and data security expectations.",
            order: 0,
          },
          {
            type: "text",
            content: "Core Working Hours: All team members are expected to be available on Slack and email during our core collaboration window (10:00 AM – 3:00 PM in your local timezone).\n\nHome Office Stipend: Each employee receives a $1,000 one-time home office setup reimbursement for ergonomic furniture and external monitors.",
            order: 1,
          },
          {
            type: "text",
            content: "Data Protection & VPN: When handling customer data or accessing production infrastructure from public networks, you must connect through our corporate VPN with multi-factor authentication (MFA).",
            order: 2,
          }
        ],
      },
      tags: ["handbook", "remote-work", "policy", "security"],
      visibility: {
        access: "all",
      },
      publishing: {
        status: "published",
        publishedAt: new Date(),
        version: 1,
      },
      searchKeywords: ["remote", "work", "handbook", "policy", "stipend", "vpn"],
      createdBy: adminUser._id,
      isDeleted: false,
    });
    console.log('Created test article:', article._id, article.title);
  } else {
    // Ensure it is published
    article.publishing.status = "published";
    article.publishing.publishedAt = new Date();
    await article.save();
    console.log('Updated existing test article to published:', article._id, article.title);
  }

  // Also ensure other orgs have articles or check tenant isolation
  const allArticles = await Article.find({ isDeleted: false });
  console.log(`Total active KB articles in DB: ${allArticles.length}`);

  await mongoose.disconnect();
}

prepare().catch(console.error);
