import {
  DeviceId,
  JourneyId,
  OrganizationId,
  Timestamp,
  VersionNumber,
  KioskDeviceStatus
} from "./common.types.js";

export interface KioskTelemetry {
  readonly batteryLevel?: number; // 0.0 to 1.0
  readonly isCharging?: boolean;
  readonly storageUsedBytes?: number;
  readonly storageFreeBytes?: number;
  readonly appVersion?: string;
  readonly networkLatencyMs?: number;
}

export interface KioskDevice {
  readonly _id: DeviceId;
  readonly organizationId: OrganizationId;
  readonly deviceId: string; // Cryptographic hardware GUID / UUID fingerprint
  readonly hardwareGuid: string; // MDM or browser-generated hardware UUID
  readonly name: string;
  readonly location: string; // e.g. "Factory Floor Gate B"
  readonly siteId?: string;
  readonly deviceGroupId?: string;
  readonly deviceType?: "wall_mount" | "countertop_tablet" | "floor_standing" | "desktop_terminal" | "rugged_handheld";
  readonly status: KioskDeviceStatus;
  readonly paired?: boolean;
  readonly pairedAt?: Timestamp;
  readonly tokenRef?: string;
  readonly tokenExpiresAt?: Timestamp;
  readonly lastSeen: Timestamp;
  readonly lastHeartbeatAt?: Timestamp;
  readonly ipAddress?: string;
  /**
   * @deprecated Relegated to optional diagnostic metadata; not used as security anchor or identity (ADR-003).
   */
  readonly macAddress?: string;
  /**
   * @deprecated Decoupled in favor of KioskDeviceAssignment (ADR-001, DEF-003). Kept for backward compatibility during migration.
   */
  readonly currentJourneyId?: JourneyId;
  readonly currentContentVersion: VersionNumber;
  readonly isDeleted?: boolean;
  readonly deletedAt?: Timestamp;
  readonly deletedBy?: string;
  readonly telemetry: KioskTelemetry;
}

import { KIOSK_COMMAND_TYPES } from "../constants/device.constants.js";

export type KioskCommandType = typeof KIOSK_COMMAND_TYPES[number];

export interface KioskCommand {
  readonly command: KioskCommandType;
  readonly payload?: Readonly<Record<string, unknown>>;
}
