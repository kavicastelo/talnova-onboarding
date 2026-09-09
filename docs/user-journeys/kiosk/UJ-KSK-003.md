# Verify SOP Video Playback & Touch PPE Compliance Checkbox

## Journey ID
UJ-KSK-003

## Primary Role
Frontline Worker / Operator (`kiosk_operator`)

## Business Goal
Ensure factory floor workers view mandatory safety briefings (SOP video playback), confirm required Personal Protective Equipment (PPE: hard hat, high-vis vest, steel-toe boots) via touch checkmarks, and record compliance event logs.

## Preconditions
Kiosk player is active in Step playback view.

## Trigger
Worker views the SOP instructional video and taps "Confirm PPE & Safety Compliance".

## Expected Outcome
1. Video streams without buffering interruptions.
2. Worker confirms high-contrast touch checkboxes (Hard Hat, Eye Protection, Safety Footwear).
3. Taps large "I Confirm & Enter Plant" action button.
4. Terminal records completion event locally or dispatches telemetry log to server.
5. Displays green confirmation checkmark and resets terminal for next worker after 10 seconds.

## Journey Steps
1. Worker watches shift safety video on touch terminal.
2. Video finishes or reaches completion threshold.
3. High-contrast PPE checklist renders on screen.
4. Worker taps oversized checkboxes (each with >=64px touch target).
5. Worker taps "Submit Verification".
6. Frontend buffers analytics event `{ eventType: "PPE_COMPLIANCE_CONFIRMED", stepId, timestamp }`.
7. Client dispatches or queues event to `/api/v1/kiosk/analytics/sync`.
8. Terminal displays "Compliance Logged. Have a safe shift!" and auto-resets to initial screen.

## Alternative Paths
- If worker fails to check all mandatory PPE items, submission button remains disabled.

## Validation Rules
- All mandatory PPE items must be confirmed before proceeding.

## Permissions
Device session or signed URL.

## APIs / Backend Dependencies
- `POST /api/v1/kiosk/analytics/sync` (`server/src/modules/kiosk/routes/kiosk.routes.ts`)

## Data Dependencies
- `KioskAnalytics` in `kioskanalytics` collection.

## Notifications / Integrations
None.

## Failure Scenarios
- Network offline during submission: Terminal stores event in local IndexedDB queue and transmits on next heartbeat.

## Current Implementation

### Status
`IMPLEMENTED`

### Evidence
- `src/features/kiosk/`
- `server/src/modules/kiosk/services/kiosk.service.ts`

### Missing Pieces
None.

### Known Issues
None.

## Test Coverage
Automated in `server/src/tests/phase14-kiosk.test.ts`.

## Test Prompt
Reference:
`prompts/user-journeys/UJ-KSK-003.md`
