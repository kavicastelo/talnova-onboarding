import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface DeskData {
  deskNumber: string;
  zone?: string;
  x?: number;
  y?: number;
  assignedUserId?: string;
  assignedUserName?: string;
  isAvailable: boolean;
}

export interface FloorPlanData {
  floorNumber: number;
  floorName: string;
  mapImageUrl?: string;
  desks: DeskData[];
}

export interface AccessInfoData {
  wifiSsd?: string;
  wifiPassword?: string;
  buildingAccessCode?: string;
  parkingInfo?: string;
  arrivalInstructions?: string;
}

export interface OfficeAddressData {
  street: string;
  city: string;
  state?: string;
  zip?: string;
  country: string;
}

export interface OfficeLocationData {
  _id: string;
  name: string;
  code: string;
  address: OfficeAddressData;
  timezone: string;
  accessInfo: AccessInfoData;
  floors: FloorPlanData[];
  isPrimary: boolean;
}

export interface EmployeeLocationGuidanceData {
  locationId: string;
  name: string;
  address: OfficeAddressData;
  accessInfo: AccessInfoData;
  assignedFloorNumber: number;
  assignedDesk: DeskData;
  googleMapsDirectionsUrl: string;
  floors: FloorPlanData[];
}

export const locationService = {
  getLocations: async (): Promise<OfficeLocationData[]> => {
    const response = await apiClient.get<ApiResponse<OfficeLocationData[]>>('/locations');
    return response.data.data || [];
  },

  getLocationById: async (id: string): Promise<OfficeLocationData> => {
    const response = await apiClient.get<ApiResponse<OfficeLocationData>>(`/locations/${id}`);
    return response.data.data;
  },

  createLocation: async (data: Partial<OfficeLocationData>): Promise<OfficeLocationData> => {
    const response = await apiClient.post<ApiResponse<OfficeLocationData>>('/locations', data);
    return response.data.data;
  },

  assignDesk: async (locationId: string, floorNumber: number, deskNumber: string, targetUserId: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/locations/${locationId}/assign-desk`, {
      floorNumber,
      deskNumber,
      targetUserId,
    });
    return response.data.data;
  },

  getMyLocationGuidance: async (): Promise<EmployeeLocationGuidanceData | null> => {
    const response = await apiClient.get<ApiResponse<EmployeeLocationGuidanceData>>('/locations/my-location');
    return response.data.data || null;
  },
};

export default locationService;
