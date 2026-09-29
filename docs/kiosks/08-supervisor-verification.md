# Kiosk Domain Chunk 08: Supervisor Witness Verification

## 1. Domain Scope

This domain governs dual-attestation safety witnessing, supervisor 4-digit PIN verification, lockout rate-limiting, and witness audit record generation to fix **DEF-009**.

---

## 2. Supervisor Witness Workflow (ADR-008)

When a safety-critical journey reaches a step flagged with `supervisor_witness_required: true`:

```text
┌────────────────────────────────────────────────────────────────────────┐
│  🛑 SUPERVISOR WITNESS REQUIRED                                        │
│                                                                        │
│  Worker John Doe has completed the High-Voltage Safety Briefing.       │
│  A certified supervisor must witness physical PPE verification.        │
├────────────────────────────────────────────────────────────────────────┤
│  Supervisor ID / Email:                                                │
│  [ supervisor@talnova.com                                            ] │
│                                                                        │
│  Supervisor 4-Digit Authorization PIN:                                 │
│  [ ● ] [ ● ] [ ● ] [ ● ]                                               │
│                                                                        │
│  ┌───┬───┬───┐                                                         │
│  │ 1 │ 2 │ 3 │                                                         │
│  ├───┼───┼───┤                                                         │
│  │ 4 │ 5 │ 6 │                                                         │
│  ├───┼───┼───┤                                                         │
│  │ 7 │ 8 │ 9 │                                                         │
│  ├───┼───┼───┤                                                         │
│  │ C │ 0 │ ⌫ │                                                         │
│  └───┴───┴───┘                                                         │
│                                                                        │
│  [Cancel Briefing]                        [Authorize & Sign Off ➜]     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Security & Anti-Brute-Force Rules

1. **Role Verification**: The supervisor identifier must match a user in `UserModel` belonging to `organizationId` with `permissions.role` in `['owner', 'admin', 'manager', 'supervisor']`.
2. **PIN Validation**: Validated against `user.security.supervisorPinHash` using SHA-256 with timing-safe comparison.
3. **Rate Limiting & Lockout**:
   - Max 3 consecutive failed PIN attempts for a supervisor identifier within 10 minutes.
   - 4th failed attempt triggers a **5-minute lockout** for that supervisor account and logs a high-severity security alert.
4. **Separate Audit Attestation**:
   - The supervisor's ID, timestamp, and device ID are recorded in `session.supervisorWitness`.
   - The supervisor's session is ephemeral for that single transaction; the terminal does NOT remain logged into an administrative account.
