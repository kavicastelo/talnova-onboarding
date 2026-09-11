import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Article } from '../modules/knowledge-base/models/article.model.js';
import User from '../modules/auth/models/user.model.js';
import Organization from '../modules/organizations/models/organization.model.js';

dotenv.config();

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/talnova-onboarding';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const users = await User.find({ isDeleted: { $ne: true } });
  console.log('Users found:', users.map(u => ({ email: u.auth?.email, org: u.organizationId, name: u.profile?.fullName })));

  const orgs = await Organization.find({ isDeleted: false });
  console.log('Organizations found:', orgs.map(o => ({ id: o._id, name: o.name })));

  for (const org of orgs) {
    const adminUser = users.find(u => u.organizationId?.toString() === org._id.toString()) || users[0];
    const creatorId = adminUser?._id || new mongoose.Types.ObjectId();

    // 1. Leave Policy
    const leaveTitle = "Leave & Attendance Policy";
    let leave = await Article.findOne({ organizationId: org._id, title: leaveTitle });
    if (!leave) {
      leave = await Article.create({
        organizationId: org._id,
        title: leaveTitle,
        slug: `leave-and-attendance-policy-${org._id.toString().slice(-4)}`,
        summary: "Comprehensive guidelines on annual leave accrual, sick leave, compassionate leave, and holiday carry-over allowances.",
        content: {
          blocks: [
            {
              type: "callout",
              content: "Employees accrue 1.67 days of paid annual leave per completed month of service, totaling 20 business days of paid annual leave per calendar year.",
              order: 0,
            },
            {
              type: "text",
              content: "Annual Leave Accrual & Carry-Over:\n- Full-time employees accrue 20 annual leave days per year.\n- A maximum of 5 unused leave days can be carried forward into the subsequent calendar year.\n- Requests for leave extending beyond 5 consecutive days should be submitted at least 2 weeks in advance via the HR portal.",
              order: 1,
            }
          ],
        },
        tags: ["leave", "attendance", "vacation", "accrual", "policy", "holidays"],
        searchKeywords: ["leave", "annual", "accrual", "attendance", "vacation", "holiday", "sick", "days"],
        visibility: { access: "all" },
        publishing: {
          status: "published",
          publishedAt: new Date(),
          version: 1,
        },
        createdBy: creatorId,
        isDeleted: false,
      });
      console.log(`Created Leave Policy for org ${org.name}:`, leave._id);
    } else {
      leave.publishing.status = "published";
      leave.publishing.publishedAt = new Date();
      leave.isDeleted = false;
      await leave.save();
      console.log(`Updated Leave Policy for org ${org.name}:`, leave._id);
    }

    // 2. Travel & Expense Policy
    const expenseTitle = "Travel & Expense Reimbursement Policy";
    let expense = await Article.findOne({ organizationId: org._id, title: expenseTitle });
    if (!expense) {
      expense = await Article.create({
        organizationId: org._id,
        title: expenseTitle,
        slug: `travel-expense-policy-${org._id.toString().slice(-4)}`,
        summary: "Rules and submission guidelines for corporate travel expenses, daily per diem limits, and expense reimbursement receipts.",
        content: {
          blocks: [
            {
              type: "callout",
              content: "All business travel expenses must be submitted with itemized receipts within 30 days of travel completion.",
              order: 0,
            },
            {
              type: "text",
              content: "Travel & Per Diem Guidelines:\n- Daily meal allowance: Up to $75 per day for domestic travel and $100 per day for international travel.\n- Flights: Standard economy class for flights under 6 hours; premium economy eligible for long-haul international flights over 6 hours.\n- Hotel Accommodations: Standard business hotels up to $200/night in major metros.",
              order: 1,
            }
          ],
        },
        tags: ["travel", "expenses", "reimbursement", "per-diem", "finance", "policy"],
        searchKeywords: ["travel", "expense", "expenses", "reimbursement", "per-diem", "receipts", "flights", "hotels"],
        visibility: { access: "all" },
        publishing: {
          status: "published",
          publishedAt: new Date(),
          version: 1,
        },
        createdBy: creatorId,
        isDeleted: false,
      });
      console.log(`Created Travel Policy for org ${org.name}:`, expense._id);
    } else {
      expense.publishing.status = "published";
      expense.publishing.publishedAt = new Date();
      expense.isDeleted = false;
      await expense.save();
      console.log(`Updated Travel Policy for org ${org.name}:`, expense._id);
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
