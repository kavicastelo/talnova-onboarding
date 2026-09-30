export interface KioskDeviceGroup {
  _id: string;
  organizationId: string;
  name: string;
  description?: string;
  siteId?: string;
  deviceIds: string[];
  deviceCount?: number;
  assignmentCount?: number;
  devices?: any[];
  assignments?: any[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
