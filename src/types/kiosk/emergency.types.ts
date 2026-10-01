export interface EmergencyContact {
  name: string;
  phone: string;
  role?: string;
}

export type EmergencyType = 'fire' | 'gas_leak' | 'toxic_spill' | 'weather' | 'security_threat' | 'general';
export type EmergencySeverity = 'warning' | 'critical' | 'evacuate';

export interface KioskEmergency {
  _id?: string;
  organizationId: string;
  type: EmergencyType;
  severity: EmergencySeverity;
  title: string;
  message: string;
  evacuationMapUrl?: string;
  primaryExit?: string;
  secondaryExit?: string;
  assemblyZone?: string;
  emergencyContacts?: EmergencyContact[];
  soundSiren: boolean;
  isActive: boolean;
  triggeredAt: string;
  triggeredBy?: string;
  clearedAt?: string;
  clearedBy?: string;
  clearReason?: string;
  siteId?: string;
  deviceIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EmergencyBroadcastPayload {
  organizationId?: string;
  type: EmergencyType;
  severity?: EmergencySeverity;
  title: string;
  message: string;
  evacuationMapUrl?: string;
  primaryExit?: string;
  secondaryExit?: string;
  assemblyZone?: string;
  emergencyContacts?: EmergencyContact[];
  soundSiren?: boolean;
  siteId?: string;
  deviceIds?: string[];
}

export interface EmergencyClearPayload {
  organizationId?: string;
  reason?: string;
}
