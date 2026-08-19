import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import {
  MapPin,
  Wifi,
  Key,
  Navigation,
  User,
  Building2,
  Layers
} from 'lucide-react';
import {
  useMyLocationGuidance,
  useAssignDesk
} from '../hooks/useLocations';
import { toast } from 'sonner';

export function OfficeMap() {
  const { data: guidance, isLoading: isGuidanceLoading } = useMyLocationGuidance();

  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [selectedDesk, setSelectedDesk] = useState<any>(null);

  const assignDeskMutation = useAssignDesk();
  const [targetUserIdInput, setTargetUserIdInput] = useState('');

  const currentFloors = guidance?.floors || [];
  const currentFloor = currentFloors[activeFloorIndex] || currentFloors[0];

  const handleAssignDesk = () => {
    if (!guidance?.locationId || !selectedDesk || !targetUserIdInput.trim()) {
      toast.error('Please enter a target employee user ID to assign desk.');
      return;
    }

    assignDeskMutation.mutate(
      {
        locationId: guidance.locationId,
        floorNumber: currentFloor.floorNumber,
        deskNumber: selectedDesk.deskNumber,
        targetUserId: targetUserIdInput.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`Desk ${selectedDesk.deskNumber} assigned successfully!`);
          setSelectedDesk(null);
          setTargetUserIdInput('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to assign desk');
        },
      }
    );
  };

  if (isGuidanceLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <MapPin className="h-7 w-7 text-indigo-600" />
          Office Map & Location Experience
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore office floor plans, view assigned seating, access Wi-Fi credentials, and get building directions.
        </p>
      </div>

      {/* Primary Location Guidance Card */}
      {guidance && (
        <Card className="border shadow-sm overflow-hidden bg-gradient-to-br from-indigo-500/5 via-background to-background">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  {guidance.name}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {guidance.address.street}, {guidance.address.city}, {guidance.address.country}
                </CardDescription>
              </div>

              <a
                href={guidance.googleMapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                  <Navigation className="h-3.5 w-3.5 mr-1.5" /> Get Google Maps Directions
                </Button>
              </a>
            </div>
          </CardHeader>

          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
            {/* Wi-Fi Credentials */}
            <div className="p-4 border rounded-lg bg-card space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                <Wifi className="h-4 w-4 text-emerald-500" /> Office Wi-Fi Network
              </div>
              <div>
                <span className="text-muted-foreground">Network (SSID):</span>{' '}
                <span className="font-bold text-foreground">{guidance.accessInfo.wifiSsd || 'Talnova-Office'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Password:</span>{' '}
                <span className="font-mono text-indigo-600 font-bold">{guidance.accessInfo.wifiPassword || 'Welcome2026'}</span>
              </div>
            </div>

            {/* Building Access */}
            <div className="p-4 border rounded-lg bg-card space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                <Key className="h-4 w-4 text-amber-500" /> Building Access Code
              </div>
              <div>
                <span className="text-muted-foreground">Lobby Pass Code:</span>{' '}
                <span className="font-mono text-amber-600 font-bold">{guidance.accessInfo.buildingAccessCode || 'KEY-9876'}</span>
              </div>
              <p className="text-muted-foreground">{guidance.accessInfo.arrivalInstructions}</p>
            </div>

            {/* Assigned Seat / Desk */}
            <div className="p-4 border rounded-lg bg-card space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                <User className="h-4 w-4 text-indigo-600" /> Your Assigned Desk
              </div>
              <div>
                <span className="text-muted-foreground">Floor:</span>{' '}
                <span className="font-bold text-foreground">Floor {guidance.assignedFloorNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Desk #:</span>{' '}
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 font-bold">
                  {guidance.assignedDesk?.deskNumber || '101-A'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interactive Floor Plan & Desk Map */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              Interactive Floor Plan & Desk Map
            </CardTitle>
            <CardDescription>Click desks to view assignments or assign seating for new team members.</CardDescription>
          </div>

          {/* Floor Switcher */}
          <div className="flex gap-2">
            {currentFloors.map((fl, idx) => (
              <Button
                key={fl.floorNumber}
                variant={idx === activeFloorIndex ? 'default' : 'outline'}
                size="sm"
                className={idx === activeFloorIndex ? 'bg-indigo-600 text-white' : ''}
                onClick={() => setActiveFloorIndex(idx)}
              >
                {fl.floorName}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {currentFloor ? (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-muted-foreground">
                Desk Seating Grid — {currentFloor.floorName}:
              </div>

              {/* Desk Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {currentFloor.desks.map((d) => {
                  const isSelected = selectedDesk?.deskNumber === d.deskNumber;
                  return (
                    <div
                      key={d.deskNumber}
                      onClick={() => setSelectedDesk(d)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-500/10 ring-2 ring-indigo-500/20'
                          : d.isAvailable
                          ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40'
                          : 'bg-card border-border hover:border-foreground/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-foreground">{d.deskNumber}</span>
                        <Badge
                          variant="outline"
                          className={
                            d.isAvailable
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                              : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]'
                          }
                        >
                          {d.isAvailable ? 'VACANT' : 'ASSIGNED'}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {d.assignedUserName || d.zone || 'General Desk'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Desk Action Inspector */}
              {selectedDesk && (
                <div className="mt-4 p-4 border rounded-lg bg-muted/10 space-y-3 text-xs">
                  <div className="font-bold text-foreground">
                    Selected Desk: {selectedDesk.deskNumber} ({selectedDesk.zone || 'General Zone'})
                  </div>
                  <div>
                    Status:{' '}
                    <span className="font-semibold text-foreground">
                      {selectedDesk.isAvailable ? 'Available for Assignment' : `Assigned to ${selectedDesk.assignedUserName}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Input
                      placeholder="Enter employee User ID to assign..."
                      value={targetUserIdInput}
                      onChange={(e: any) => setTargetUserIdInput(e.target.value)}
                      className="text-xs max-w-sm"
                    />
                    <Button
                      size="sm"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={handleAssignDesk}
                      disabled={assignDeskMutation.isPending || !targetUserIdInput.trim()}
                    >
                      Assign Seat
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">No floor plans configured for this location yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default OfficeMap;
