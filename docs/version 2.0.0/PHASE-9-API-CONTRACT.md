# Phase 9 API Contract Summary: Calendar & Meeting Integration

**Phase:** Phase 9 — Calendar & Meeting Integration  

---

## 1. Connect Calendar Provider / iCal Feed

- **HTTP Method:** `POST`
- **Path:** `/api/v1/calendar/connection`
- **Auth / RBAC:** `Bearer JWT` (Any authenticated user)
- **Request Body:**
```json
{
  "provider": "ical",
  "timezone": "America/New_York"
}
```
- **Response `200 OK`:** Created `CalendarConnection` object with `icalToken`.

---

## 2. Public iCal (.ics) Feed Subscription

- **HTTP Method:** `GET`
- **Path:** `/api/v1/calendar/feed/:token.ics`
- **Auth / RBAC:** Unauthenticated (Token authenticated in URL)
- **Response `200 OK`:**
- **Headers:** `Content-Type: text/calendar; charset=utf-8`
- **Body Content:**
```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Talnova Onboarding//Calendar Integration//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Talnova Onboarding Schedule
BEGIN:VEVENT
UID:event-1787162318-abc12345@talnova.app
DTSTAMP:20260819T232838Z
DTSTART:20260820T100000Z
DTEND:20260820T103000Z
SUMMARY:Day 1 Welcome Coffee & Orientation
LOCATION:https://meet.google.com/test-meet-123
STATUS:SCHEDULED
END:VEVENT
END:VCALENDAR
```

---

## 3. Schedule Meeting Event

- **HTTP Method:** `POST`
- **Path:** `/api/v1/calendar/events`
- **Auth / RBAC:** `Bearer JWT` (Any authenticated user)
- **Request Body:**
```json
{
  "title": "Day 7 Manager 1-on-1 Sync",
  "category": "manager_1on1",
  "attendeeUserIds": ["60d5ec49f1b2c81123456789"],
  "startTime": "2026-08-27T10:00:00.000Z",
  "endTime": "2026-08-27T10:30:00.000Z",
  "locationUrl": "https://meet.google.com/abc-defg-hij"
}
```
- **Response `201 Created`:** Created `MeetingEvent` object.

---

## 4. Cancel Meeting Event

- **HTTP Method:** `DELETE`
- **Path:** `/api/v1/calendar/events/:id`
- **Auth / RBAC:** `Bearer JWT` (Organizer or Admin)
- **Response `200 OK`:** Updated `MeetingEvent` object with status `cancelled`.
