# Kiosk Domain Chunk 13: Completion Integrity & Certification

## 1. Domain Scope

This domain defines server-authoritative completion verification, tamper-evident cryptographic hashes, verifiable completion certificates with QR codes, and public audit verification to fix **DEF-004** (ADR-007).

---

## 2. Server-Authoritative Verification Pipeline

A journey is marked complete ONLY when the server validates the following criteria:

```text
1. Step Progression Integrity:
   - Every mandatory step in the published version snapshot was visited.
   - Timestamps show monotonically increasing progress without impossible skips.

2. Minimum Dwell Times:
   - Video steps satisfy required playback threshold.
   - Interactive hold steps verified for holdDurationMs.

3. PPE & Checklist Verification:
   - All mandatory items checked.

4. Quiz Passing Score:
   - Score >= journey.settings.passingScorePercentage.

5. Supervisor Witness (if required):
   - Valid supervisor PIN / badge verification recorded.
```

If all criteria are met, the backend sets `session.status = "completed"` and mints the official completion record.

---

## 3. Cryptographic Verification Hash

The backend computes an immutable SHA-256 HMAC digest representing the completion facts:

```typescript
const payload = `${session._id}:${organizationId}:${userId}:${journeyId}:${versionNumber}:${completedAt.toISOString()}`;
const verificationHash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
```

This verification hash is stored on the session document and printed on generated certificates.

---

## 4. Completion Certificate & Public Verification Route

1. **Certificate Generation**:
   - Generates a PDF or high-resolution vector certificate displaying: Employee Name, Journey Title, Version, Date/Time, Terminal Name/Location, Supervisor Attestation, and a QR code.
2. **Public Verification Route**:
   - The QR code points to:
     `https://app.talnova.com/verify/cert/:certificateId`
   - Third-party auditors (OSHA, safety inspectors, insurance underwriters) can scan the QR code to verify the authentic, untampered completion record in real time without platform login credentials.
