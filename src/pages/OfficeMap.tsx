import { useState, useMemo } from 'react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/Dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '../components/Tabs';
import {
  MapPin,
  Wifi,
  Key,
  Navigation,
  User,
  Building2,
  Layers,
  Search,
  X,
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  ShieldCheck,
  Car
} from 'lucide-react';
import {
  useMyLocationGuidance,
  useLocations,
  useAssignDesk,
  useCreateLocation,
  useUpdateLocation
} from '../hooks/useLocations';
import { useRole } from '../context/RoleContext';
import { toast } from 'sonner';
import { FloorPlanData, DeskData, OfficeLocationData } from '../services/location.service';

export function OfficeMap() {
  const { role } = useRole();
  const isAdminOrOwner = role === 'admin' || role === 'owner' || role === 'super_admin';

  const { data: guidance, isLoading: isGuidanceLoading } = useMyLocationGuidance();
  const { data: allLocations = [], isLoading: isLocationsLoading } = useLocations();

  const assignDeskMutation = useAssignDesk();
  const createLocationMutation = useCreateLocation();
  const updateLocationMutation = useUpdateLocation();

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesk, setSelectedDesk] = useState<any>(null);
  const [targetUserIdInput, setTargetUserIdInput] = useState('');

  // Active location resolution (falls back to guidance if specific selection not set)
  const activeLocation: (OfficeLocationData | any) = useMemo(() => {
    if (selectedLocationId && allLocations.length > 0) {
      const match = allLocations.find((loc) => loc._id === selectedLocationId);
      if (match) return match;
    }
    if (allLocations.length > 0) {
      const primary = allLocations.find((loc) => loc.isPrimary);
      return primary || allLocations[0];
    }
    if (guidance) {
      return {
        _id: guidance.locationId,
        name: guidance.name,
        code: 'HQ',
        address: guidance.address,
        timezone: 'America/Los_Angeles',
        accessInfo: guidance.accessInfo,
        floors: guidance.floors,
        isPrimary: true,
      };
    }
    return null;
  }, [selectedLocationId, allLocations, guidance]);

  const currentFloors: FloorPlanData[] = activeLocation?.floors || guidance?.floors || [];
  const currentFloor = currentFloors[activeFloorIndex] || currentFloors[0];

  // Search filtering
  const { matchedDesk, noMatchingFound } = useMemo(() => {
    if (!currentFloor || !currentFloor.desks) {
      return { matchedDesk: null, noMatchingFound: false };
    }

    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) {
      return { matchedDesk: null, noMatchingFound: false };
    }

    const matches = currentFloor.desks.filter((d) => {
      const nameMatch = d.assignedUserName && d.assignedUserName.toLowerCase().includes(trimmed);
      const deskMatch = d.deskNumber.toLowerCase().includes(trimmed);
      const zoneMatch = d.zone && d.zone.toLowerCase().includes(trimmed);
      return nameMatch || deskMatch || zoneMatch;
    });

    const isMatchFound = matches.length > 0;
    return {
      filteredDesks: matches,
      matchedDesk: isMatchFound ? matches[0] : null,
      noMatchingFound: !isMatchFound,
    };
  }, [currentFloor, searchQuery]);

  // Active desk for popover
  const activePopoverDesk = matchedDesk || selectedDesk;

  // Desk assignment handler
  const handleAssignDesk = () => {
    const locId = activeLocation?._id || guidance?.locationId;
    if (!locId || !activePopoverDesk || !targetUserIdInput.trim()) {
      toast.error('Please enter a target employee user ID to assign desk.');
      return;
    }

    assignDeskMutation.mutate(
      {
        locationId: locId,
        floorNumber: currentFloor.floorNumber,
        deskNumber: activePopoverDesk.deskNumber,
        targetUserId: targetUserIdInput.trim(),
      },
      {
        onSuccess: () => {
          toast.success(`Desk ${activePopoverDesk.deskNumber} assigned successfully!`);
          setSelectedDesk(null);
          setTargetUserIdInput('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to assign desk');
        },
      }
    );
  };

  // -------------------------------------------------------------
  // Admin Map Create/Edit State & Handlers
  // -------------------------------------------------------------
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('edit');
  const [editorTab, setEditorTab] = useState('details');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    wifiSsd: '',
    wifiPassword: '',
    buildingAccessCode: '',
    arrivalInstructions: '',
    parkingInfo: '',
    isPrimary: false,
    floors: [] as FloorPlanData[],
  });

  const [editorFloorIndex, setEditorFloorIndex] = useState(0);
  const [newDeskNumber, setNewDeskNumber] = useState('');
  const [newDeskZone, setNewDeskZone] = useState('');

  const handleOpenEditModal = () => {
    if (!activeLocation) return;
    setEditorMode('edit');
    setEditorTab('details');
    setFormData({
      name: activeLocation.name || '',
      code: activeLocation.code || '',
      street: activeLocation.address?.street || '',
      city: activeLocation.address?.city || '',
      state: activeLocation.address?.state || '',
      zip: activeLocation.address?.zip || '',
      country: activeLocation.address?.country || '',
      wifiSsd: activeLocation.accessInfo?.wifiSsd || '',
      wifiPassword: activeLocation.accessInfo?.wifiPassword || '',
      buildingAccessCode: activeLocation.accessInfo?.buildingAccessCode || '',
      arrivalInstructions: activeLocation.accessInfo?.arrivalInstructions || '',
      parkingInfo: activeLocation.accessInfo?.parkingInfo || '',
      isPrimary: !!activeLocation.isPrimary,
      floors: JSON.parse(JSON.stringify(activeLocation.floors || [])),
    });
    setEditorFloorIndex(0);
    setIsEditorOpen(true);
  };

  const handleOpenCreateModal = () => {
    setEditorMode('create');
    setEditorTab('details');
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    setFormData({
      name: '',
      code: `OFFICE-${randomSuffix}`,
      street: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      wifiSsd: 'Talnova-Guest-5G',
      wifiPassword: 'WelcomeTalnova2026',
      buildingAccessCode: 'PASS-1001',
      arrivalInstructions: 'Check in with security at the main reception desk.',
      parkingInfo: 'Visitor parking available on Level P1.',
      isPrimary: allLocations.length === 0,
      floors: [
        {
          floorNumber: 1,
          floorName: 'Floor 1 — Open Layout',
          desks: [
            { deskNumber: '101-A', zone: 'Engineering', isAvailable: true, x: 370, y: 110 },
            { deskNumber: '101-B', zone: 'Engineering', isAvailable: true, x: 540, y: 110 },
            { deskNumber: '102-A', zone: 'Product', isAvailable: true, x: 370, y: 230 },
            { deskNumber: '102-B', zone: 'Product', isAvailable: true, x: 540, y: 230 },
          ],
        },
      ],
    });
    setEditorFloorIndex(0);
    setIsEditorOpen(true);
  };

  const handleAddFloor = () => {
    const nextNum = formData.floors.length > 0 ? Math.max(...formData.floors.map((f) => f.floorNumber)) + 1 : 1;
    const newFloor: FloorPlanData = {
      floorNumber: nextNum,
      floorName: `Floor ${nextNum} — Collaborative Workspace`,
      desks: [
        { deskNumber: `${nextNum}01-A`, zone: 'General', isAvailable: true, x: 370, y: 110 },
        { deskNumber: `${nextNum}01-B`, zone: 'General', isAvailable: true, x: 540, y: 110 },
      ],
    };
    setFormData((prev) => ({
      ...prev,
      floors: [...prev.floors, newFloor],
    }));
    setEditorFloorIndex(formData.floors.length);
    toast.success(`Floor ${nextNum} added to configuration.`);
  };

  const handleRemoveFloor = (index: number) => {
    if (formData.floors.length <= 1) {
      toast.error('An office location must have at least one floor plan.');
      return;
    }
    const updated = formData.floors.filter((_, idx) => idx !== index);
    setFormData((prev) => ({ ...prev, floors: updated }));
    setEditorFloorIndex(Math.max(0, index - 1));
  };

  const handleAddDeskToFloor = () => {
    if (!newDeskNumber.trim()) {
      toast.error('Please specify a desk number (e.g. 201-A).');
      return;
    }
    const targetFloor = formData.floors[editorFloorIndex];
    if (!targetFloor) return;

    if (targetFloor.desks.some((d) => d.deskNumber.toLowerCase() === newDeskNumber.trim().toLowerCase())) {
      toast.error(`Desk "${newDeskNumber.trim()}" already exists on this floor.`);
      return;
    }

    const currentDeskCount = targetFloor.desks.length;
    const defaultX = currentDeskCount % 2 === 0 ? 370 : 540;
    const defaultY = 110 + Math.floor(currentDeskCount / 2) * 120;

    const newDesk: DeskData = {
      deskNumber: newDeskNumber.trim().toUpperCase(),
      zone: newDeskZone.trim() || 'General Workspace',
      isAvailable: true,
      x: defaultX,
      y: defaultY,
    };

    const updatedFloors = [...formData.floors];
    updatedFloors[editorFloorIndex] = {
      ...targetFloor,
      desks: [...targetFloor.desks, newDesk],
    };

    setFormData((prev) => ({ ...prev, floors: updatedFloors }));
    setNewDeskNumber('');
    setNewDeskZone('');
    toast.success(`Desk ${newDesk.deskNumber} added to ${targetFloor.floorName}.`);
  };

  const handleRemoveDeskFromFloor = (deskNumber: string) => {
    const targetFloor = formData.floors[editorFloorIndex];
    if (!targetFloor) return;
    const updatedFloors = [...formData.floors];
    updatedFloors[editorFloorIndex] = {
      ...targetFloor,
      desks: targetFloor.desks.filter((d) => d.deskNumber !== deskNumber),
    };
    setFormData((prev) => ({ ...prev, floors: updatedFloors }));
  };

  const handleSaveLocation = async () => {
    if (!formData.name.trim()) {
      toast.error('Please provide an office facility name.');
      return;
    }
    if (!formData.street.trim() || !formData.city.trim() || !formData.country.trim()) {
      toast.error('Please complete street, city, and country address fields.');
      return;
    }
    if (formData.floors.length === 0) {
      toast.error('At least one floor layout is required.');
      return;
    }

    const payload: Partial<OfficeLocationData> = {
      name: formData.name.trim(),
      code: formData.code.trim() || `HQ-${Date.now().toString().slice(-4)}`,
      address: {
        street: formData.street.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        zip: formData.zip.trim(),
        country: formData.country.trim(),
      },
      accessInfo: {
        wifiSsd: formData.wifiSsd.trim(),
        wifiPassword: formData.wifiPassword.trim(),
        buildingAccessCode: formData.buildingAccessCode.trim(),
        arrivalInstructions: formData.arrivalInstructions.trim(),
        parkingInfo: formData.parkingInfo.trim(),
      },
      floors: formData.floors,
      isPrimary: formData.isPrimary,
    };

    try {
      if (editorMode === 'edit') {
        if (!activeLocation?._id) return;
        await updateLocationMutation.mutateAsync({
          id: activeLocation._id,
          updates: payload,
        });
        toast.success(`Office map "${payload.name}" updated successfully!`);
      } else {
        const created = await createLocationMutation.mutateAsync(payload);
        toast.success(`New office map "${created.name}" created successfully!`);
        setSelectedLocationId(created._id);
      }
      setIsEditorOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save office map.');
    }
  };

  if (isGuidanceLoading || isLocationsLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const directionsUrl =
    activeLocation?.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          `${activeLocation.address.street}, ${activeLocation.address.city}, ${activeLocation.address.country}`
        )}`
      : guidance?.googleMapsDirectionsUrl || '#';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1
            data-testid="office-map-header"
            className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2"
          >
            <MapPin className="h-7 w-7 text-indigo-600" />
            Office Map & Location Experience
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Explore interactive floor layouts, search for teammates' desks, locate conference rooms, and view Wi-Fi credentials.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Multi-Location Switcher */}
          {allLocations.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Office:</span>
              <select
                data-testid="location-selector"
                aria-label="Select Office Location"
                value={activeLocation?._id || ''}
                onChange={(e) => {
                  setSelectedLocationId(e.target.value);
                  setActiveFloorIndex(0);
                  setSelectedDesk(null);
                }}
                className="h-9 px-3 py-1 bg-background border border-input rounded-md text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {allLocations.map((loc) => (
                  <option key={loc._id} value={loc._id}>
                    {loc.name} {loc.isPrimary ? '(Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Floor Selector Dropdown */}
          {currentFloors.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Floor:</span>
              <select
                data-testid="floor-selector"
                aria-label="Select Floor"
                value={activeFloorIndex}
                onChange={(e) => {
                  setActiveFloorIndex(Number(e.target.value));
                  setSelectedDesk(null);
                }}
                className="h-9 px-3 py-1 bg-background border border-input rounded-md text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                {currentFloors.map((fl, idx) => (
                  <option key={fl.floorNumber} value={idx}>
                    {fl.floorName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Admin & Owner Actions */}
          {isAdminOrOwner && (
            <div data-testid="admin-map-actions" className="flex items-center gap-2">
              <Button
                data-testid="edit-map-btn"
                variant="outline"
                size="sm"
                onClick={handleOpenEditModal}
                className="h-9 text-xs font-semibold border-indigo-200 hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit Office Map
              </Button>

              <Button
                data-testid="create-map-btn"
                size="sm"
                onClick={handleOpenCreateModal}
                className="h-9 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create New Map
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Location Guidance Card */}
      {activeLocation && (
        <Card data-testid="guidance-summary-card" className="border shadow-sm overflow-hidden bg-gradient-to-br from-indigo-500/5 via-background to-background">
          <CardHeader className="border-b pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  {activeLocation.name}
                  {activeLocation.isPrimary && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                      PRIMARY CAMPUS
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-0.5">
                  {activeLocation.address?.street}, {activeLocation.address?.city}, {activeLocation.address?.country}
                </CardDescription>
              </div>

              <a
                href={directionsUrl}
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
            <div data-testid="wifi-card" className="p-4 border rounded-lg bg-card space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                <Wifi className="h-4 w-4 text-emerald-500" /> Office Wi-Fi Network
              </div>
              <div>
                <span className="text-muted-foreground">Network (SSID):</span>{' '}
                <span className="font-bold text-foreground">{activeLocation.accessInfo?.wifiSsd || 'Talnova-Secure-5G'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Password:</span>{' '}
                <span className="font-mono text-indigo-600 font-bold">{activeLocation.accessInfo?.wifiPassword || 'Welcome2026'}</span>
              </div>
            </div>

            {/* Building Access */}
            <div data-testid="access-code-card" className="p-4 border rounded-lg bg-card space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                <Key className="h-4 w-4 text-amber-500" /> Building Access Code
              </div>
              <div>
                <span className="text-muted-foreground">Lobby Pass Code:</span>{' '}
                <span className="font-mono text-amber-600 font-bold">{activeLocation.accessInfo?.buildingAccessCode || 'KEY-5004'}</span>
              </div>
              <p className="text-muted-foreground">{activeLocation.accessInfo?.arrivalInstructions}</p>
            </div>

            {/* Assigned Seat / Desk */}
            <div data-testid="assigned-desk-card" className="p-4 border rounded-lg bg-card space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
                <User className="h-4 w-4 text-indigo-600" /> Your Assigned Desk
              </div>
              <div>
                <span className="text-muted-foreground">Floor:</span>{' '}
                <span className="font-bold text-foreground">Floor {guidance?.assignedFloorNumber || currentFloor?.floorNumber || 1}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Desk #:</span>{' '}
                <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 font-bold">
                  {guidance?.assignedDesk?.deskNumber || '101-A'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interactive Floor Plan & Desk Map */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-5 w-5 text-indigo-600" />
                Interactive Workplace Map — {currentFloor?.floorName || 'Main Floor'}
              </CardTitle>
              <CardDescription>
                Search for teammates, locate desks, meeting rooms, and amenities on this floor.
              </CardDescription>
            </div>

            {/* Teammate Search Input */}
            <div className="w-full md:w-80 relative">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                data-testid="map-search-input"
                type="text"
                placeholder="Search teammate desk (e.g. Sarah, Michael)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 text-xs h-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Search Result Feedback */}
          {noMatchingFound && (
            <div
              data-testid="no-matching-members"
              className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-lg text-xs flex items-center gap-2 font-medium"
            >
              ⚠️ No matching team members found on this floor
            </div>
          )}

          {matchedDesk && (
            <div
              data-testid="search-match-alert"
              className="p-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-800 dark:text-indigo-300 rounded-lg text-xs flex items-center justify-between font-medium"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-600" />
                Found teammate: <strong>{matchedDesk.assignedUserName}</strong> at Desk <strong>{matchedDesk.deskNumber}</strong> ({matchedDesk.zone})
              </span>
              <span className="text-[11px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold">MATCH HIGHLIGHTED</span>
            </div>
          )}

          {/* Interactive SVG Floor Plan */}
          <div className="relative overflow-hidden rounded-xl border border-border bg-slate-950/5 dark:bg-slate-900/30 p-2">
            <svg
              data-testid="office-floor-plan-svg"
              viewBox="0 0 920 520"
              className="w-full h-auto select-none"
            >
              {/* Outer Perimeter Walls */}
              <rect
                x="20"
                y="20"
                width="880"
                height="480"
                rx="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-slate-400 dark:text-slate-600"
              />

              {/* Floor Plan Grid Lines */}
              <defs>
                <pattern id="floor-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.4" className="text-slate-300/40 dark:text-slate-700/30" />
                </pattern>
              </defs>
              <rect x="22" y="22" width="876" height="476" rx="14" fill="url(#floor-grid-pattern)" />

              {/* 1. Left Wing: Conference Rooms */}
              {/* Conference Room Alpha */}
              <g data-testid="room-conference-alpha">
                <rect
                  x="40"
                  y="40"
                  width="220"
                  height="140"
                  rx="10"
                  fill="rgba(99, 102, 241, 0.08)"
                  stroke="rgba(99, 102, 241, 0.4)"
                  strokeWidth="2"
                />
                <rect x="75" y="80" width="150" height="50" rx="18" fill="rgba(99, 102, 241, 0.16)" stroke="rgba(99, 102, 241, 0.5)" />
                <circle cx="65" cy="105" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <circle cx="235" cy="105" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <circle cx="110" cy="70" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <circle cx="150" cy="70" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <circle cx="190" cy="70" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <circle cx="110" cy="140" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <circle cx="150" cy="140" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <circle cx="190" cy="140" r="7" fill="rgba(99, 102, 241, 0.4)" />
                <text x="150" y="65" textAnchor="middle" className="text-[12px] font-bold fill-indigo-600 dark:fill-indigo-400">
                  Conference Room Alpha
                </text>
                <text x="150" y="110" textAnchor="middle" className="text-[10px] font-medium fill-slate-500 dark:fill-slate-400">
                  12 Seats • 4K Display
                </text>
              </g>

              {/* Apollo Meeting Room */}
              <g data-testid="room-apollo">
                <rect
                  x="40"
                  y="200"
                  width="220"
                  height="140"
                  rx="10"
                  fill="rgba(59, 130, 246, 0.08)"
                  stroke="rgba(59, 130, 246, 0.4)"
                  strokeWidth="2"
                />
                <rect x="80" y="240" width="140" height="50" rx="12" fill="rgba(59, 130, 246, 0.16)" stroke="rgba(59, 130, 246, 0.5)" />
                <circle cx="70" cy="265" r="7" fill="rgba(59, 130, 246, 0.4)" />
                <circle cx="230" cy="265" r="7" fill="rgba(59, 130, 246, 0.4)" />
                <circle cx="115" cy="230" r="7" fill="rgba(59, 130, 246, 0.4)" />
                <circle cx="185" cy="230" r="7" fill="rgba(59, 130, 246, 0.4)" />
                <circle cx="115" cy="300" r="7" fill="rgba(59, 130, 246, 0.4)" />
                <circle cx="185" cy="300" r="7" fill="rgba(59, 130, 246, 0.4)" />
                <text x="150" y="225" textAnchor="middle" className="text-[12px] font-bold fill-blue-600 dark:fill-blue-400">
                  Apollo Meeting Room
                </text>
                <text x="150" y="270" textAnchor="middle" className="text-[10px] font-medium fill-slate-500 dark:fill-slate-400">
                  8 Seats • Digital Whiteboard
                </text>
              </g>

              {/* Phone & Quiet Pods */}
              <g data-testid="room-quiet-pods">
                <rect
                  x="40"
                  y="360"
                  width="105"
                  height="120"
                  rx="8"
                  fill="rgba(147, 51, 234, 0.08)"
                  stroke="rgba(147, 51, 234, 0.3)"
                  strokeWidth="1.5"
                />
                <text x="92" y="425" textAnchor="middle" className="text-[11px] font-bold fill-purple-600">Quiet Pod A</text>
                <rect
                  x="155"
                  y="360"
                  width="105"
                  height="120"
                  rx="8"
                  fill="rgba(147, 51, 234, 0.08)"
                  stroke="rgba(147, 51, 234, 0.3)"
                  strokeWidth="1.5"
                />
                <text x="207" y="425" textAnchor="middle" className="text-[11px] font-bold fill-purple-600">Quiet Pod B</text>
              </g>

              {/* 2. Right Wing: Kitchen & Amenities */}
              {/* Kitchen & Coffee Bar */}
              <g data-testid="room-kitchen">
                <rect
                  x="660"
                  y="40"
                  width="220"
                  height="160"
                  rx="10"
                  fill="rgba(245, 158, 11, 0.08)"
                  stroke="rgba(245, 158, 11, 0.4)"
                  strokeWidth="2"
                />
                <rect x="680" y="65" width="180" height="35" rx="6" fill="rgba(245, 158, 11, 0.2)" stroke="rgba(245, 158, 11, 0.5)" />
                <text x="770" y="60" textAnchor="middle" className="text-[12px] font-bold fill-amber-600 dark:fill-amber-400">
                  ☕ Kitchen & Coffee Bar
                </text>
                <text x="770" y="87" textAnchor="middle" className="text-[10px] font-semibold fill-amber-700 dark:fill-amber-300">
                  Espresso Bar & Dining Island
                </text>
                <text x="770" y="140" textAnchor="middle" className="text-[10px] fill-slate-500 dark:fill-slate-400">
                  Snacks • Microwaves • Sparkling Water
                </text>
              </g>

              {/* Restrooms & Wellness */}
              <g data-testid="room-restrooms">
                <rect
                  x="660"
                  y="220"
                  width="220"
                  height="130"
                  rx="10"
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="rgba(16, 185, 129, 0.4)"
                  strokeWidth="2"
                />
                <text x="770" y="275" textAnchor="middle" className="text-[12px] font-bold fill-emerald-600 dark:fill-emerald-400">
                  Restrooms & Wellness
                </text>
                <text x="770" y="305" textAnchor="middle" className="text-[10px] fill-slate-500 dark:fill-slate-400">
                  Accessible • First Aid Station
                </text>
              </g>

              {/* Emergency Exit */}
              <g data-testid="emergency-exit">
                <rect
                  x="850"
                  y="370"
                  width="30" height="110"
                  rx="6"
                  fill="rgba(239, 68, 68, 0.15)"
                  stroke="rgba(239, 68, 68, 0.6)"
                  strokeWidth="2"
                />
                <text x="865" y="430" textAnchor="middle" transform="rotate(-90 865 430)" className="text-[11px] font-bold fill-red-600">
                  EMERGENCY EXIT
                </text>
              </g>

              {/* 3. Central Open Office Workstations & Desks */}
              {currentFloor?.desks?.map((desk, idx) => {
                // Coordinate positioning
                const defaultX = (idx % 2 === 0 ? 370 : 540);
                const defaultY = 110 + Math.floor(idx / 2) * 120;
                const posX = desk.x || defaultX;
                const posY = desk.y || defaultY;

                const isHighlighted = matchedDesk?.deskNumber === desk.deskNumber;
                const isSelected = selectedDesk?.deskNumber === desk.deskNumber;
                const isTarget = isHighlighted || isSelected;

                return (
                  <g
                    key={desk.deskNumber}
                    data-testid={`desk-pin-${desk.deskNumber}`}
                    onClick={() => setSelectedDesk(desk)}
                    className="cursor-pointer transition-all duration-200"
                  >
                    {/* Glowing highlight ring if searched or selected */}
                    {isTarget && (
                      <circle
                        cx={posX}
                        cy={posY}
                        r="38"
                        fill="rgba(245, 158, 11, 0.25)"
                        stroke="rgb(245, 158, 11)"
                        strokeWidth="3"
                        className="animate-pulse"
                      />
                    )}

                    {/* Desk Surface Furniture */}
                    <rect
                      x={posX - 46}
                      y={posY - 26}
                      width="92"
                      height="52"
                      rx="8"
                      fill={isTarget ? "rgba(99, 102, 241, 0.15)" : "rgba(241, 245, 249, 0.8)"}
                      stroke={isTarget ? "rgb(99, 102, 241)" : "rgba(203, 213, 225, 0.8)"}
                      strokeWidth={isTarget ? "2.5" : "1.5"}
                      className="dark:fill-slate-800/80 dark:stroke-slate-700"
                    />

                    {/* Dual Monitors on Desk */}
                    <rect
                      x={posX - 22}
                      y={posY - 20}
                      width="44"
                      height="6"
                      rx="2"
                      fill="currentColor"
                      className="text-slate-600 dark:text-slate-400"
                    />

                    {/* Ergonomic Office Chair */}
                    <circle
                      cx={posX}
                      cy={posY + 16}
                      r="10"
                      fill="currentColor"
                      className="text-slate-400/80 dark:text-slate-600"
                    />

                    {/* Desk Pin Badge Marker */}
                    <circle
                      cx={posX}
                      cy={posY - 3}
                      r="15"
                      fill={
                        isTarget
                          ? "rgb(245, 158, 11)"
                          : desk.isAvailable
                          ? "rgb(16, 185, 129)"
                          : "rgb(99, 102, 241)"
                      }
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />

                    {/* Desk Number inside Pin Badge */}
                    <text
                      x={posX}
                      y={posY + 1}
                      textAnchor="middle"
                      className="text-[9px] font-extrabold fill-white select-none pointer-events-none"
                    >
                      {desk.deskNumber}
                    </text>

                    {/* Teammate Occupant Name Label */}
                    <text
                      x={posX}
                      y={posY + 38}
                      textAnchor="middle"
                      className={`text-[10px] font-bold select-none pointer-events-none ${
                        isTarget
                          ? "fill-indigo-600 dark:fill-indigo-400 font-extrabold"
                          : "fill-slate-700 dark:fill-slate-200"
                      }`}
                    >
                      {desk.assignedUserName ? desk.assignedUserName.split(' ')[0] : 'Vacant'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Person Card Popover (Active / Matching Teammate) */}
          {activePopoverDesk && (
            <div
              data-testid="person-card-popover"
              className="p-5 bg-card border-2 border-indigo-500/40 rounded-xl shadow-lg space-y-4 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-extrabold text-base shadow-md">
                    {activePopoverDesk.assignedUserName
                      ? activePopoverDesk.assignedUserName
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .slice(0, 2)
                      : 'D'}
                  </div>
                  <div>
                    <div data-testid="popover-person-name" className="font-bold text-base text-foreground flex items-center gap-2">
                      {activePopoverDesk.assignedUserName || `Desk ${activePopoverDesk.deskNumber}`}
                      <Badge
                        variant="outline"
                        className={
                          activePopoverDesk.isAvailable
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs'
                            : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-xs'
                        }
                      >
                        {activePopoverDesk.isAvailable ? 'AVAILABLE' : 'OCCUPIED'}
                      </Badge>
                    </div>
                    <div data-testid="popover-person-dept" className="text-xs text-muted-foreground mt-0.5">
                      {activePopoverDesk.zone || 'Workstation Area'} • {currentFloor?.floorName}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDesk(null);
                    setSearchQuery('');
                  }}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-3 border-t border-border/60">
                <div className="p-2.5 bg-muted/20 rounded-md">
                  <span className="text-muted-foreground block text-[11px]">Assigned Desk:</span>
                  <span data-testid="popover-person-desk" className="font-bold text-foreground text-sm">
                    {activePopoverDesk.deskNumber}
                  </span>
                </div>

                <div className="p-2.5 bg-muted/20 rounded-md">
                  <span className="text-muted-foreground block text-[11px]">Floor Level:</span>
                  <span data-testid="popover-person-floor" className="font-bold text-foreground text-sm">
                    Floor {currentFloor?.floorNumber}
                  </span>
                </div>

                <div className="p-2.5 bg-muted/20 rounded-md">
                  <span className="text-muted-foreground block text-[11px]">Zone / Department:</span>
                  <span className="font-bold text-foreground text-sm">
                    {activePopoverDesk.zone || 'Open Plan'}
                  </span>
                </div>
              </div>

              {/* Desk Re-assignment Controls */}
              <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Re-assign this workstation to another team member:
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    placeholder="Target User ID..."
                    value={targetUserIdInput}
                    onChange={(e: any) => setTargetUserIdInput(e.target.value)}
                    className="text-xs max-w-[200px] h-8"
                  />
                  <Button
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                    onClick={handleAssignDesk}
                    disabled={assignDeskMutation.isPending || !targetUserIdInput.trim()}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------------------
          Create / Edit Office Map Modal (Admins & Owners)
          ------------------------------------------------------------- */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent
          data-testid="map-editor-modal"
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-600">
              {editorMode === 'edit' ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editorMode === 'edit' ? `Edit Office Map — ${formData.name || 'Location'}` : 'Create New Office Location & Map'}
            </DialogTitle>
            <DialogDescription>
              {editorMode === 'edit'
                ? 'Update office details, access credentials, and manage floor plan layouts & desks.'
                : 'Configure facility profile, Wi-Fi credentials, and define initial floor plans and workstations.'}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={editorTab} onValueChange={setEditorTab} className="mt-4">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="details">Facility Details</TabsTrigger>
              <TabsTrigger value="access">Access & Wi-Fi</TabsTrigger>
              <TabsTrigger value="floors">Floors & Desks</TabsTrigger>
            </TabsList>

            {/* Tab 1: Facility Details */}
            <TabsContent value="details" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Facility Name *</label>
                  <Input
                    data-testid="edit-office-name-input"
                    placeholder="e.g. San Francisco Innovation Hub"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Location Code *</label>
                  <Input
                    data-testid="edit-office-code-input"
                    placeholder="e.g. SF-HQ-01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Street Address *</label>
                <Input
                  data-testid="edit-street-input"
                  placeholder="e.g. 500 Howard Street, Suite 400"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">City *</label>
                  <Input
                    data-testid="edit-city-input"
                    placeholder="San Francisco"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">State / Province</label>
                  <Input
                    placeholder="CA"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Postal / Zip Code</label>
                  <Input
                    placeholder="94105"
                    value={formData.zip}
                    onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Country *</label>
                  <Input
                    placeholder="USA"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrimaryCheckbox"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                />
                <label htmlFor="isPrimaryCheckbox" className="text-xs font-medium cursor-pointer">
                  Set as Primary Headquarters / Default Office Location
                </label>
              </div>
            </TabsContent>

            {/* Tab 2: Access & Wi-Fi */}
            <TabsContent value="access" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5 text-emerald-500" /> Wi-Fi Network Name (SSID)
                  </label>
                  <Input
                    data-testid="edit-wifi-ssd-input"
                    placeholder="e.g. Talnova-Secure-5G"
                    value={formData.wifiSsd}
                    onChange={(e) => setFormData({ ...formData, wifiSsd: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-indigo-500" /> Wi-Fi Password
                  </label>
                  <Input
                    data-testid="edit-wifi-pass-input"
                    placeholder="e.g. WelcomeTalnova2026!"
                    value={formData.wifiPassword}
                    onChange={(e) => setFormData({ ...formData, wifiPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> Building Access Code / Lobby PIN
                </label>
                <Input
                  data-testid="edit-access-code-input"
                  placeholder="e.g. KEY-5004"
                  value={formData.buildingAccessCode}
                  onChange={(e) => setFormData({ ...formData, buildingAccessCode: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Arrival Instructions</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g. Check in with security at the main lobby desk on Floor 1. Bring photo ID."
                  value={formData.arrivalInstructions}
                  onChange={(e) => setFormData({ ...formData, arrivalInstructions: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 text-blue-500" /> Parking Information
                </label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  placeholder="e.g. Underground parking garage entry located on 5th Street. Validate ticket with lobby security."
                  value={formData.parkingInfo}
                  onChange={(e) => setFormData({ ...formData, parkingInfo: e.target.value })}
                />
              </div>
            </TabsContent>

            {/* Tab 3: Floors & Desks Layout */}
            <TabsContent value="floors" className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-600" /> Configured Floors ({formData.floors.length})
                </div>

                <Button
                  data-testid="add-floor-btn"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddFloor}
                  className="text-xs h-8 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Floor
                </Button>
              </div>

              {/* Floor Tabs / Selector */}
              <div className="flex flex-wrap gap-2">
                {formData.floors.map((fl, idx) => (
                  <button
                    key={fl.floorNumber}
                    type="button"
                    onClick={() => setEditorFloorIndex(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-2 transition-colors ${
                      editorFloorIndex === idx
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-muted/40 hover:bg-muted text-foreground border-border'
                    }`}
                  >
                    Floor {fl.floorNumber}
                    {formData.floors.length > 1 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFloor(idx);
                        }}
                        className="hover:text-red-300 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Current Floor Configuration */}
              {formData.floors[editorFloorIndex] && (
                <div className="p-4 border rounded-lg bg-card space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Floor Name</label>
                    <Input
                      value={formData.floors[editorFloorIndex].floorName}
                      onChange={(e) => {
                        const updated = [...formData.floors];
                        updated[editorFloorIndex].floorName = e.target.value;
                        setFormData({ ...formData, floors: updated });
                      }}
                      placeholder="e.g. Floor 2 — Engineering & Product"
                      className="text-xs"
                    />
                  </div>

                  {/* Add Desk Form */}
                  <div className="p-3 border rounded-md bg-muted/20 space-y-2">
                    <div className="text-xs font-semibold text-foreground">Add Workstation / Desk to Floor</div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <Input
                        data-testid="new-desk-input"
                        placeholder="Desk Number (e.g. 201-A)"
                        value={newDeskNumber}
                        onChange={(e) => setNewDeskNumber(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Input
                        data-testid="new-zone-input"
                        placeholder="Zone / Department (e.g. DevOps)"
                        value={newDeskZone}
                        onChange={(e) => setNewDeskZone(e.target.value)}
                        className="text-xs h-8"
                      />
                      <Button
                        data-testid="add-desk-btn"
                        type="button"
                        size="sm"
                        onClick={handleAddDeskToFloor}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 shrink-0 w-full sm:w-auto"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Desk
                      </Button>
                    </div>
                  </div>

                  {/* Desks List Table */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Desks on this floor ({formData.floors[editorFloorIndex].desks.length}):
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-md divide-y text-xs">
                      {formData.floors[editorFloorIndex].desks.length === 0 ? (
                        <div className="p-3 text-center text-muted-foreground">
                          No desks added yet. Use the form above to add desks.
                        </div>
                      ) : (
                        formData.floors[editorFloorIndex].desks.map((d) => (
                          <div
                            key={d.deskNumber}
                            className="p-2.5 flex items-center justify-between hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-bold text-indigo-600 bg-indigo-50/50">
                                {d.deskNumber}
                              </Badge>
                              <span className="font-medium text-foreground">{d.zone || 'Workstation'}</span>
                              <span className="text-[11px] text-muted-foreground">
                                {d.assignedUserName ? `(Occupied: ${d.assignedUserName})` : '(Available)'}
                              </span>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveDeskFromFloor(d.deskNumber)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              data-testid="cancel-map-btn"
              variant="outline"
              type="button"
              onClick={() => setIsEditorOpen(false)}
            >
              Cancel
            </Button>
            <Button
              data-testid="save-map-btn"
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSaveLocation}
              disabled={createLocationMutation.isPending || updateLocationMutation.isPending}
            >
              {createLocationMutation.isPending || updateLocationMutation.isPending
                ? 'Saving...'
                : editorMode === 'edit'
                ? 'Save Changes'
                : 'Create Office Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OfficeMap;
