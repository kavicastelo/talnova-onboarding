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

  const orgs = await Organization.find({ isDeleted: false });
  const targetOrg = orgs[0];
  console.log('Target Org:', targetOrg._id, targetOrg.name);

  const adminUser = await User.findOne({ organizationId: targetOrg._id, 'permissions.role': { $in: ['admin', 'owner'] } });
  const creatorId = adminUser?._id || new mongoose.Types.ObjectId();

  // 1. Ensure "Leave & Attendance Policy" exists
  const leaveTitle = "Leave & Attendance Policy";
  let leavePolicy = await Article.findOne({ organizationId: targetOrg._id, title: leaveTitle });
  if (!leavePolicy) {
    leavePolicy = await Article.create({
      organizationId: targetOrg._id,
      title: leaveTitle,
      slug: "leave-and-attendance-policy",
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
          },
          {
            type: "text",
            content: "Sick & Emergency Leave:\n- All team members receive 10 days of paid medical/sick leave annually.\n- Medical certificates are requested for absences exceeding 2 consecutive working days.",
            order: 2,
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
    console.log('Created Leave Policy:', leavePolicy._id);
  } else {
    leavePolicy.publishing.status = "published";
    leavePolicy.publishing.publishedAt = new Date();
    await leavePolicy.save();
    console.log('Updated Leave Policy to published:', leavePolicy._id);
  }

  // 2. Ensure "Travel & Expense Reimbursement Policy" exists
  const expenseTitle = "Travel & Expense Reimbursement Policy";
  let expensePolicy = await Article.findOne({ organizationId: targetOrg._id, title: expenseTitle });
  if (!expensePolicy) {
    expensePolicy = await Article.create({
      organizationId: targetOrg._id,
      title: expenseTitle,
      slug: "travel-and-expense-reimbursement-policy",
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
          },
          {
            type: "text",
            content: "Expense Submissions:\n- Submit reimbursement reports through the Finance portal with attached itemized receipts.\n- Reimbursements are paid out in the next immediate semi-monthly payroll cycle.",
            order: 2,
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
    console.log('Created Travel & Expense Policy:', expensePolicy._id);
  } else {
    expensePolicy.publishing.status = "published";
    expensePolicy.publishing.publishedAt = new Date();
    await expensePolicy.save();
    console.log('Updated Travel & Expense Policy to published:', expensePolicy._id);
  }

  const all = await Article.find({ organizationId: targetOrg._id, isDeleted: false });
  console.log('Target Org Articles count:', all.length, all.map(a => a.title));

  await mongoose.disconnect();
}

prepare().catch(console.error);
