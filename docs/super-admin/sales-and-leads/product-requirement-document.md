Product Requirements Document (PRD)
Enterprise Onboarding Platform — Sales, Leads, Marketing & AI Intelligence

Document type: Functional requirements and implementation specification
Target users: AI coding agents, backend engineers, frontend engineers, QA engineers, product managers
Platform: Existing enterprise onboarding application — Super Admin Dashboard
Status: Ready for technical planning and implementation
Priority: Production-grade implementation

1. Project Overview
1.1 Objective

Extend the existing Super Admin Dashboard with an integrated sales and marketing management system that allows administrators to manage the complete customer acquisition lifecycle from the same account.

The system must manage leads, track sales opportunities, communicate with prospective customers, run email and WhatsApp campaigns, monitor sales performance, and provide AI-generated insights using OpenAI, Google Gemini, and other configurable AI providers.

The application has already reached production readiness, and product demos have been shared with prospective companies. Therefore, the implementation must preserve existing functionality and support the conversion of existing demo recipients into qualified leads, customers, and active enterprise organizations.

1.2 Main business goals
Manage leads from initial inquiry through conversion.
Track enterprise sales opportunities and revenue forecasts.
Create, schedule, launch, and monitor email and WhatsApp campaigns.
Automate follow-ups and sales workflows.
Analyze lead sources, conversion rates, campaign performance, and revenue.
Generate AI-driven recommendations, summaries, and sales insights.
Integrate third-party communication, CRM, analytics, and AI APIs.
Connect successful sales to the existing onboarding and organization management workflows.
Maintain complete auditability, security, tenant isolation, and operational reliability.
Enable future expansion without requiring a complete redesign.
1.3 Scope boundaries

The initial implementation should include:

Lead management.
Contact and company management.
Sales pipeline and deal management.
Email and WhatsApp campaign management.
Communication history.
Sales activities, tasks, reminders, and automation.
Dashboards, reports, and analytics.
AI insights and recommendations.
Integration and configuration management.
Security, permissions, audit logs, and compliance controls.

Advanced capabilities such as predictive lead scoring, automated sales agents, advanced attribution modeling, and custom workflow builders should be designed for extensibility. They can be introduced in later phases if not included in the first release.

2. Core Architecture and Navigation
2.1 Super Admin navigation structure

Add the following sections to the existing Super Admin Dashboard.

Sales Overview
Leads
All Leads
Lead Inbox
Import Leads
Lead Segments
Lead Sources
Lead Scoring
Companies & Contacts
Companies
Contacts
Duplicate Management
Sales CRM
Sales Pipeline
Deals / Opportunities
Activities & Tasks
Meetings & Demo History
Quotes & Proposals
Campaigns
Campaign Overview
Email Campaigns
WhatsApp Campaigns
Templates
Audience Segments
Automation Workflows
Communications
Unified Inbox
Email History
WhatsApp History
Communication Preferences
Analytics & Reports
Lead Analytics
Sales Analytics
Campaign Analytics
Revenue Forecasting
Conversion Funnel
AI Sales Intelligence
AI Insights
Lead Prioritization
Recommended Actions
Sales Forecast Insights
AI Assistant
Integrations
Email Providers
WhatsApp Providers
AI Providers
Webhooks & API Connections
Sales Settings
Pipeline Configuration
Lead Fields
Scoring Rules
Automation Rules
User Roles & Permissions
Audit Logs

The navigation must follow the application's existing sidebar, layout, design system, and responsive behavior.

2.2 Shared system architecture

All modules must use shared entities and services rather than maintaining isolated copies of the same information.

Recommended logical architecture:

Frontend: Existing Super Admin interface and reusable UI components.
Backend: Existing API and service architecture.
Database: Existing database, extended with sales and marketing entities.
Background processing: Durable job queue for campaigns, scheduled follow-ups, AI analysis, and webhook processing.
Integration layer: Provider-independent adapters for communication and AI services.
Analytics layer: Aggregated reporting queries or materialized summaries where appropriate.
Security layer: Existing authentication, role-based access control, audit logging, and organization isolation.

These are logical responsibilities, not a requirement to introduce microservices. Follow the existing architecture unless there is a demonstrated scalability or reliability need to separate components.

3. Feature Module A — Sales Overview Dashboard
3.1 Purpose

Provide a single-screen summary of the entire sales operation, helping the Super Admin understand business performance, outstanding work, and the next actions required.

3.2 Atomic features
A. KPI cards

Display:

Total leads.
New leads this period.
Qualified leads.
Leads awaiting follow-up.
Active deals.
Open pipeline value.
Weighted pipeline value.
Closed-won revenue.
Closed-lost deals.
Lead-to-customer conversion rate.
Campaign delivery and response rates.
Overdue sales activities.

Each KPI must include:

Current value.
Previous-period comparison.
Absolute and percentage change where meaningful.
Configurable reporting period.
A drill-down action that opens the relevant filtered records.
B. Visualizations
Lead acquisition trend.
Lead source distribution.
Sales pipeline by stage.
Revenue won over time.
Forecast versus target.
Campaign performance comparison.
Lead conversion funnel.
Sales activity trend.
Lead response time distribution.
C. Action center

Display a prioritized list of:

High-priority new leads.
Leads without an assigned owner.
Leads awaiting follow-up.
Overdue tasks.
Deals approaching their expected close date.
Deals with no recent activity.
Campaigns requiring attention.
Failed integrations or campaign jobs.
AI-recommended next actions.
D. Global filters

Support filtering by:

Date range.
Lead source.
Campaign.
Lead owner.
Sales representative.
Pipeline.
Deal stage.
Industry.
Country or region.
Lead status.
Customer segment.
E. Dashboard customization
Allow permitted users to save their preferred filters.
Allow configurable reporting periods.
Provide role-appropriate views.
Export permitted reports.
Persist dashboard preferences where supported by the existing application.
3.3 Business logic
Use a consistent timezone policy for date-based reporting.
Define whether reporting periods use creation date, activity date, conversion date, or close date.
Count each lead once in unique-lead metrics.
Exclude test records and deleted records according to a documented policy.
Clearly distinguish pipeline value from recognized or collected revenue.
Use the same underlying metric definitions throughout all dashboards.
Calculate comparisons against equivalent previous periods.
Apply access permissions to dashboard aggregates as well as individual records.

Acceptance criteria: The Super Admin can identify sales performance, outstanding work, and business risks without manually opening individual leads or deals.

4. Feature Module B — Lead Management
4.1 Purpose

Provide a complete lead lifecycle management system for companies that have expressed interest in the enterprise onboarding product.

4.2 Lead data model

Every lead should support the following fields.

Field	Purpose
Lead ID	Unique internal identifier
Lead name	Person's full name
Business email	Primary business email
Phone number	Contact number in normalized format
WhatsApp number	WhatsApp-enabled number, if different
Company name	Associated business
Job title	Contact's position
Industry	Business sector
Company size	Estimated employee or account size
Country / region	Geographic segmentation
Lead source	Website, demo, referral, campaign, import, etc.
Source details	Referrer, campaign, landing page, or external identifier
Lead status	New, contacted, qualified, disqualified, converted
Lead score	Rule-based or AI-assisted score
Assigned owner	Responsible sales representative
Priority	Low, normal, high, urgent
Interested product	Product or service of interest
Estimated budget	Optional commercial information
Expected purchase date	Estimated decision timeline
Last contact date	Most recent meaningful communication
Next follow-up date	Planned next action
Consent status	Channel-specific communication permissions
Tags	Flexible classification
Notes	Internal sales notes
Created / updated dates	Lifecycle timestamps
Converted references	Associated contact, company, deal, or organization IDs

Sensitive fields should be permission-controlled. Do not collect unnecessary personal information.

4.3 Atomic features
A. Lead creation
Manual lead creation.
Quick-add lead form.
Bulk CSV/XLSX import.
API-based lead creation.
Website or demo request integration.
Lead creation from incoming email or approved integrations.
Lead creation from campaign responses.
Lead creation from existing demo records.
Capture original acquisition source.
Store UTM parameters where available.
Record creation timestamp and creator.
B. Lead listing
Search by name, email, company, phone, or lead ID.
Filter by status, owner, source, score, tags, and date.
Sort by creation date, priority, score, and next follow-up.
Paginate large datasets.
Support configurable columns.
Save frequently used filters.
Support bulk selection and permitted bulk actions.
C. Lead profile

Each lead should have a detailed profile with:

Contact information.
Company information.
Lead score and scoring explanation.
Current status.
Assigned owner.
Tags and custom fields.
Notes.
Tasks and reminders.
Emails and WhatsApp messages.
Campaign participation.
Demo attendance and history.
Deal history.
Audit timeline.
AI summary and recommendations.
D. Lead lifecycle management

Recommended default lifecycle:

New → Contacted → Engaged → Qualified → Opportunity → Converted

Additional outcomes:

Nurturing.
Disqualified.
Unresponsive.
Lost.
Duplicate.

Lifecycle status and sales pipeline stage must be separate concepts. A lead may be qualified while a related deal is in the proposal stage.

Every lifecycle transition should:

Validate whether the transition is allowed.
Record the previous and new status.
Record the user or automation responsible.
Store the timestamp.
Trigger eligible automation rules.
Preserve historical records.

Disqualification should support a reason, such as wrong audience, invalid contact, no budget, or not interested.

E. Lead assignment
Assign an owner manually.
Reassign leads in bulk.
Automatically assign using configurable rules.
Support round-robin assignment if required.
Support region, industry, workload, or source-based assignment.
Notify the new owner.
Track assignment history.
Escalate unassigned leads.
F. Duplicate detection

Use configurable matching rules:

Exact normalized email match.
Normalized phone match.
Existing external CRM identifier.
Company plus contact name.
Fuzzy matching for potential duplicates.

When duplicates are detected:

Warn the user.
Show matching records.
Allow review before merging.
Select a surviving primary record.
Preserve communication and activity history.
Retain the IDs of merged records for traceability.
Avoid silently overwriting consent preferences.
G. Lead scoring

Implement two scoring mechanisms.

Rule-based scoring:

Example configurable rules:

Requested a product demo: +25.
Visited the pricing page: +10.
Replied to a sales email: +15.
Attended a demo: +20.
Matches target company size: +10.
Invalid business email: -20.
Unqualified industry: -15.

These values are examples and must be configurable.

AI-assisted scoring:

Analyze approved lead and interaction data.
Estimate sales readiness.
Explain the signals behind the recommendation.
Identify missing information.
Provide a confidence indicator where technically meaningful.
Record the scoring model or prompt version.
Allow human review and override.

Scores should be bounded, normalized, and reproducible. Avoid repeatedly adding points for the same event unless the rule explicitly permits it. Apply decay or freshness rules to old engagement signals.

H. Lead conversion

When a lead becomes a customer opportunity or customer:

Convert or link the lead to a contact.
Link the contact to a company.
Create or link a deal.
Preserve the original lead ID and acquisition source.
Avoid duplicate companies and contacts.
Record conversion time and responsible user.
Trigger the appropriate sales or onboarding workflow.

Important: Converting a lead must not automatically provision an enterprise tenant, activate a paid subscription, or grant access to a company unless the required approval and provisioning conditions have been satisfied.

4.4 Acceptance criteria
Leads can be created, searched, edited, assigned, filtered, and converted.
Duplicate records can be identified and reviewed safely.
Every important lifecycle transition is traceable.
A lead's complete communication and activity history remains accessible.
Bulk operations respect permissions and provide success/failure summaries.
5. Feature Module C — Companies, Contacts, and Enterprise Accounts
5.1 Purpose

Manage the businesses evaluating or purchasing the enterprise onboarding product and distinguish prospective accounts from active customers.

5.2 Atomic features
Create and update company profiles.
Associate multiple contacts with one company.
Designate primary decision-makers.
Track decision-maker roles: buyer, evaluator, technical contact, approver, and administrator.
Store industry, employee count, geographic region, and company website.
Track company lifecycle: prospect, qualified account, customer, inactive, or former customer.
Link multiple leads and deals to the same company.
View complete company-level interaction history.
Record existing demo organizations and demo access details.
Associate companies with existing platform organizations using stable internal IDs.
Detect duplicate companies by domain, registration identifier where appropriate, and name.
Track account-level notes and customer requirements.
Store account owner and customer success owner.
Track expected seats, estimated annual contract value, and potential onboarding volume.
Separate prospect data from production tenant data.
5.3 Enterprise conversion logic

When a deal is won:

Validate the company and primary contact.
Confirm the deal's required approval status.
Check whether a corresponding platform organization already exists.
Create an onboarding request or reuse the existing request.
Execute the existing tenant provisioning workflow only after required conditions are met.
Store the link between the deal and the platform organization.
Record provisioning status and any errors.
Notify the responsible administrator.
Maintain an audit trail.

Provisioning should be idempotent: retrying a successful operation must not create duplicate organizations or subscriptions.

6. Feature Module D — Sales CRM and Pipeline Management
6.1 Purpose

Track qualified opportunities from discovery through contract closure.

6.2 Default sales pipeline

Use a configurable pipeline with these initial stages:

Qualification.
Discovery completed.
Demo completed.
Proposal sent.
Negotiation.
Closed Won.
Closed Lost.

Stages must be configurable because sales processes may change.

6.3 Deal data model

Each deal should include:

Deal ID.
Deal name.
Associated company.
Primary contact.
Associated lead, if applicable.
Pipeline and stage.
Deal owner.
Estimated deal value.
Currency.
Billing frequency.
Estimated one-time implementation fees.
Estimated annual recurring revenue.
Probability of closing.
Expected close date.
Actual close date.
Competitor information, if known.
Next action.
Loss reason.
Contract or proposal references.
Approval status.
Notes and activity history.

Do not treat annual contract value, total contract value, one-time setup fees, and recognized revenue as interchangeable metrics.

6.4 Atomic features
Create, edit, duplicate, and archive deals.
Display a Kanban pipeline.
Provide a tabular deal view.
Drag deals between stages with validation.
Show stage age and days since last activity.
Maintain deal history.
Record sales activities.
Set expected close dates.
Track lost and won reasons.
Configure stage-specific required fields.
Set probability defaults by stage.
Permit authorized users to override probability.
Support multiple pipelines if the business model requires them.
Associate multiple contacts with a deal.
Track product editions, seat counts, and commercial requirements.
Attach proposal and contract documents using secure storage.
Record discount approvals and commercial exceptions.
Integrate with invoicing or billing systems when available.
6.5 Sales calculations

Weighted pipeline value:

Weighted Pipeline
=
∑
𝑖
=
1
𝑛
(
Deal Value
𝑖
×
Probability
𝑖
)

Use a probability between 0 and 1.

Forecasts should separately report:

Open pipeline.
Weighted pipeline.
Expected wins.
Closed-won value.
Recurring revenue.
One-time revenue.

Forecasting should account for currency and reporting-period rules.

6.6 Closed-won logic

A deal may be marked Closed Won only if required fields and approvals are satisfied.

After closing:

Record actual close date.
Freeze or audit commercial changes.
Create the required onboarding request.
Trigger provisioning or billing only through approved workflows.
Update conversion metrics.
Notify relevant stakeholders.
6.7 Closed-lost logic
Require a configurable loss reason.
Preserve the deal and its activity history.
Record competitor or objection details when available.
Stop inappropriate active sales sequences.
Optionally enroll the contact in a future nurture workflow if permitted.
Exclude the deal from open pipeline calculations.
7. Feature Module E — Sales Activities and Follow-ups
7.1 Atomic features
Create tasks and reminders.
Associate activities with leads, contacts, companies, or deals.
Support calls, meetings, emails, demos, proposals, and general tasks.
Set due dates, priorities, and owners.
Mark tasks complete or reschedule them.
Show overdue activities.
Record task completion history.
Support recurring follow-ups where appropriate.
Notify users of approaching deadlines.
Provide an activity calendar.
Support meeting outcomes and next steps.
Automatically create follow-up tasks after demos.
Automatically flag leads without a next action.
7.2 Follow-up automation

Example:

A new demo request is created.
The system assigns the lead.
A notification is sent to the assigned owner.
A follow-up task is created.
If no activity occurs within the configured SLA, a reminder is sent.
If the lead remains unattended, it is escalated.
The system stops escalation once the lead is handled.

SLA durations must be configurable. Automation should check whether the lead is already contacted before creating duplicate reminders.

8. Feature Module F — Email Campaign Management
8.1 Purpose

Enable the Super Admin to design, schedule, send, and measure email campaigns through configurable third-party providers.

8.2 Provider abstraction

Support an adapter architecture for email services such as:

Amazon SES.
SendGrid.
Mailgun.
Other compatible email APIs.

Provider availability depends on the selected vendor, account configuration, and applicable limits.

The business logic must not depend directly on one vendor's API. Use a shared internal interface for sending, scheduling, delivery events, bounces, complaints, and suppression management.

8.3 Campaign creation wizard
Step 1: Campaign details
Campaign name.
Internal description.
Campaign type.
Objective.
Owner.
Tags.
Tracking parameters.
Step 2: Audience selection
Select leads, contacts, or companies.
Select saved segments.
Filter by industry, source, owner, status, score, and tags.
Exclude existing customers when appropriate.
Exclude suppressed or unsubscribed recipients.
Show estimated eligible recipients.
Preview sample recipients.
Validate the audience before launch.
Step 3: Email composition
Sender name.
Verified sender email.
Reply-to address.
Subject line.
Preview text.
HTML content.
Plain-text alternative.
Reusable templates.
Personalization variables.
CTA buttons.
Unsubscribe link.
Company identification details.
Link tracking where enabled.
Step 4: Validation

Check:

Required sender configuration.
Valid recipient addresses.
Missing personalization variables.
Required unsubscribe mechanism.
Consent and suppression status.
Duplicate recipients.
Broken or disallowed links where detectable.
Provider quota and sending limits.
Template rendering and test-send results.
Step 5: Delivery
Send test email.
Save draft.
Schedule campaign.
Send immediately.
Pause or cancel eligible scheduled campaigns.
Display launch confirmation.
Track execution progress.
Step 6: Reporting
Eligible recipients.
Accepted or submitted messages.
Delivered messages.
Bounces.
Complaints.
Unsubscribes.
Unique opens where measurable.
Unique clicks.
Replies where integrated.
Conversions.
Attributed deals and revenue where tracking supports attribution.
8.4 Campaign state machine

Recommended states:

Draft → Validating → Scheduled → Queued → Sending → Completed

Additional states:

Paused.
Cancelled.
Failed.
Partially Failed.

Transitions must be validated by the backend.

A campaign that has begun sending cannot be treated as if no messages were sent when paused or cancelled. Already submitted messages may still be delivered.

8.5 Sending logic
Use a background queue rather than blocking web requests.
Process recipients in controlled batches.
Respect provider rate limits and quotas.
Retry transient failures with exponential backoff and jitter.
Do not endlessly retry permanent failures.
Make message submission idempotent wherever supported.
Persist each recipient's send status.
Verify webhook signatures.
Handle duplicate and out-of-order webhook events.
Store provider message IDs.
Implement bounce and complaint suppression.
Prevent duplicate campaign execution after retries.
Maintain campaign-level and recipient-level audit history.
8.6 Email compliance
Maintain unsubscribe and suppression records.
Respect applicable marketing consent and legal requirements.
Include required sender identification and unsubscribe mechanisms.
Do not use purchased or unauthorized lists without appropriate legal review.
Distinguish transactional messages from marketing messages.
Do not assume a previous demo request automatically grants indefinite marketing consent.
8.7 Acceptance criteria

An administrator can create a campaign, test it, select an audience, schedule or launch it, monitor recipient-level outcomes, and investigate delivery failures without accessing the provider dashboard directly.

9. Feature Module G — WhatsApp Campaign Management
9.1 Purpose

Provide campaign creation and message monitoring for WhatsApp using approved third-party WhatsApp Business integrations.

9.2 Integration options

Design the provider adapter to support vendors such as:

Meta WhatsApp Business Platform / Cloud API.
Twilio WhatsApp.
Other compatible business messaging providers.

Use the selected provider's supported authentication, messaging, template, webhook, and delivery-status mechanisms.

9.3 Atomic features
A. Provider setup
Configure provider credentials securely.
Register sender or business account identifiers.
Verify webhook connectivity.
Validate provider permissions.
Check account readiness.
Display connection status.
Support test messages where permitted.
Monitor provider errors and quotas.
B. Template management
List approved templates.
Import or synchronize template status.
Create template submission requests if supported.
Handle template approval and rejection.
Display template language and category.
Map template parameters.
Validate parameter count and format.
Preview rendered messages.
Prevent production sending with unapproved templates when approval is required.
C. Audience management
Select eligible contacts.
Validate normalized phone numbers.
Verify applicable WhatsApp opt-in records.
Exclude contacts who opted out.
Exclude invalid numbers.
Deduplicate recipients.
Apply segmentation filters.
Display estimated eligible recipients.
D. Campaign execution
Select an approved template or eligible message type.
Map dynamic variables.
Schedule messages.
Send in controlled batches.
Track per-recipient statuses.
Respect provider limits.
Retry eligible transient errors.
Pause or cancel unsent work.
Record provider message IDs.
E. Incoming messages
Receive inbound webhook events.
Validate webhook authenticity.
Store messages and timestamps.
Match messages to existing contacts.
Create an unassigned inbox item when matching is uncertain.
Allow authorized users to reply.
Route conversations to sales owners.
Record the full conversation history.
F. WhatsApp analytics

Track:

Eligible recipients.
Messages submitted.
Delivered messages.
Read receipts where available.
Failed messages.
Replies.
Opt-outs.
Qualified leads generated.
Meetings or demos booked.
Attributed conversions.
9.4 WhatsApp business rules
Enforce the provider's current messaging-window rules and template requirements.
Require appropriate consent before initiating marketing messages.
Process opt-outs promptly.
Do not assume that a valid phone number implies WhatsApp consent.
Prevent campaigns from using free-form messages where provider rules require templates.
Handle delivery and read statuses as distinct events.
Never interpret a missing read receipt as proof that a message was not read.
Allow an administrator to stop an active campaign.
Prevent retries from creating duplicate messages when the provider supports idempotency or equivalent safeguards.
10. Feature Module H — Unified Communication Inbox
10.1 Purpose

Give sales representatives one place to review communications across supported channels.

10.2 Atomic features
Combined email and WhatsApp conversation list.
Filter by channel, owner, status, lead, and company.
Search conversations.
Display chronological conversation history.
Associate conversations with leads, contacts, and deals.
Assign and reassign conversations.
Add internal notes.
Mark conversations open, pending, or resolved.
Display last response time.
Create a follow-up task from a message.
Generate AI conversation summaries.
Suggest responses for human review.
Support approved replies through the correct provider.
Track failed sends and retry status.
Display consent and communication eligibility.

Do not store API credentials or provider secrets in client-visible conversation objects.

11. Feature Module I — Campaigns, Segmentation, and Automation
11.1 Purpose

Enable reusable audience segments and rule-based customer acquisition workflows across email and WhatsApp.

11.2 Segment builder

Allow users to create dynamic segments using rules such as:

Lead status is Qualified.
Lead source is Product Demo.
Lead score is above a configured threshold.
Company size matches a target range.
Contact belongs to a selected industry.
Last activity exceeds a specified duration.
Contact has not replied to a campaign.
Contact has a valid consent record for the selected channel.
Deal stage is Proposal Sent.
Customer is not yet converted.

Support AND/OR grouping, rule validation, preview counts, saved segments, and reusable filters.

A segment's membership should be calculated using the latest eligible data. Campaign execution must revalidate recipient eligibility before sending.

11.3 Workflow automation builder

The first release can use predefined automation templates. A fully visual workflow editor is optional.

Trigger examples
Lead created.
Lead assigned.
Lead score crosses a threshold.
Demo booked.
Demo completed.
Deal stage changed.
Follow-up overdue.
Campaign reply received.
Deal won.
Deal lost.
Action examples
Assign owner.
Create task.
Send internal notification.
Add or remove tag.
Update eligible fields.
Add contact to a permitted nurture sequence.
Send an approved email or WhatsApp message.
Generate an AI summary.
Create an onboarding request.
Escalate to a manager.
Conditional rules
Lead status.
Score threshold.
Consent status.
Time since last interaction.
Deal value.
Owner or region.
Campaign engagement.
11.4 Automation safety rules
Support enable, disable, and draft states.
Provide execution logs.
Validate the workflow before activation.
Prevent infinite loops.
Prevent duplicate task and message creation.
Support execution limits and cooldowns.
Allow manual intervention.
Provide retry and error handling.
Respect channel consent and suppression.
Do not execute destructive actions without authorization.
Require approval for high-impact commercial or provisioning actions.
12. Feature Module J — Analytics and Reporting
12.1 Lead analytics

Include:

Leads created over time.
Leads by source.
Leads by industry and region.
Leads by status.
Leads by owner.
Lead qualification rate.
Average time to first response.
Average time to qualification.
Duplicate detection rate.
Lead aging.
Unassigned lead count.
Lead conversion rate.
12.2 Sales analytics

Include:

Deals by pipeline stage.
Total open pipeline value.
Weighted pipeline value.
Closed-won revenue.
Closed-lost value.
Win rate.
Average deal size.
Average sales cycle.
Stage conversion rates.
Deal aging.
Forecast versus target.
Revenue by source.
Revenue by sales owner.
Revenue by industry.
Loss reasons.
Recurring versus one-time revenue.
12.3 Campaign analytics

Include:

Campaigns launched.
Eligible recipients.
Delivery rate.
Bounce or failure rate.
Open rate where measurable.
Click-through rate.
Reply rate.
Unsubscribe rate.
Complaint rate.
Cost per lead where cost data exists.
Cost per qualified lead where cost data exists.
Demo bookings.
Deals influenced or attributed.
Campaign-attributed revenue.
12.4 Funnel analytics

Recommended funnel:

Lead Created → Contacted → Qualified → Demo Completed → Proposal Sent → Closed Won

Provide:

Number of records entering each stage.
Conversion between consecutive stages.
Overall lead-to-customer conversion.
Average time between stages.
Drop-off rate.
Date-based cohort comparison.

Define the funnel cohort consistently. For example, when measuring conversion for leads created in a given month, do not count only leads that completed their entire sales journey within that same month unless that is explicitly the chosen metric.

12.5 Metric definitions

Use explicit formulas and consistent filters.

Lead conversion rate

Unique Converted Leads
Eligible Leads in Cohort
×
100

Email delivery rate

Delivered Messages
Eligible Messages Submitted
×
100

Click-through rate

Unique Recipients Who Clicked
Delivered Messages
×
100

Deal win rate

Closed-Won Deals
Closed-Won Deals
+
Closed-Lost Deals
×
100

Cost per qualified lead

Eligible Acquisition Costs
Qualified Leads Attributed to Those Costs

Define treatment of refunds, duplicate events, test campaigns, missing costs, and reporting windows before implementing these calculations.

Email open rates are approximate because of privacy features, image prefetching, and tracking restrictions. They must not be treated as definitive evidence that a person read a message.

12.6 Reports and exports
Prebuilt reports.
Custom date ranges.
Saved filters.
CSV export.
Spreadsheet export where supported.
PDF report generation if needed.
Scheduled report delivery.
Permission-aware exports.
Export audit logs.
Background processing for large exports.
13. Feature Module K — AI Sales Intelligence
13.1 Purpose

Provide actionable, explainable recommendations using OpenAI, Google Gemini, and other configurable AI providers.

AI must assist sales representatives and administrators rather than make unrestricted decisions on their behalf.

13.2 Provider architecture

Implement a provider-independent AI service.

Recommended logical interface:

generateStructuredInsight()
summarizeLead()
summarizeConversation()
scoreLead()
recommendNextAction()
generateEmailDraft()
generateWhatsAppDraft()
analyzeCampaign()
explainSalesTrend()
analyzeDealRisk()

The names are illustrative; align them with the project's existing coding conventions.

Each provider adapter should handle:

Authentication.
Model selection.
Request formatting.
Structured output validation.
Token or usage tracking where available.
Timeouts.
Rate limits.
Retry policies.
Error normalization.
Provider-specific capabilities.
Cost tracking where supported.

Provider selection should be configurable per feature. If a fallback provider is enabled, only fall back under defined conditions and compatible data policies.

13.3 AI feature inventory
A. AI lead summary

Generate:

Company overview based on approved data.
Contact role and known requirements.
Previous interactions.
Key objections.
Purchase intent indicators.
Missing information.
Suggested next action.

Distinguish known facts from inferred possibilities.

B. AI lead prioritization
Rank leads using approved data.
Identify engagement signals.
Highlight leads requiring immediate attention.
Explain why each lead is prioritized.
Identify stale or incomplete records.
Allow human override.
Track whether recommendations were accepted.
C. AI next-best action

Examples:

Schedule a product demo.
Follow up on an unanswered proposal.
Contact a second decision-maker.
Request missing company information.
Prepare an ROI explanation.
Move the lead into a suitable nurture sequence.

Recommendations should consider lead status, previous interactions, consent, deal stage, and existing tasks.

D. AI email and WhatsApp drafting
Draft initial outreach.
Generate personalized follow-ups.
Summarize demo outcomes.
Respond to common product questions.
Draft proposal follow-ups.
Adjust tone and length.
Use approved product documentation and pricing information.
Identify unsupported claims.
Require human approval before sending by default.

The model must not invent discounts, contractual promises, product features, integrations, or pricing.

E. AI campaign analysis
Explain high and low performance.
Identify possible audience problems.
Compare campaigns using consistent metrics.
Suggest subject line or content experiments.
Identify potential deliverability issues.
Recommend segmentation changes.
Propose A/B tests.
Estimate confidence appropriately.

AI should not claim causation from a simple correlation.

F. AI sales forecasting insights
Highlight pipeline changes.
Identify deals at risk.
Explain missing deal activity.
Identify unusual conversion patterns.
Summarize forecast changes.
Suggest actions to improve forecast quality.

Forecast numbers must come from validated calculations, not free-form model-generated arithmetic.

G. AI objection analysis

Classify approved conversation content into categories such as:

Price.
Security.
Compliance.
Integration requirements.
Implementation time.
Product functionality.
Internal approval.
Competitor comparison.

Show evidence snippets or linked source messages when appropriate. Allow users to correct classifications.

H. AI sales assistant

Provide a conversational interface for questions such as:

Which qualified leads have not been contacted?
Which deals are at risk this month?
Why did campaign performance decrease?
Which companies are most likely to request a demo?
What are the most common objections?
Which follow-ups should I complete today?

The assistant must query authorized, current application data through controlled backend tools. It must not answer with invented database results.

13.4 AI output contract

Prefer validated structured outputs, for example:

{
  "insight_type": "follow_up_recommendation",
  "summary": "The lead has not received a follow-up after the demo.",
  "recommended_action": "Create a follow-up task",
  "priority": "high",
  "evidence": [
    "Demo completed",
    "No subsequent sales activity recorded"
  ],
  "confidence": 0.88,
  "requires_human_approval": true
}


This is an illustrative schema, not a required provider response format. Validate all fields server-side and normalize them into an internal schema.

A confidence score must only be displayed when its meaning has been defined and validated. Do not present arbitrary model confidence as a statistically calibrated probability.

13.5 AI safety and reliability
Treat lead notes, emails, uploaded documents, and inbound messages as untrusted input.
Prevent prompt injection from triggering unauthorized tools or data access.
Enforce permissions before retrieving data for AI.
Minimize personal data sent to external providers.
Configure provider-specific retention and data-processing policies.
Avoid sending credentials, secrets, or unnecessary sensitive data.
Store model, provider, prompt version, timestamp, and relevant source references.
Validate structured outputs.
Track AI failures and latency.
Provide a non-AI fallback for core workflows.
Allow users to correct or dismiss insights.
Require approval for sending messages, applying discounts, modifying contracts, deleting data, or provisioning tenants.
Do not use AI-generated recommendations as the sole basis for consequential decisions about people.
13.6 AI insight lifecycle

Recommended lifecycle:

Requested → Processing → Generated → Reviewed → Accepted / Dismissed

Additional states:

Failed.
Expired.
Superseded.

Store the generation status and source data version where feasible. Refresh time-sensitive recommendations when underlying records change.

14. Feature Module L — Integrations Management
14.1 Integration dashboard

Provide a centralized page showing:

Integration name.
Provider type.
Connection status.
Last successful operation.
Last error.
Rate-limit or quota warnings.
Configuration status.
Webhook status.
Test connection action.
Enable/disable controls.
Integration event logs.
14.2 Required integration categories
Email delivery providers.
WhatsApp Business providers.
AI providers.
Existing demo or onboarding systems.
Calendar and meeting tools, if required.
CRM synchronization, if required.
Billing or subscription services.
Analytics and conversion tracking.
Webhooks and external APIs.
14.3 Credential management
Store secrets in a secure secret store or encrypted server-side configuration.
Never expose private API keys to the browser.
Mask secret values in the UI.
Support credential rotation.
Apply least-privilege access.
Audit credential configuration changes.
Validate credentials before enabling production sends.
Separate test and production credentials.
Restrict integration management to authorized administrators.
14.4 Webhook processing
Verify signatures or other provider authenticity mechanisms.
Store event IDs and process events idempotently.
Handle duplicate and out-of-order events.
Reject unauthorized payloads.
Avoid trusting arbitrary external status updates.
Retry transient processing failures.
Send failed events to a reviewable dead-letter queue.
Provide replay tools with appropriate permissions.
Record webhook processing outcomes.
15. Additional Features Commonly Missed

These features are important for a production-grade enterprise sales system.

15.1 Audit and compliance
Record who created, changed, assigned, merged, converted, or deleted records.
Maintain immutable or tamper-resistant audit records where required.
Track campaign launches and cancellations.
Track exports and sensitive administrative actions.
Support configurable data retention.
Provide deletion and correction workflows where legally required.
Track channel-specific consent and opt-out timestamps.
Store the source and method of consent where available.
15.2 Permissions and governance

Recommended permissions:

View leads.
Create leads.
Edit leads.
Assign leads.
Merge leads.
Export leads.
View deals.
Edit deals.
Approve discounts.
Manage campaigns.
Launch campaigns.
Manage templates.
Manage integrations.
View analytics.
View AI insights.
Configure AI providers.
Manage automation.
View audit logs.

Even if only Super Admin users initially use the module, implement backend permission checks. Do not rely on hiding UI controls.

15.3 Import and export management
Upload files securely.
Map incoming columns to internal fields.
Validate rows before importing.
Preview changes.
Detect duplicates.
Provide row-level validation errors.
Support background imports.
Allow authorized rollback where technically safe.
Report imported, skipped, updated, and failed records.
Apply export permissions and audit logging.
15.4 Search and global navigation
Global search for leads, contacts, companies, and deals.
Direct navigation to matching records.
Saved filters.
Recently viewed records.
Keyboard-friendly interactions.
Pagination and server-side filtering for large datasets.
15.5 Notifications
In-app notifications.
Optional email notifications.
Optional approved WhatsApp notifications for internal users.
Assignment alerts.
Overdue task alerts.
Campaign failure alerts.
Integration outage alerts.
AI insight availability alerts.
Notification preferences.
Read/unread status.
Deduplication and escalation rules.
15.6 Data quality management
Missing business email detection.
Invalid phone number detection.
Missing company association.
Duplicate contact detection.
Stale lead detection.
Inconsistent lifecycle status detection.
Invalid consent-state detection.
Scheduled data-quality reports.
15.7 Reliability and operational monitoring
Queue health monitoring.
Failed job tracking.
Integration error rates.
Campaign processing latency.
AI provider latency and error rates.
API usage and cost monitoring.
Database performance monitoring.
Backup and recovery procedures.
Operational alerts.
Controlled retry and replay tools.
15.8 Commercial management

Depending on the sales model, include:

Product plans and editions.
Seat or user quantity estimates.
One-time setup fees.
Recurring subscription value.
Discount requests.
Approval workflows.
Quotes and proposals.
Contract status.
Renewal dates.
Expansion opportunities.
Billing integration.

These should be connected to the existing product and billing model instead of duplicating it.

16. Recommended Database Entities

The exact schema must be adapted to the existing database. Avoid creating a second representation of entities that already exist.

Entity	Responsibility
leads	Lead identity, source, status, score, owner
contacts	Contact identity and communication details
companies	Prospect and customer business information
company_contacts	Relationships between companies and contacts
lead_activities	Calls, demos, meetings, and follow-ups
lead_status_history	Lifecycle transitions
lead_assignments	Assignment history
lead_scores	Score history, reason codes, and scoring versions
pipelines	Configurable sales pipelines
pipeline_stages	Stage definitions and probabilities
deals	Commercial opportunities
deal_contacts	Contact relationships for deals
deal_stage_history	Stage changes and timestamps
tasks	Follow-ups and reminders
campaigns	Campaign configuration and lifecycle
campaign_recipients	Recipient eligibility and delivery status
campaign_events	Delivery, bounce, click, reply, and opt-out events
email_templates	Email content and versions
whatsapp_templates	Provider template references and status
communication_threads	Unified communication conversations
communication_messages	Individual inbound and outbound messages
audience_segments	Saved audience rules
automation_workflows	Workflow definitions
automation_executions	Execution history and errors
integration_connections	Provider configuration metadata
webhook_events	Verified inbound event processing
ai_insights	AI-generated summaries and recommendations
ai_usage_logs	Provider usage, latency, and cost metadata
consent_records	Channel-specific consent and opt-out history
audit_logs	Administrative and data-change history
sales_goals	Sales targets and quotas
onboarding_requests	Sales-to-onboarding handoff
16.1 Database implementation rules
Use stable primary keys and foreign-key relationships.
Add indexes for frequent searches, joins, filters, and date ranges.
Enforce appropriate unique constraints.
Normalize email addresses and phone numbers for matching.
Use transactions for critical multi-record changes.
Use idempotency keys for retriable operations.
Store money using appropriate decimal or integer minor-unit representations.
Store currency explicitly.
Store timestamps consistently, preferably in UTC, and render in the user's configured timezone.
Use soft deletion only where it fits retention and privacy requirements.
Keep consent and opt-out history available for compliance checks.
Do not store entire provider secrets in ordinary integration tables.
Consider partitioning or archival for high-volume event tables when justified by actual scale.
17. API and Service Requirements

Implement APIs following the existing project's routing, authentication, and error-handling conventions.

Representative endpoint groups:

Module	Example endpoints
Leads	GET /api/leads, POST /api/leads, PATCH /api/leads/:id
Lead actions	POST /api/leads/:id/assign, POST /api/leads/:id/convert
Companies	GET /api/companies, POST /api/companies
Contacts	GET /api/contacts, POST /api/contacts
Deals	GET /api/deals, POST /api/deals, PATCH /api/deals/:id
Tasks	GET /api/tasks, POST /api/tasks
Campaigns	GET /api/campaigns, POST /api/campaigns
Campaign actions	POST /api/campaigns/:id/test, POST /api/campaigns/:id/schedule, POST /api/campaigns/:id/launch
Segments	GET /api/segments, POST /api/segments
Analytics	GET /api/analytics/sales, GET /api/analytics/campaigns
AI	POST /api/ai/lead-summary, POST /api/ai/recommendations
Integrations	GET /api/integrations, POST /api/integrations/:id/test
Webhooks	Provider-specific authenticated webhook routes

These routes are examples, not mandatory URL contracts.

17.1 API rules
Validate request parameters and payloads.
Enforce authentication and authorization on every protected route.
Return consistent error formats.
Use pagination for large lists.
Apply server-side filtering and sorting.
Prevent unauthorized mass assignment.
Validate all status transitions.
Use rate limiting where appropriate.
Make long-running work asynchronous.
Use idempotency protection for critical write operations.
Avoid returning sensitive credentials.
Add API tests for authorization boundaries.
Version external-facing APIs where appropriate.
18. Frontend Requirements
18.1 General UI behavior
Reuse existing dashboard components.
Support responsive layouts.
Provide loading, empty, error, and success states.
Show confirmation dialogs for destructive or high-impact actions.
Use clear labels and helpful validation messages.
Support pagination and debounced search.
Preserve filters when navigating back from a record.
Display timestamps in the configured timezone.
Use accessible form controls and keyboard navigation.
Clearly distinguish read-only and editable fields.
18.2 Required reusable components
KPI card.
Filter toolbar.
Searchable data table.
Lead status badge.
Lead score indicator.
Lead profile panel.
Activity timeline.
Task creation form.
Pipeline Kanban board.
Deal detail panel.
Campaign wizard.
Email editor.
WhatsApp template preview.
Audience segment builder.
Campaign delivery monitor.
Analytics chart.
AI insight panel.
Integration status card.
Audit log viewer.
Import/export progress panel.
18.3 Destructive action handling

Require appropriate confirmation for:

Merging records.
Bulk updating records.
Deleting records.
Launching large campaigns.
Disabling integrations.
Cancelling active jobs.
Applying significant commercial changes.
Triggering organization provisioning.

Show a preview of the affected records or recipients whenever practical.

19. Security, Privacy, and Compliance

Treat the application as an enterprise production system.

19.1 Required controls
Reuse existing authentication and session security.
Enforce backend authorization.
Protect against cross-tenant data leakage.
Encrypt data in transit.
Protect sensitive data at rest.
Store API secrets securely.
Validate webhook authenticity.
Apply rate limits.
Prevent injection and cross-site scripting.
Protect against cross-site request forgery where applicable.
Maintain audit logs.
Restrict bulk exports.
Implement secure file upload handling.
Apply data retention and deletion policies.
Review applicable privacy, marketing, and messaging regulations.
Follow provider-specific terms and policies.
19.2 Consent model

Consent must be channel-specific and sufficiently granular.

For example:

Email marketing consent.
WhatsApp marketing consent.
Transactional communication eligibility.
Opt-out timestamp.
Consent source.
Consent collection timestamp.
Applicable policy or consent text version.
Supporting evidence where required.

Do not assume that permission to send an onboarding-related transactional message implies permission to send promotional campaigns.

19.3 AI data protection
Configure approved providers and models.
Restrict AI features to authorized records.
Minimize the data sent to external AI services.
Avoid exposing one company's data in another company's context.
Apply provider retention and processing policies.
Keep sensitive credentials out of model prompts.
Audit sensitive AI actions.
Make AI-generated content identifiable to reviewers before publication.
20. Testing and Quality Assurance
20.1 Unit tests

Test:

Lead validation.
Lead scoring.
Status transitions.
Assignment rules.
Duplicate matching.
Conversion calculations.
Deal probability calculations.
Revenue calculations.
Consent eligibility.
Campaign state transitions.
Retry eligibility.
AI response validation.
Permission checks.
20.2 Integration tests

Test:

Email provider success and failure.
WhatsApp provider success and failure.
Webhook signature verification.
Duplicate webhook handling.
AI provider timeouts.
AI provider fallback, if configured.
Database transaction behavior.
Queue retries.
Onboarding handoff.
Credential rotation.
Import and export jobs.

Use mocked providers or sandbox accounts for automated testing. Do not send real production campaigns during tests.

20.3 End-to-end tests

Essential scenarios:

Create a lead manually.
Import a batch of leads.
Detect a duplicate.
Assign a lead.
Record a demo.
Convert the lead into a deal.
Move the deal through the pipeline.
Mark the deal Closed Won.
Create an onboarding request.
Draft, test, and launch a marketing campaign in a test environment.
Receive and process a delivery webhook.
Process a WhatsApp reply.
Generate an AI lead summary.
Verify that an unauthorized user cannot access restricted data.
Verify that opted-out contacts are excluded from campaigns.
Verify that retries do not create duplicate sends or organizations.
Verify that a failed provider does not break lead management.
20.4 Performance and reliability tests

Test realistic production-like volumes for:

Lead list queries.
Global search.
Large imports.
Campaign audience calculation.
Background sending.
Analytics aggregation.
AI request latency.
Webhook bursts.
Concurrent status changes.

Set performance targets after reviewing existing traffic, expected customer volumes, infrastructure, and provider quotas.

21. Implementation Roadmap

Implement in phases to reduce production risk.

Phase 0 — Discovery and architecture
Inspect the existing repository and application structure.
Identify the current Super Admin routes and layout.
Identify existing user, company, organization, and demo entities.
Review authentication and permissions.
Review the database schema and migration approach.
Identify existing notification, queue, and audit infrastructure.
Document integration requirements and provider choices.
Produce a technical implementation plan.

Deliverable: Architecture map, entity mapping, migration plan, and approved feature backlog.

Phase 1 — Lead management foundation
Database migrations.
Lead CRUD.
Search, filters, and pagination.
Companies and contacts.
Lead assignment.
Lead profile and activity history.
Import and duplicate detection.
Basic permissions and audit logging.
Initial sales overview.

Exit condition: The team can reliably manage leads and preserve their history.

Phase 2 — Sales CRM
Sales pipeline.
Deal management.
Tasks and follow-ups.
Demo history.
Deal conversion.
Closed-won and closed-lost workflows.
Onboarding handoff.
Sales analytics.

Exit condition: A lead can move from initial inquiry through a won or lost opportunity, with all transitions traceable.

Phase 3 — Email and WhatsApp
Integration configuration.
Template management.
Audience segments.
Campaign creation wizard.
Test sends.
Scheduling and background execution.
Webhooks and recipient statuses.
Consent and suppression management.
Campaign analytics.

Exit condition: Both communication channels work reliably in a sandbox or controlled production rollout.

Phase 4 — Automation and AI
Follow-up automation.
Workflow execution logs.
AI lead summaries.
AI scoring and prioritization.
AI next-best-action recommendations.
AI message drafting.
AI campaign analysis.
AI provider configuration and usage monitoring.

Exit condition: AI features are explainable, permission-aware, validated, and subject to appropriate human approval.

Phase 5 — Advanced analytics and optimization
Revenue forecasting.
Funnel and cohort analysis.
Attribution reporting.
Advanced segmentation.
A/B testing.
Advanced sales automation.
Scheduled reports.
Operational alerting and performance optimization.

Exit condition: Management can assess acquisition, pipeline health, sales effectiveness, and campaign ROI with consistent metrics.

22. Production Rollout and Migration

Because the existing onboarding application is already production-ready, the implementation must be additive and backward-compatible.

Required rollout controls:

Use versioned database migrations.
Take and verify backups before schema changes.
Avoid destructive changes to existing tables.
Use feature flags for new dashboard modules.
Deploy schema changes before enabling dependent functionality.
Validate the new modules in staging.
Run regression tests against existing onboarding flows.
Test with a small internal dataset first.
Validate provider sandbox behavior.
Launch campaigns gradually.
Monitor errors and background queues.
Maintain a rollback plan.
Keep existing Super Admin functionality available throughout the rollout.

Do not import existing demo records blindly. Map existing demo recipients, companies, and organizations to the new CRM entities, resolve duplicates, and preserve their original identifiers.

23. Definition of Done

A feature is complete only when all relevant conditions are met:

Frontend UI is implemented.
Backend endpoints are implemented.
Database migrations are included.
Validation and business logic are enforced server-side.
Permissions are enforced.
Loading, empty, success, and error states are present.
Audit logging is implemented where required.
Automated tests are included.
Documentation is updated.
External integrations are configured through secure server-side mechanisms.
Failure and retry behavior is defined.
No existing production workflow is broken.
The feature has been tested in staging.
The implementation is observable and supportable in production.

A visually complete dashboard with placeholder data, nonfunctional buttons, or frontend-only validation does not satisfy the definition of done.

24. Instructions for AI Coding Agents

These instructions should be followed whenever an AI coding agent implements the document.

Step 1 — Inspect before modifying
Read the project structure.
Identify the frontend framework, backend framework, database, and authentication system.
Inspect the existing Super Admin dashboard.
Identify reusable components and coding conventions.
Locate existing organization, company, demo, and onboarding entities.
Identify existing background jobs, notifications, and audit logging.
Determine how migrations and tests are managed.

Do not assume a framework, database, or ORM that has not been verified.

Step 2 — Create an implementation plan

Before writing code, document:

Existing files and components to reuse.
New files and components required.
Database changes.
API contracts.
Permission requirements.
Integration dependencies.
Background job requirements.
Test cases.
Risks and unresolved decisions.

Separate mandatory requirements from optional enhancements.

Step 3 — Implement incrementally
Work one module at a time.
Start with the data model and business rules.
Implement backend validation before connecting the UI.
Reuse existing layout and design components.
Use real persisted data rather than mock data in production paths.
Add tests with each feature.
Keep migrations backward-compatible.
Use transactions and idempotency for critical operations.
Do not implement external integrations using hardcoded credentials.
Do not silently skip failed requirements.
Step 4 — Verify every module

For each feature:

Test its normal path.
Test invalid inputs.
Test permission restrictions.
Test empty and failure states.
Test concurrency and retry behavior where relevant.
Confirm existing application behavior is unchanged.
Document any provider-specific configuration required.
Step 5 — Report implementation status

At the end of each implementation phase, report:

Features completed.
Files created or modified.
Database migrations added.
API endpoints added.
Tests executed and their results.
Required environment variables.
External accounts or provider configuration still needed.
Known limitations.
Remaining tasks.

Do not claim an integration is operational until it has been configured and successfully tested.

25. Final Recommended Feature Priorities
Priority	Features	Reason
P0 — Essential	Lead management, company/contact records, permissions, audit logs, duplicate detection	Foundation for reliable sales operations
P0 — Essential	Sales pipeline, tasks, demos, lead conversion, onboarding handoff	Connects prospects to enterprise customers
P1 — High	Email campaigns, WhatsApp campaigns, consent, webhooks, delivery monitoring	Enables direct prospect communication
P1 — High	Sales overview, conversion funnel, campaign reporting	Makes business performance measurable
P1 — High	Provider configuration, retry logic, secure credentials, queue monitoring	Required for production reliability
P2 — High value	AI summaries, lead prioritization, message drafting, next-best-action recommendations	Improves sales productivity
P2 — High value	Audience segments and follow-up automation	Reduces repetitive work
P2 — High value	Forecasting, attribution, scheduled reports	Improves management decisions
P3 — Advanced	Visual workflow builder, advanced predictive scoring, A/B testing, advanced forecasting	Enables later optimization

The priority labels indicate implementation order, not permission to omit security, privacy, data integrity, or operational safeguards from an earlier release.

26. Final Product Outcome

Once implemented, the existing Super Admin Dashboard should support the entire enterprise acquisition process:

Acquire → Capture Lead → Qualify → Assign → Engage → Demo → Create Deal → Send Proposal → Close → Onboard → Analyze → Optimize

The Super Admin should be able to:

See every prospective company and its sales status.
Identify which leads need attention.
Track every demo and sales interaction.
Launch and monitor email and WhatsApp campaigns.
Understand which campaigns generate qualified leads and customers.
Track deals, commercial value, and sales forecasts.
Use AI to summarize interactions and recommend next steps.
Connect successful deals to the existing enterprise onboarding process.
Monitor the health of integrations and automation.
Maintain secure, auditable, production-grade operations.

Final implementation principle: Build a unified sales and marketing layer around the existing onboarding platform, with a single source of truth for leads, contacts, companies, deals, communications, and organization provisioning. Keep external providers interchangeable, critical operations deterministic, and AI recommendations explainable and subject to appropriate human oversight.