import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Layers,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  Tv,
  Loader2,
  ShieldCheck
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
import { KioskJourney } from '../../../types/kiosk/journey.types';

export interface AssignedJourneyItem {
  journeyId: string;
  title: string;
  priority: number;
  isMandatory: boolean;
  scheduling?: {
    enabled: boolean;
    startDate?: string;
    endDate?: string;
    daysOfWeek?: number[];
  };
}

interface DeviceAssignmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: KioskDevice | null;
  group?: KioskDeviceGroup | null;
  journeys: KioskJourney[];
  onAssignmentsUpdated?: () => void;
}

export const DeviceAssignmentModal: React.FC<DeviceAssignmentModalProps> = ({
  open,
  onOpenChange,
  device,
  group,
  journeys,
  onAssignmentsUpdated
}) => {
  const { t } = useTranslation(['kiosk', 'common']);
  const [assignedItems, setAssignedItems] = useState<AssignedJourneyItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch current assignments whenever modal opens or target changes
  useEffect(() => {
    if (!open || (!device && !group)) {
      setAssignedItems([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchPromise = group
      ? kioskService.getGroupAssignments(group._id)
      : device
      ? kioskService.getDeviceAssignments(device._id)
      : Promise.resolve([]);

    fetchPromise
      .then((records) => {
        if (!isMounted) return;
        if (records && records.length > 0) {
          const mapped: AssignedJourneyItem[] = records.map((rec: any, idx: number) => {
            const jId = (rec.journeyId?._id || rec.journeyId || '').toString();
            const matchingJourney = journeys.find((j) => j._id === jId);
            return {
              journeyId: jId,
              title: matchingJourney?.title || rec.journeyTitle || rec.title || `Journey #${idx + 1}`,
              priority: typeof rec.priority === 'number' ? rec.priority : idx,
              isMandatory: !!rec.isMandatory,
              scheduling: rec.scheduling
            };
          });
          // Sort by priority ascending
          mapped.sort((a, b) => a.priority - b.priority);
          setAssignedItems(mapped);
        } else if (device?.currentJourneyId) {
          // Backward compatibility fallback to single currentJourneyId
          const matching = journeys.find((j) => j._id === device.currentJourneyId);
          if (matching) {
            setAssignedItems([
              {
                journeyId: matching._id,
                title: matching.title,
                priority: 0,
                isMandatory: false
              }
            ]);
          } else {
            setAssignedItems([]);
          }
        } else {
          setAssignedItems([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load assignments', err);
        toast.error(t('assignments.failedToLoad', { defaultValue: 'Failed to load existing assignments' }));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, device, group, journeys, t]);

  // Available journeys are published journeys not yet assigned
  const assignedIds = new Set(assignedItems.map((item) => item.journeyId));
  const availableJourneys = journeys.filter(
    (j) => !assignedIds.has(j._id) && j.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddJourney = (journey: KioskJourney) => {
    setAssignedItems((prev) => [
      ...prev,
      {
        journeyId: journey._id,
        title: journey.title,
        priority: prev.length,
        isMandatory: false
      }
    ]);
  };

  const handleRemoveJourney = (journeyId: string) => {
    setAssignedItems((prev) =>
      prev
        .filter((item) => item.journeyId !== journeyId)
        .map((item, idx) => ({ ...item, priority: idx }))
    );
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    setAssignedItems((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy.map((item, idx) => ({ ...item, priority: idx }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= assignedItems.length - 1) return;
    setAssignedItems((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy.map((item, idx) => ({ ...item, priority: idx }));
    });
  };

  const handleToggleMandatory = (journeyId: string) => {
    setAssignedItems((prev) =>
      prev.map((item) =>
        item.journeyId === journeyId ? { ...item, isMandatory: !item.isMandatory } : item
      )
    );
  };

  const handleSaveAssignments = async () => {
    if (!device && !group) return;
    setSaving(true);
    try {
      const payload = assignedItems.map((item, index) => ({
        journeyId: item.journeyId,
        priority: index,
        isMandatory: item.isMandatory,
        scheduling: item.scheduling || { enabled: false }
      }));

      const targetName = group ? group.name : (device ? device.name : 'Target');
      if (group) {
        await kioskService.setGroupAssignments(group._id, { assignments: payload });
      } else if (device) {
        await kioskService.setDeviceAssignments(device._id, payload);
      }

      toast.success(
        t('assignments.saveSuccess', {
          count: assignedItems.length,
          name: targetName,
          defaultValue: `Successfully assigned ${assignedItems.length} journey(s) to ${targetName}`
        })
      );
      onAssignmentsUpdated?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to save assignments', err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          t('assignments.saveError', { defaultValue: 'Failed to update assignments' })
      );
    } finally {
      setSaving(false);
    }
  };

  const getPriorityLabel = (index: number) => {
    const num = index + 1;
    if (num === 1) return '1st';
    if (num === 2) return '2nd';
    if (num === 3) return '3rd';
    return `${num}th`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden p-0"
        data-testid="device-assignment-modal"
      >
        <DialogHeader className="p-6 bg-slate-50/80 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {group
                    ? t('assignments.groupModalTitle', { defaultValue: 'Device Group Multi-Journey Assignments' })
                    : t('assignments.modalTitle', { defaultValue: 'Multi-Journey Assignments' })}
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">
                    {group ? group.name : device?.name}
                  </span>
                  {group ? (
                    group.siteId
                      ? ` • Site: ${group.siteId} (${group.deviceIds.length} Terminals)`
                      : ` • (${group.deviceIds.length} Terminals)`
                  ) : (
                    <>
                      {device?.location && ` • ${device.location}`}
                      <span className="font-mono text-[10px] text-slate-400 ml-2">({device?.deviceId})</span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50/50">
              {assignedItems.length}{' '}
              {assignedItems.length === 1
                ? t('assignments.singularCount', { defaultValue: 'Journey Assigned' })
                : t('assignments.pluralCount', { defaultValue: 'Journeys Assigned' })}
            </Badge>
          </div>
        </DialogHeader>

        <DialogBody className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">
                {t('assignments.loading', { defaultValue: 'Loading assignments...' })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN: Available Journeys */}
              <div className="flex flex-col h-[400px] border border-slate-200 rounded-xl bg-slate-50/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                    <span>{t('assignments.availableJourneys', { defaultValue: 'Available Journeys' })}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({availableJourneys.length})</span>
                  </h3>
                </div>

                {/* Search bar */}
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('assignments.searchPlaceholder', { defaultValue: 'Filter journeys...' })}
                    className="pl-8 text-xs h-8 bg-white"
                  />
                </div>

                {/* Journey list */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {availableJourneys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-4">
                      <CheckCircle2 className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-medium text-slate-600">
                        {searchQuery
                          ? t('assignments.noSearchResults', { defaultValue: 'No journeys match filter' })
                          : t('assignments.allAssigned', { defaultValue: 'All available journeys are assigned' })}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {t('assignments.allAssignedSubtitle', { defaultValue: 'Manage execution priority on the right.' })}
                      </p>
                    </div>
                  ) : (
                    availableJourneys.map((journey) => (
                      <div
                        key={journey._id}
                        className="group flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:shadow-xs transition"
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={journey.title}>
                            {journey.title}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[10px] text-slate-400">
                              v{journey.publishing?.version || 1}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                                journey.publishing?.status === 'published'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {journey.publishing?.status || 'draft'}
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAddJourney(journey)}
                          className="h-7 px-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 shrink-0"
                          title="Assign to terminal"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          <span className="text-xs">{t('assignments.add', { defaultValue: 'Assign' })}</span>
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Assigned Journeys & Execution Order */}
              <div className="flex flex-col h-[400px] border border-slate-200 rounded-xl bg-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                    <span>{t('assignments.assignedRanking', { defaultValue: 'Assigned Priority Order' })}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({assignedItems.length})</span>
                  </h3>
                  {assignedItems.length > 0 && (
                    <button
                      onClick={() => setAssignedItems([])}
                      className="text-[11px] text-rose-500 hover:text-rose-700 font-medium transition"
                    >
                      {t('assignments.clearAll', { defaultValue: 'Clear all' })}
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {assignedItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center p-4 border-2 border-dashed border-slate-100 rounded-lg">
                      <Tv className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs font-medium text-slate-600">
                        {t('assignments.noJourneysAssigned', { defaultValue: 'No journeys assigned yet' })}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                        {t('assignments.addInstructions', { defaultValue: 'Select journeys from the left panel to assign them to this kiosk.' })}
                      </p>
                    </div>
                  ) : (
                    assignedItems.map((item, index) => (
                      <div
                        key={item.journeyId}
                        className="flex items-center justify-between p-3 bg-slate-50/80 rounded-lg border border-slate-200/80 hover:border-slate-300 transition"
                      >
                        {/* Priority Badge */}
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                          <span
                            className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              index === 0
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                            title={`Priority ${index + 1}`}
                          >
                            {getPriorityLabel(index)}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 truncate" title={item.title}>
                              {item.title}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {/* Mandatory toggle button */}
                              <button
                                type="button"
                                onClick={() => handleToggleMandatory(item.journeyId)}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition flex items-center space-x-1 ${
                                  item.isMandatory
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                }`}
                                title="Click to toggle mandatory completion requirement"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>{item.isMandatory ? 'Mandatory' : 'Optional'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Order & Remove Actions */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="h-7 w-7 text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                            title="Move priority up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === assignedItems.length - 1}
                            className="h-7 w-7 text-slate-500 hover:text-indigo-600 disabled:opacity-30"
                            title="Move priority down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleRemoveJourney(item.journeyId)}
                            className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Unassign journey"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {assignedItems.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      {t('assignments.priorityExplanation', {
                        defaultValue: '1st priority journey launches as primary briefing on the terminal.'
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {assignedItems.length > 0
              ? `${assignedItems.length} journey(s) configured`
              : t('assignments.noAssignedFooter', { defaultValue: 'Terminal will show default standby idle screen' })}
          </span>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {t('common:cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveAssignments}
              disabled={saving || loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[130px]"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  {t('assignments.saving', { defaultValue: 'Saving...' })}
                </>
              ) : (
                t('assignments.saveAssignments', { defaultValue: 'Save Assignments' })
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceAssignmentModal;
