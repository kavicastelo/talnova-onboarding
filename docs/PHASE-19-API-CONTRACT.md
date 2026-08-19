# Phase 19 API Contract Summary: Office Map & Location Experience

**Phase:** Phase 19 — Office Map & Location Experience  

---

## 1. Create Office Location Facility

- **HTTP Method:** `POST`
- **Path:** `/api/v1/locations`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`)
- **Request Body:**
```json
{
  "name": "San Francisco Innovation Hub",
  "code": "SF-HQ-01",
  "address": {
    "street": "500 Howard Street",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "country": "USA"
  },
  "accessInfo": {
    "wifiSsd": "Talnova-SF-5G",
    "wifiPassword": "SFInnovation2026!",
    "buildingAccessCode": "PASS-9988",
    "parkingInfo": "Level B1 Reserved Parking",
    "arrivalInstructions": "Check in with lobby reception on 1st Floor."
  },
  "floors": [
    {
      "floorNumber": 1,
      "floorName": "Floor 1 — Engineering & Operations",
      "desks": [
        { "deskNumber": "101-A", "zone": "DevOps", "isAvailable": true }
      ]
    }
  ],
  "isPrimary": true
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Office location facility created successfully",
  "data": {
    "_id": "60d5ec49f1b2c81123456789",
    "name": "San Francisco Innovation Hub",
    "code": "SF-HQ-01"
  }
}
```

---

## 2. Assign Employee to Desk Seat

- **HTTP Method:** `POST`
- **Path:** `/api/v1/locations/:id/assign-desk`
- **Auth / RBAC:** `Bearer JWT` (`owner`, `admin`, `manager`)
- **Request Body:**
```json
{
  "floorNumber": 1,
  "deskNumber": "101-A",
  "targetUserId": "60d5ec49f1b2c81123456781"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Employee desk assigned successfully",
  "data": {
    "assignedDesk": {
      "deskNumber": "101-A",
      "assignedUserId": "60d5ec49f1b2c81123456781",
      "assignedUserName": "Marcus FieldUser",
      "isAvailable": false
    }
  }
}
```

---

## 3. Get Employee Location Guidance & Directions

- **HTTP Method:** `GET`
- **Path:** `/api/v1/locations/my-location`
- **Auth / RBAC:** `Bearer JWT` (Authenticated User)
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Employee office location guidance retrieved successfully",
  "data": {
    "locationId": "60d5ec49f1b2c81123456789",
    "name": "San Francisco Innovation Hub",
    "address": {
      "street": "500 Howard Street",
      "city": "San Francisco",
      "country": "USA"
    },
    "accessInfo": {
      "wifiSsd": "Talnova-SF-5G",
      "wifiPassword": "SFInnovation2026!",
      "buildingAccessCode": "PASS-9988"
    },
    "assignedFloorNumber": 1,
    "assignedDesk": {
      "deskNumber": "101-A",
      "isAvailable": false
    },
    "googleMapsDirectionsUrl": "https://www.google.com/maps/dir/?api=1&destination=500%20Howard%20Street%2C%20San%20Francisco%2C%20USA"
  }
}
```
