# Kiosk Domain Chunk 07: Employee Identity & Session Lifecycle

## 1. Domain Scope

This domain governs frontline worker identification, privacy-preserving lookup, ephemeral session tokens, and the formal session lifecycle state machine to fix **DEF-004** and **DEF-008**.

---

## 2. Frontline Worker Identification Flow

Frontline workers identify themselves without typing complex usernames or passwords:

```text
                  Frontline Worker Approaches Terminal
                                  │
                                  ▼
                     Chooses Identification Mode:
                     ├─ Option 1: Scan Physical Badge (Barcode / QR / RFID)
                     ├─ Option 2: Enter Numeric Employee ID / Badge ID
                     └─ Option 3: Enter National ID / Phone Number
                                  │
                                  ▼
                POST /api/v1/kiosk/identify
                { identifier: "EMP-49821", kioskDeviceId: "kiosk-01" }
                                  │
                                  ▼
                Backend Performs Privacy-Safe Lookup:
                - Finds User matching organizationId and identifier
                - Verifies user status is active or onboarding
                - Generates ephemeral Session JWT (expires in 1 hour)
                - Scope: "kiosk_preboarding_execution"
                - Returns masked profile:
                  { id: "...", fullName: "John D.", department: "Logistics" }
                                  │
                                  ▼
                Terminal Confirms Identity:
                "Welcome, John D. Is this you?" [Yes, Continue] [No, Cancel]
                                  │
                                  ▼
                Initializes KioskSession Entity in Backend
```

---

## 3. Session Lifecycle State Machine

```text
  ┌──────────────┐
  │     IDLE     │ ─── Terminal waiting on Home Screen
  └──────┬───────┘
         │ Worker identified OR Public journey started
         ▼
  ┌──────────────┐
  │    ACTIVE    │ ─── Worker navigating steps & interacting with content
  └──────┬───────┘
         │
         ├─── Step requires supervisor witness ───> ┌─────────────────────┐
         │                                          │ AWAITING_SUPERVISOR │
         │ <── Supervisor enters valid PIN ───────── └─────────────────────┘
         │
         ├─── User taps "Exit" OR 60s idle timeout -> ┌──────────────┐
         │                                            │   ABORTED    │ ──> Memory Wipe -> IDLE
         │                                            └──────────────┘
         │
         └─── User completes final step & gate ───> ┌──────────────┐
                                                    │  COMPLETED   │ ──> Issue Certificate -> IDLE
                                                    └──────────────┘
```

---

## 4. Kiosk Session Entity Schema (`KioskSessionModel`)

```typescript
export interface IKioskSession extends Document {
  organizationId: mongoose.Types.ObjectId;
  deviceId: mongoose.Types.ObjectId;
  journeyId: mongoose.Types.ObjectId;
  journeyVersionId: mongoose.Types.ObjectId; // Bound to immutable snapshot
  versionNumber: number;
  userId?: mongoose.Types.ObjectId;         // Null for anonymous sessions
  sessionToken: string;                      // Ephemeral session JWT
  status: "active" | "awaiting_supervisor" | "completed" | "aborted" | "timed_out";
  startedAt: Date;
  completedAt?: Date;
  durationSeconds: number;
  currentStepId: string;
  completedStepIds: string[];
  ppeItemsVerified: string[];
  quizScore?: number;
  supervisorWitness?: {
    supervisorId: mongoose.Types.ObjectId;
    witnessedAt: Date;
    method: "pin" | "badge";
  };
  verificationChecksum?: string;            // SHA-256 HMAC of session completion facts
  isOfflineSync: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
