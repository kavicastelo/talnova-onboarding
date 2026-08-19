import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  Plus,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Users,
  RefreshCw,
  Coffee,
  UserCheck,
  Globe
} from 'lucide-react';
import {
  useCalendarConnection,
  useMeetingEvents,
  useConnectCalendar,
  useCreateMeetingEvent,
  useCancelMeetingEvent
} from '../hooks/useCalendar';
import { useRole } from '../context/RoleContext';
import { useEmployees } from '../hooks/useEmployees';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';

export const CalendarIntegration: React.FC = () => {
  const { role } = useRole();
  const isManager = role === 'manager' || role === 'admin' || role === 'owner';

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'manager_1on1' | 'buddy_coffee' | 'orientation' | 'training' | 'custom'>('manager_1on1');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:30');
  const [locationUrl, setLocationUrl] = useState('https://meet.google.com/talnova-onboarding');
  const [selectedAttendeeId, setSelectedAttendeeId] = useState('');

  const { data: connection, isLoading: connectionLoading } = useCalendarConnection();
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useMeetingEvents();
  const { data: employeesData } = useEmployees({ page: 1, limit: 100 });

  const createEventMutation = useCreateMeetingEvent();
  const cancelEventMutation = useCancelMeetingEvent();
  const connectCalendarMutation = useConnectCalendar();

  const employees = employeesData?.employees || [];
  const icalFeedUrl = `${window.location.origin}/api/v1/calendar/feed/${connection?.icalToken || 'token'}.ics`;

  const handleScheduleMeeting = () => {
    if (!title.trim() || !startDate || !selectedAttendeeId) {
      toast.error('Please complete all required fields.');
      return;
    }

    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${startDate}T${endTime}:00`).toISOString();

    createEventMutation.mutate(
      {
        title,
        category,
        attendeeUserIds: [selectedAttendeeId],
        startTime: startISO,
        endTime: endISO,
        locationUrl,
      },
      {
        onSuccess: () => {
          toast.success('Meeting scheduled successfully!');
          setIsScheduleModalOpen(false);
          setTitle('');
          setSelectedAttendeeId('');
          refetchEvents();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to schedule meeting');
        }
      }
    );
  };

  const handleCancelMeeting = (eventId: string) => {
    if (!confirm('Are you sure you want to cancel this meeting event?')) return;
    cancelEventMutation.mutate(eventId, {
      onSuccess: () => {
        toast.success('Meeting event cancelled.');
        refetchEvents();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || 'Failed to cancel meeting');
      }
    });
  };

  const handleCopyICalUrl = () => {
    navigator.clipboard.writeText(icalFeedUrl);
    setCopied(true);
    toast.success('iCal Feed URL copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-indigo-600" />
            Calendar & Meeting Integration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect onboarding activities to Google Calendar, Outlook, and iCal feeds with automated 1-on-1 meeting links.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSyncModalOpen(true)}
          >
            <Globe className="h-4 w-4 mr-2" /> iCal Subscription Sync
          </Button>
          {isManager && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setIsScheduleModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" /> Schedule Meeting
            </Button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      <Card className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 shadow-md border-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500 text-white text-xs font-semibold">
                Calendar Feed Active
              </Badge>
              <span className="text-xs text-slate-300">Timezone: {connection?.timezone || 'UTC'}</span>
            </div>
            <h3 className="text-lg font-bold">Synchronize Onboarding Schedule with External Calendar</h3>
            <p className="text-xs text-slate-300">
              Subscribe to your personal `.ics` feed on Google Calendar, Apple Calendar, or Outlook.
            </p>
          </div>
          <Button
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shrink-0"
            onClick={() => setIsSyncModalOpen(true)}
          >
            Copy .ICS Feed Link
          </Button>
        </div>
      </Card>

      {/* Scheduled Onboarding Meetings Roster */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold">Scheduled Onboarding Meetings</CardTitle>
          <CardDescription>Upcoming 1-on-1 syncs, buddy welcome coffees, and orientation sessions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {eventsLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading calendar schedule...</div>
          ) : (events || []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No onboarding meetings scheduled.</div>
          ) : (
            <div className="divide-y">
              {events?.map((ev) => (
                <div
                  key={ev._id}
                  className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{ev.title}</h4>
                      <Badge
                        variant="outline"
                        className={
                          ev.category === 'manager_1on1'
                            ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]'
                            : ev.category === 'buddy_coffee'
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                        }
                      >
                        {ev.category.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-4 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(ev.startTime).toLocaleDateString()} ({new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </span>
                      {ev.locationUrl && (
                        <a
                          href={ev.locationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-indigo-600 font-medium hover:underline"
                        >
                          <Video className="h-3.5 w-3.5" /> Join Video Call <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {ev.status === 'cancelled' ? (
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                        Cancelled
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                        Scheduled
                      </Badge>
                    )}

                    {isManager && ev.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 text-xs"
                        onClick={() => handleCancelMeeting(ev._id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Schedule Meeting */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Onboarding Meeting</DialogTitle>
            <DialogDescription>Create a meeting event with calendar sync and video link.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Meeting Title</label>
              <Input
                placeholder="e.g. Day 7 Manager 1-on-1 Sync"
                value={title}
                onChange={(e: any) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Category</label>
                <select
                  className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                >
                  <option value="manager_1on1">Manager 1-on-1</option>
                  <option value="buddy_coffee">Buddy Welcome Coffee</option>
                  <option value="orientation">Orientation Session</option>
                  <option value="training">Technical Training</option>
                  <option value="custom">Custom Meeting</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Participant</label>
                <select
                  className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                  value={selectedAttendeeId}
                  onChange={(e) => setSelectedAttendeeId(e.target.value)}
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Date</label>
                <Input type="date" value={startDate} onChange={(e: any) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Start Time</label>
                <Input type="time" value={startTime} onChange={(e: any) => setStartTime(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">End Time</label>
                <Input type="time" value={endTime} onChange={(e: any) => setEndTime(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Video Call Location Link</label>
              <Input
                placeholder="https://meet.google.com/abc-defg-hij"
                value={locationUrl}
                onChange={(e: any) => setLocationUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleScheduleMeeting}>
              Schedule Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: iCal Subscription Sync */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>iCal Calendar Subscription Feed</DialogTitle>
            <DialogDescription>
              Copy your personal `.ics` URL to subscribe in Google Calendar, Outlook, or Apple Calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">iCal (.ics) Feed URL</label>
              <div className="flex gap-2">
                <Input readOnly value={icalFeedUrl} className="font-mono text-xs bg-muted/30" />
                <Button variant="outline" onClick={handleCopyICalUrl}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Updates made to onboarding meetings in Talnova automatically sync to your calendar.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarIntegration;
