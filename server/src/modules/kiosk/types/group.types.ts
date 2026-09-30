import { OrganizationId, DeviceId, Timestamp } from "./common.types.js";

export interface KioskDeviceGroup {
  readonly _id: string;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly description?: string;
  readonly siteId?: string;
  readonly deviceIds: DeviceId[];
  readonly createdBy?: string;
  readonly isDeleted?: boolean;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}
