# Kiosk Domain Chunk 01: Device Identity & Pairing

## 1. Domain Scope

This domain governs how physical hardware devices establish trust, register with an enterprise organization, maintain long-lived cryptographic identities, and handle credential rotation or revocation.

---

## 2. Key Entities & Data Schema

### 2.1 Kiosk Device (`KioskDeviceModel`)

```typescript
export interface IKioskDevice extends Document {
  organizationId: mongoose.Types.ObjectId;
  deviceId: string;               // Stable unique hardware fingerprint / GUID
  hardwareGuid: string;           // MDM or browser-generated hardware UUID
  name: string;                   // Human-readable terminal name (e.g. "Gate A Terminal")
  location: string;               // Physical building / zone description
  siteId?: mongoose.Types.ObjectId;// Optional site / campus reference
  deviceGroupId?: mongoose.Types.ObjectId; // Optional device group reference
  deviceType: "wall_mount" | "countertop_tablet" | "floor_standing" | "desktop_terminal" | "rugged_handheld";
  status: "staged" | "online" | "offline" | "maintenance" | "suspended" | "decommissioned";
  paired: boolean;
  pairedAt?: Date;
  tokenRef: string;               // SHA-256 hash of currently active device bearer token
  tokenExpiresAt?: Date;
  lastSeen: Date;
  lastHeartbeatAt?: Date;
  ipAddress?: string;
  macAddress?: string;            // Deprecated diagnostic field only; not security anchor
  appVersion?: string;
  osInfo?: {
    platform: string;
    userAgent: string;
    screenResolution: string;
  };
  telemetry: IKioskTelemetry;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 Pairing Code Entity (`KioskPairingCodeModel`)

To fix **DEF-002**, pairing codes are stored in MongoDB with automatic TTL expiration:

```typescript
export interface IKioskPairingCode extends Document {
  code: string;                   // 6-digit numeric string generated via crypto.randomInt
  organizationId: mongoose.Types.ObjectId;
  deviceId?: string;              // Optional target device hardware GUID binding
  createdBy: mongoose.Types.ObjectId;
  expiresAt: Date;                // Indexed with TTL expireAfterSeconds: 0 (default 15 mins)
  attemptsCount: number;          // Max 5 attempts before invalidation
  consumed: boolean;
  consumedAt?: Date;
}
```

---

## 3. Pairing Lifecycle Handshake

```text
Admin Portal (Portal Admin)               Backend (API)                Physical Terminal (Kiosk Hardware)
     │                                         │                                      │
     │── 1. POST /devices/pair/code ──────────>│                                      │
     │      (Provide name, location, opt GUID) │                                      │
     │<─ 2. Returns 6-digit code (e.g. 849201)─│                                      │
     │                                         │                                      │
     │   Admin views code on screen            │                                      │
     │   Admin walks to terminal               │                                      │
     │                                         │── 3. Terminal opens /kiosk/pair ────>│
     │                                         │      Generates persistent deviceId   │
     │                                         │      Displays numeric keypad         │
     │                                         │                                      │
     │                                         │<─ 4. POST /devices/pair ─────────────│
     │                                         │      { code: "849201", deviceId,     │
     │                                         │        name, location }              │
     │                                         │                                      │
     │                                         │   5. Backend validates:              │
     │                                         │      - Code exists & not expired     │
     │                                         │      - Atomic consume (single-use)   │
     │                                         │      - Checks organization quota     │
     │                                         │      - Signs long-lived Device JWT   │
     │                                         │      - Computes SHA-256 tokenRef     │
     │                                         │      - Upserts KioskDeviceModel      │
     │                                         │                                      │
     │                                         │── 6. Returns { device, token } ─────>│
     │                                         │                                      │
     │                                         │      Terminal stores token in        │
     │                                         │      secure storage. Navigates to    │
     │                                         │      /kiosk/terminal. Ready!         │
```

---

## 4. Security Principles

1. **CSPRNG Generation**: `crypto.randomInt(100000, 1000000).toString()` ensures uniform, unguessable entropy.
2. **Atomic Single-Use**: Consuming a pairing code marks `consumed: true` in an atomic MongoDB `findOneAndUpdate`, preventing race conditions or replay attacks.
3. **Hardware Binding**: If an admin specifies a hardware GUID during code generation, the pairing request MUST supply matching hardware identifiers.
4. **Instant Revocation**: When an admin decommissions a device, `device.status = "decommissioned"`, `device.paired = false`, and `device.tokenRef = ""` are set. `verifyDeviceToken` immediately denies all subsequent requests.
