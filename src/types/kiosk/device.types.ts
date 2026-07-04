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
  readonly name: string;
  readonly location: string; // e.g. "Factory Floor Gate B"
  readonly status: KioskDeviceStatus;
  readonly lastSeen: Timestamp;
  readonly ipAddress?: string;
  readonly macAddress?: string;
  readonly pairedAt?: Timestamp;
  readonly currentJourneyId?: JourneyId;
  readonly currentContentVersion: VersionNumber;
  readonly telemetry: KioskTelemetry;
}

import { KIOSK_COMMAND_TYPES } from "../../constants/kiosk/device.constants.js";

export type KioskCommandType = typeof KIOSK_COMMAND_TYPES[number];

export interface KioskCommand {
  readonly command: KioskCommandType;
  readonly payload?: Readonly<Record<string, unknown>>;
}
