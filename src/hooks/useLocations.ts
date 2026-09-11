import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { locationService, OfficeLocationData } from '../services/location.service';

export function useLocations() {
  return useQuery({
    queryKey: ['officeLocations'],
    queryFn: () => locationService.getLocations(),
  });
}

export function useLocationById(id?: string) {
  return useQuery({
    queryKey: ['officeLocation', id],
    queryFn: () => (id ? locationService.getLocationById(id) : null),
    enabled: !!id,
  });
}

export function useMyLocationGuidance() {
  return useQuery({
    queryKey: ['myLocationGuidance'],
    queryFn: () => locationService.getMyLocationGuidance(),
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<OfficeLocationData>) => locationService.createLocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['officeLocations'] });
      queryClient.invalidateQueries({ queryKey: ['myLocationGuidance'] });
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: string; updates: Partial<OfficeLocationData> }) =>
      locationService.updateLocation(data.id, data.updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['officeLocations'] });
      queryClient.invalidateQueries({ queryKey: ['officeLocation', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['myLocationGuidance'] });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => locationService.deleteLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['officeLocations'] });
      queryClient.invalidateQueries({ queryKey: ['myLocationGuidance'] });
    },
  });
}

export function useAssignDesk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { locationId: string; floorNumber: number; deskNumber: string; targetUserId: string }) =>
      locationService.assignDesk(data.locationId, data.floorNumber, data.deskNumber, data.targetUserId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['officeLocations'] });
      queryClient.invalidateQueries({ queryKey: ['officeLocation', variables.locationId] });
      queryClient.invalidateQueries({ queryKey: ['myLocationGuidance'] });
    },
  });
}
