import React, { useState } from 'react';
import {
  HeartHandshake,
  UserCheck,
  Mail,
  CheckCircle2,
  Clock,
  Plus,
  MessageSquare,
  Sparkles,
  Users,
  Building2,
  Star,
  CheckSquare
} from 'lucide-react';
import {
  useMyBuddy,
  useMyMentees,
  useAvailableBuddies,
  useRegisterBuddy,
  useAssignBuddy,
  useUpdateBuddyChecklist,
  useLogBuddyCheckin
} from '../hooks/useBuddy';
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

export const BuddyProgram: React.FC = () => {
  const { role } = useRole();
  const isAdmin = role === 'admin' || role === 'owner';

  const [activeTab, setActiveTab] = useState<'my-buddy' | 'my-mentees' | 'directory'>('my-buddy');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Form states
  const [selectedNewHireId, setSelectedNewHireId] = useState('');
  const [selectedBuddyId, setSelectedBuddyId] = useState('');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinRating, setCheckinRating] = useState(5);
  const [buddyBio, setBuddyBio] = useState('');
  const [buddySkills, setBuddySkills] = useState('');

  const { data: myBuddy, isLoading: buddyLoading, refetch: refetchBuddy } = useMyBuddy();
  const { data: mentees, isLoading: menteesLoading, refetch: refetchMentees } = useMyMentees();
  const { data: availableBuddies, isLoading: availableLoading, refetch: refetchAvailable } = useAvailableBuddies();
  const { data: employeesData } = useEmployees({ page: 1, limit: 100 });

  const registerBuddyMutation = useRegisterBuddy();
  const assignBuddyMutation = useAssignBuddy();
  const updateChecklistMutation = useUpdateBuddyChecklist();
  const logCheckinMutation = useLogBuddyCheckin();

  const employees = employeesData?.employees || [];

  const handleToggleTask = (assignmentId: string, taskId: string, currentStatus: boolean) => {
    updateChecklistMutation.mutate(
      { assignmentId, taskId, completed: !currentStatus },
      {
        onSuccess: () => {
          toast.success('Checklist item updated!');
          refetchBuddy();
          refetchMentees();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to update checklist item');
        }
      }
    );
  };

  const handleAssignBuddy = () => {
    if (!selectedNewHireId || !selectedBuddyId) {
      toast.error('Please select both a new hire and an onboarding buddy.');
      return;
    }

    assignBuddyMutation.mutate(
      { newHireUserId: selectedNewHireId, buddyUserId: selectedBuddyId },
      {
        onSuccess: () => {
          toast.success('Buddy assigned to new hire successfully!');
          setIsAssignModalOpen(false);
          setSelectedNewHireId('');
          setSelectedBuddyId('');
          refetchBuddy();
          refetchMentees();
          refetchAvailable();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to assign buddy');
        }
      }
    );
  };

  const handleLogCheckin = () => {
    if (!selectedAssignmentId || !checkinNotes.trim()) {
      toast.error('Please provide check-in meeting notes.');
      return;
    }

    logCheckinMutation.mutate(
      { assignmentId: selectedAssignmentId, payload: { notes: checkinNotes, rating: checkinRating } },
      {
        onSuccess: () => {
          toast.success('1-on-1 Buddy check-in logged!');
          setIsCheckinModalOpen(false);
          setCheckinNotes('');
          setSelectedAssignmentId(null);
          refetchMentees();
          refetchBuddy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to log check-in');
        }
      }
    );
  };

  const handleRegisterBuddyProfile = () => {
    registerBuddyMutation.mutate(
      {
        isAvailable: true,
        maxMentees: 3,
        bio: buddyBio,
        skills: buddySkills.split(',').map((s) => s.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          toast.success('You have registered as an Onboarding Buddy!');
          setIsRegisterModalOpen(false);
          refetchAvailable();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to register profile');
        }
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HeartHandshake className="h-7 w-7 text-indigo-600" />
            Buddy & Peer Onboarding Support
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pair new hires with experienced peer buddies for informal guidance, cultural integration, and regular check-ins.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsRegisterModalOpen(true)}
          >
            <Sparkles className="h-4 w-4 mr-2" /> Become a Buddy
          </Button>
          {isAdmin && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => setIsAssignModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" /> Assign Buddy
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b text-sm font-medium">
        <button
          className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'my-buddy'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('my-buddy')}
        >
          <HeartHandshake className="h-4 w-4" /> My Buddy
        </button>
        <button
          className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'my-mentees'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('my-mentees')}
        >
          <Users className="h-4 w-4" /> My Mentees ({mentees?.length || 0})
        </button>
        <button
          className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'directory'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('directory')}
        >
          <Building2 className="h-4 w-4" /> Available Buddies Directory ({availableBuddies?.length || 0})
        </button>
      </div>

      {/* Tab 1: My Onboarding Buddy */}
      {activeTab === 'my-buddy' && (
        <div className="space-y-6">
          {buddyLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading buddy details...</div>
          ) : !myBuddy ? (
            <Card className="border-2 border-dashed p-8 text-center space-y-3">
              <HeartHandshake className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="font-semibold text-base">No Buddy Assigned Yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Your manager or HR admin will pair you with an onboarding buddy to help you get settled during your first weeks.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Buddy Info Card */}
              <Card className="border-t-4 border-t-indigo-600 shadow-sm">
                <CardHeader className="text-center pb-4">
                  <div className="h-20 w-20 rounded-full bg-indigo-100 text-indigo-700 font-bold text-2xl flex items-center justify-center mx-auto mb-2">
                    {myBuddy.buddyUserId?.profile?.firstName?.[0] || 'B'}
                  </div>
                  <CardTitle className="text-lg font-bold">
                    {myBuddy.buddyUserId?.profile?.firstName} {myBuddy.buddyUserId?.profile?.lastName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {myBuddy.buddyUserId?.employment?.jobTitle || 'Peer Buddy'} | {myBuddy.buddyUserId?.employment?.department || 'Team'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="p-3 border rounded-lg bg-muted/20 text-center">
                    Assigned on {new Date(myBuddy.assignedAt).toLocaleDateString()}
                  </div>

                  {myBuddy.communicationLinks?.email && (
                    <a
                      href={`mailto:${myBuddy.communicationLinks.email}`}
                      className="w-full flex items-center justify-center gap-2 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium transition-colors"
                    >
                      <Mail className="h-4 w-4" /> Send Email Message
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Buddy Checklist & Check-ins */}
              <Card className="lg:col-span-2">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-indigo-600" /> Buddy Onboarding Checklist
                  </CardTitle>
                  <CardDescription>Tasks to complete together with your onboarding buddy.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-2">
                    {myBuddy.checklist?.map((item: any) => (
                      <div
                        key={item._id || item.title}
                        className="p-3 border rounded-lg flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => handleToggleTask(myBuddy._id, item._id || item.title, item.completed)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                          />
                          <span className={item.completed ? 'line-through text-muted-foreground text-xs' : 'text-xs font-medium text-foreground'}>
                            {item.title}
                          </span>
                        </div>
                        <Badge variant="outline" className="uppercase text-[9px]">
                          {item.stage.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* 1-on-1 Check-ins Log */}
                  <div className="pt-4 border-t space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" /> 1-on-1 Check-In History ({myBuddy.checkins?.length || 0})
                    </h4>
                    {myBuddy.checkins?.map((c: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-md bg-muted/10 text-xs space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>Check-in on {new Date(c.completedAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1 text-amber-600">
                            <Star className="h-3 w-3 fill-current" /> {c.rating}/5
                          </span>
                        </div>
                        <p className="text-slate-600 italic">"{c.notes}"</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: My Mentees (Buddy View) */}
      {activeTab === 'my-mentees' && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Assigned Onboarding Mentees</CardTitle>
            <CardDescription>Track new hires you are mentoring as an Onboarding Buddy.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {menteesLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading mentees...</div>
            ) : (mentees || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">You do not have any active onboarding mentees assigned.</div>
            ) : (
              <div className="divide-y">
                {mentees?.map((m) => {
                  const newHireName = m.newHireUserId?.profile
                    ? `${m.newHireUserId.profile.firstName || ''} ${m.newHireUserId.profile.lastName || ''}`
                    : 'New Hire';

                  const completedTasks = m.checklist?.filter((c) => c.completed).length || 0;
                  const totalTasks = m.checklist?.length || 1;

                  return (
                    <div key={m._id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{newHireName}</h4>
                          <Badge variant="outline" className="text-[10px]">
                            {m.newHireUserId?.employment?.department || 'General'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Checklist: {completedTasks} / {totalTasks} tasks completed | Paired on {new Date(m.assignedAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                          onClick={() => {
                            setSelectedAssignmentId(m._id);
                            setIsCheckinModalOpen(true);
                          }}
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" /> Log 1-on-1 Check-In
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Available Buddies Directory */}
      {activeTab === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {availableLoading ? (
            <div className="col-span-full p-8 text-center text-muted-foreground">Loading available buddies...</div>
          ) : (availableBuddies || []).length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              No eligible buddies registered. Click "Become a Buddy" to register your profile!
            </div>
          ) : (
            availableBuddies?.map((b) => (
              <Card key={b._id} className="hover:border-indigo-500/40 transition-all">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                      Available ({b.currentMenteeCount} / {b.maxMentees} Mentees)
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold mt-2">
                    {b.userId?.profile?.firstName} {b.userId?.profile?.lastName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {b.department || 'General'} | {b.jobTitle || 'Peer Buddy'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-3">
                  {b.bio && <p className="line-clamp-2 italic">"{b.bio}"</p>}
                  {b.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {b.skills.map((s, idx) => (
                        <Badge key={idx} variant="outline" className="text-[9px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal: Assign Buddy */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pair New Hire with Onboarding Buddy</DialogTitle>
            <DialogDescription>Select an employee and an eligible buddy mentor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">New Hire Employee</label>
              <select
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={selectedNewHireId}
                onChange={(e) => setSelectedNewHireId(e.target.value)}
              >
                <option value="">-- Select New Hire --</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email}) - {emp.department || 'General'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Designated Buddy</label>
              <select
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={selectedBuddyId}
                onChange={(e) => setSelectedBuddyId(e.target.value)}
              >
                <option value="">-- Select Available Buddy --</option>
                {availableBuddies?.map((b: any) => (
                  <option key={b.userId?._id} value={b.userId?._id}>
                    {b.userId?.profile?.firstName} {b.userId?.profile?.lastName} ({b.department}) - Load: {b.currentMenteeCount}/{b.maxMentees}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleAssignBuddy}>
              Assign Buddy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Log 1-on-1 Check-In */}
      <Dialog open={isCheckinModalOpen} onOpenChange={setIsCheckinModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log 1-on-1 Buddy Check-In</DialogTitle>
            <DialogDescription>Record meeting notes and peer support progress.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Meeting Rating (1 to 5 Stars):</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setCheckinRating(star)}
                    className={`p-2 rounded border flex items-center justify-center transition-colors ${
                      checkinRating >= star ? 'bg-amber-100 border-amber-400 text-amber-600' : 'bg-background'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">1-on-1 Meeting Notes & Guidance Provided:</label>
              <textarea
                className="w-full min-h-[90px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Discussed team workflows, answered questions about tools..."
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckinModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleLogCheckin}>
              Log Check-In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Become a Buddy */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register as an Onboarding Buddy</DialogTitle>
            <DialogDescription>Opt-in to mentor new hires and support peer onboarding.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Short Bio & Introduction</label>
              <textarea
                className="w-full min-h-[80px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Share your experience and how you can support new team members..."
                value={buddyBio}
                onChange={(e) => setBuddyBio(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Skills & Key Areas (comma separated)</label>
              <Input
                placeholder="e.g. React, Node.js, Agile, Company Culture"
                value={buddySkills}
                onChange={(e: any) => setBuddySkills(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleRegisterBuddyProfile}>
              Register Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BuddyProgram;
