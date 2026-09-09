# Schedule & Log 1-on-1 Check-in Meetings

## Journey ID
UJ-MGR-004

## Primary Role
Department / Team Manager (`manager`)

## Business Goal
Coordinate, schedule, and document recurring 1-on-1 onboarding check-in meetings between managers and new hires, track meeting agendas, sync calendar invites (.ics), and log developmental notes.

## Preconditions
Authenticated as `manager`.

## Trigger
Manager navigates to `/calendar` and clicks "Schedule 1-on-1 Check-in".

## Expected Outcome
1. Scheduling modal displays date, time, duration, agenda topics, and direct report selector.
2. Saving creates a calendar meeting event and generates downloadable/synced iCal (.ics) data.
3. Post-meeting, manager logs discussion notes and action items.

## Journey Steps
1. Navigate to `/calendar` (`src/pages/CalendarIntegration.tsx`).
2. Click "Schedule Meeting".
3. Select direct report employee.
4. Set Title: "Week 1 Check-in: Tools & Goals".
5. Set Date & Time.
6. Click "Create Event".
7. Client dispatches `POST /api/v1/calendar/events`.
8. Backend saves event and generates meeting invite.
9. Meeting renders on manager and employee calendar views.
10. Manager clicks "Log Notes" following meeting and saves summary notes (`PATCH /api/v1/calendar/events/:id`).

## Alternative Paths
- User downloads `.ics` file for Google Calendar or Outlook import.

## Validation Rules
- Start time must precede end time.

## Permissions
`requireRole(["owner", "admin", "manager"])`.

## APIs / Backend Dependencies
- `GET /api/v1/calendar/events`
- `POST /api/v1/calendar/events`
- `PATCH /api/v1/calendar/events/:id`

## Data Dependencies
- `CalendarEvent` in `calendar` collection.

## Notifications / Integrations
- Email invite with `.ics` attachment.

## Failure Scenarios
- Invalid date range: HTTP 400.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/pages/CalendarIntegration.tsx`
- `server/src/modules/calendar/controllers/calendar.controller.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase17-calendar.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-MGR-004.md`
