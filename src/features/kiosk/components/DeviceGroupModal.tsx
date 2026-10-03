import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Folder,
  Search,
  Tv,
  MapPin,
  Loader2,
  Building2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '../../../components/Dialog';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { Input } from '../../../components/Input';
import { toast } from 'sonner';
import { kioskService } from '../services/kiosk.service';
import { KioskDevice } from '../../../types/kiosk/device.types';
import { KioskDeviceGroup } from '../../../types/kiosk/group.types';

interface DeviceGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: KioskDeviceGroup | null;
  devices: KioskDevice[];
  deviceGroups?: KioskDeviceGroup[];
  onGroupSaved: () => void;
}

export const DeviceGroupModal: React.FC<DeviceGroupModalProps> = ({
  open,
  onOpenChange,
  group,
  devices,
  deviceGroups = [],
  onGroupSaved
}) => {
  const { t } = useTranslation(['kiosk', 'common']);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [siteId, setSiteId] = useState('');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(group && group._id);

  useEffect(() => {
    if (open) {
      if (group) {
        setName(group.name || '');
        setDescription(group.description || '');
        setSiteId(group.siteId || '');
        setSelectedDeviceIds(group.deviceIds || []);
      } else {
        setName('');
        setDescription('');
        setSiteId('');
        setSelectedDeviceIds([]);
      }
      setDeviceSearch('');
    }
  }, [open, group]);

  const handleToggleDevice = (deviceId: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedDeviceIds.length === filteredDevices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(filteredDevices.map((d) => d._id));
    }
  };

  const filteredDevices = devices.filter((d) => {
    if (!deviceSearch.trim()) return true;
    const q = deviceSearch.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.location.toLowerCase().includes(q) ||
      d.deviceId.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t('groups.nameRequired', { defaultValue: 'Group name is required' }));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        siteId: siteId.trim() || undefined,
        deviceIds: selectedDeviceIds
      };

      if (isEditing && group) {
        await kioskService.updateDeviceGroup(group._id, payload);
        toast.success(t('groups.updatedSuccess', { defaultValue: 'Device group updated successfully' }));
      } else {
        await kioskService.createDeviceGroup(payload);
        toast.success(t('groups.createdSuccess', { defaultValue: 'Device group created successfully' }));
      }

      onOpenChange(false);
      onGroupSaved();
    } catch (err: any) {
      console.error('Failed to save device group', err);
      toast.error(err.response?.data?.message || err.message || t('groups.saveFailed', { defaultValue: 'Failed to save device group' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle>
                {isEditing
                  ? t('groups.editTitle', { defaultValue: 'Edit Device Group' })
                  : t('groups.createTitle', { defaultValue: 'Create Device Group' })}
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('groups.subtitle', { defaultValue: 'Group physical terminals across zones or sites to inherit multi-journey assignments.' })}
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('groups.nameLabel', { defaultValue: 'Group Name' })} <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Warehouse A Terminals, North Gate Fleet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {t('groups.siteLabel', { defaultValue: 'Site / Campus Code (Optional)' })}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    className="pl-9"
                    placeholder="e.g. CAMPUS-NORTH, BLDG-4"
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  {t('groups.descriptionLabel', { defaultValue: 'Description (Optional)' })}
                </label>
                <Input
                  placeholder="e.g. Terminals covering heavy machinery zones"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Member Terminals Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-700">
                    {t('groups.membersLabel', { defaultValue: 'Member Terminals' })}
                  </label>
                  <p className="text-[11px] text-slate-500">
                    {t('groups.membersHelp', {
                      defaultValue: `${selectedDeviceIds.length} of ${devices.length} terminals selected`
                    })}
                  </p>
                </div>
                {devices.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                    onClick={handleSelectAll}
                  >
                    {selectedDeviceIds.length === filteredDevices.length
                      ? t('groups.deselectAll', { defaultValue: 'Deselect All' })
                      : t('groups.selectAll', { defaultValue: 'Select All' })}
                  </Button>
                )}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <Input
                  className="pl-8 text-xs h-8"
                  placeholder={t('groups.searchDevicesPlaceholder', { defaultValue: 'Filter terminals by name or location...' })}
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                />
              </div>

              <div className="border border-slate-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                {filteredDevices.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    {devices.length === 0
                      ? t('groups.noDevicesPaired', { defaultValue: 'No paired terminals available. Pair a terminal first.' })
                      : t('groups.noMatchingDevices', { defaultValue: 'No terminals matching filter.' })}
                  </div>
                ) : (
                  filteredDevices.map((dev) => {
                    const isSelected = selectedDeviceIds.includes(dev._id);
                    return (
                      <div
                        key={dev._id}
                        onClick={() => handleToggleDevice(dev._id)}
                        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition hover:bg-indigo-50/40 ${
                          isSelected ? 'bg-indigo-50/60' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Handled by parent div onClick
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="text-xs font-medium text-slate-900 flex items-center space-x-1.5">
                              <Tv className="w-3.5 h-3.5 text-slate-500" />
                              <span>{dev.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{dev.location}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {(() => {
                            const otherGroup = deviceGroups.find((g) => {
                              if (group && g._id === group._id) return false;
                              return (
                                (dev.deviceGroupId && g._id === dev.deviceGroupId) ||
                                (g.deviceIds && g.deviceIds.some((id: any) => (id?._id || id).toString() === dev._id))
                              );
                            });
                            if (!otherGroup) return null;
                            return (
                              <Badge
                                variant="outline"
                                className="text-[9px] text-amber-700 bg-amber-50 border-amber-200 py-0.5 px-1.5 flex items-center space-x-1"
                                title={`Currently in ${otherGroup.name}. Selecting will move to this group.`}
                              >
                                <Folder className="w-2.5 h-2.5 text-amber-600" />
                                <span>{otherGroup.name}</span>
                              </Badge>
                            );
                          })()}
                          <Badge
                            variant={dev.status === 'online' ? 'default' : 'secondary'}
                            className={`text-[10px] capitalize py-0.5 px-1.5 ${
                              dev.status === 'online' ? 'bg-emerald-600 text-white' : ''
                            }`}
                          >
                            {dev.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={saving || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>{t('common:saving', { defaultValue: 'Saving...' })}</span>
                </>
              ) : (
                <span>
                  {isEditing
                    ? t('groups.saveChanges', { defaultValue: 'Save Changes' })
                    : t('groups.createBtn', { defaultValue: 'Create Group' })}
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
