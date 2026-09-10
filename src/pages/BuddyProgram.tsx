import React, { useState } from 'react';
import {
  HeartHandshake,
  Mail,
  Plus,
  MessageSquare,
  Sparkles,
  Users,
  Building2,
  Star,
  CheckSquare,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import {
  useMyBuddy,
  useMyMentees,
  useAvailableBuddies,
  useBuddyAssignments,
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
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export const BuddyProgram: React.FC = () => {
  const { role } = useRole();
  const canAssignBuddy = role === 'manager' || role === 'admin' || role === 'owner' || role === 'hr_admin' || role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'my-buddy' | 'my-mentees' | 'pairings' | 'directory'>('my-buddy');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

  // Form states
  const [selectedNewHireId, setSelectedNewHireId] = useState('');
  const [selectedBuddyId, setSelectedBuddyId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Standard Cultural Onboarding');
  const [validationError, setValidationError] = useState('');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinRating, setCheckinRating] = useState(5);
  const [buddyBio, setBuddyBio] = useState('');
  const [buddySkills, setBuddySkills] = useState('');

  const { data: myBuddy, isLoading: buddyLoading, refetch: refetchBuddy } = useMyBuddy();
  const { data: mentees, isLoading: menteesLoading, refetch: refetchMentees } = useMyMentees();
  const { data: availableBuddies, isLoading: availableLoading, refetch: refetchAvailable } = useAvailableBuddies();
  const { data: allAssignments, isLoading: assignmentsLoading, refetch: refetchAssignments } = useBuddyAssignments();

  const menteesPagination = usePagination({ data: mentees || [], initialPageSize: 6 });
  const buddiesPagination = usePagination({ data: availableBuddies || [], initialPageSize: 6 });
  const assignmentsPagination = usePagination({ data: allAssignments || [], initialPageSize: 6 });
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
          refetchAssignments();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to update checklist item');
        }
      }
    );
  };

  const handleAssignBuddy = () => {
    setValidationError('');

    if (!selectedNewHireId || !selectedBuddyId) {
      const err = 'Please select both a new hire mentee and an onboarding buddy.';
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (selectedNewHireId === selectedBuddyId) {
      const err = 'Cannot pair an employee with themselves as buddy';
      setValidationError(err);
      toast.error(err);
      return;
    }

    assignBuddyMutation.mutate(
      {
        newHireUserId: selectedNewHireId,
        buddyUserId: selectedBuddyId,
        checklistTemplate: selectedTemplate,
      },
      {
        onSuccess: () => {
          toast.success('Buddy assigned to new hire successfully!');
          setIsAssignModalOpen(false);
          setSelectedNewHireId('');
          setSelectedBuddyId('');
          setValidationError('');
          refetchBuddy();
          refetchMentees();
          refetchAvailable();
          refetchAssignments();
          if (canAssignBuddy) {
            setActiveTab('pairings');
          }
        },
        onError: (err: any) => {
          const errMsg = err?.response?.data?.message || err?.message || 'Failed to assign buddy';
          setValidationError(errMsg);
          toast.error(errMsg);
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
          refetchAssignments();
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
            data-testid="become-buddy-btn"
          >
            <Sparkles className="h-4 w-4 mr-2" /> Become a Buddy
          </Button>
          {canAssignBuddy && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => {
                setValidationError('');
                setIsAssignModalOpen(true);
              }}
              data-testid="assign-buddy-btn"
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
        {canAssignBuddy && (
          <button
            className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'pairings'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('pairings')}
          >
            <Users className="h-4 w-4" /> Active Pairings ({allAssignments?.length || 0})
          </button>
        )}
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
                      className="p-3 border rounded-lg flex items-center justify-center gap-2 font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Mail className="h-4 w-4" /> Send Email
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
              <div>
                <div className="divide-y">
                  {menteesPagination.paginatedData.map((m) => {
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

                <div className="p-3 border-t">
                  <SimplePagination
                    currentPage={menteesPagination.page}
                    totalPages={menteesPagination.totalPages}
                    totalItems={menteesPagination.totalItems}
                    startIndex={menteesPagination.startIndex}
                    endIndex={menteesPagination.endIndex}
                    pageSize={menteesPagination.pageSize}
                    onPageChange={menteesPagination.setPage}
                    onPageSizeChange={menteesPagination.setPageSize}
                    itemLabel="mentees"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Active Pairings Dashboard (Manager / Admin View) */}
      {activeTab === 'pairings' && canAssignBuddy && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Active Onboarding Buddy Pairings</CardTitle>
                <CardDescription>Review peer mentorship pairings, checklist progress, and re-assign buddies.</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setValidationError('');
                  setIsAssignModalOpen(true);
                }}
                data-testid="assign-buddy-btn-tab"
              >
                <Plus className="h-4 w-4 mr-1" /> New Pairing
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              {assignmentsLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading pairings...</div>
              ) : (allAssignments || []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No active buddy pairings found. Click "Assign Buddy" to create one.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {assignmentsPagination.paginatedData.map((p) => {
                    const menteeName = p.newHireUserId?.profile
                      ? `${p.newHireUserId.profile.firstName || ''} ${p.newHireUserId.profile.lastName || ''}`
                      : 'New Hire';
                    const buddyName = p.buddyUserId?.profile
                      ? `${p.buddyUserId.profile.firstName || ''} ${p.buddyUserId.profile.lastName || ''}`
                      : 'Peer Buddy';

                    const completedCount = p.checklist?.filter((c: any) => c.completed).length || 0;
                    const totalCount = p.checklist?.length || 1;
                    const progressPercent = Math.round((completedCount / totalCount) * 100);

                    return (
                      <Card
                        key={p._id}
                        data-testid="active-pairing-card"
                        className="border shadow-sm hover:border-indigo-300 transition-all p-5 space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-foreground">{menteeName}</h4>
                              <Badge
                                variant="outline"
                                className={
                                  p.status === 'active'
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs'
                                    : 'bg-slate-500/10 text-slate-600 border-slate-500/20 text-xs'
                                }
                              >
                                {p.status.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Mentee ({p.newHireUserId?.employment?.department || 'Department'}) &bull; Paired with <span className="font-semibold text-foreground">{buddyName}</span>
                            </p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs shrink-0"
                            onClick={() => {
                              setSelectedNewHireId(p.newHireUserId?._id || p.newHireUserId);
                              setSelectedBuddyId('');
                              setValidationError('');
                              setIsAssignModalOpen(true);
                            }}
                            data-testid="reassign-buddy-btn"
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-assign
                          </Button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>Checklist Progress</span>
                            <span data-testid="checklist-progress">{progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {completedCount} of {totalCount} onboarding tasks completed
                          </p>
                        </div>

                        {/* Checklist Preview */}
                        <div className="space-y-1.5 pt-2 border-t text-xs">
                          {p.checklist?.slice(0, 3).map((item: any) => (
                            <div
                              key={item._id || item.title}
                              className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted/20"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={item.completed}
                                  onChange={() => handleToggleTask(p._id, item._id || item.title, item.completed)}
                                  className="rounded border-gray-300 text-indigo-600 h-3.5 w-3.5 cursor-pointer"
                                />
                                <span className={item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}>
                                  {item.title}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-[9px] uppercase">
                                {item.stage.replace('_', ' ')}
                              </Badge>
                            </div>
                          ))}
                          {(p.checklist?.length || 0) > 3 && (
                            <p className="text-[10px] text-muted-foreground italic text-center pt-1">
                              + {(p.checklist?.length || 0) - 3} more checklist items
                            </p>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Available Buddies Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableLoading ? (
              <div className="p-8 text-center text-muted-foreground col-span-3">Loading available buddies...</div>
            ) : (availableBuddies || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground col-span-3">No buddies registered in this organization yet.</div>
            ) : (
              buddiesPagination.paginatedData.map((b) => (
                <Card key={b._id} className="p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-lg">
                        {b.userId?.profile?.firstName?.[0] || 'B'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">
                          {b.userId?.profile?.firstName} {b.userId?.profile?.lastName}
                        </h4>
                        <p className="text-xs text-muted-foreground">{b.department || 'General'}</p>
                      </div>
                    </div>

                    {b.bio && <p className="text-xs text-slate-600 dark:text-slate-300 italic">"{b.bio}"</p>}

                    {b.skills && b.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {b.skills.map((s: string) => (
                          <Badge key={s} variant="outline" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t mt-4 flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">
                      Mentee Capacity: <strong className="text-foreground">{b.currentMenteeCount} / {b.maxMentees}</strong>
                    </span>
                    {canAssignBuddy && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          setSelectedBuddyId(b.userId?._id || b.userId);
                          setValidationError('');
                          setIsAssignModalOpen(true);
                        }}
                      >
                        Pair Mentee
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          <SimplePagination
            currentPage={buddiesPagination.page}
            totalPages={buddiesPagination.totalPages}
            totalItems={buddiesPagination.totalItems}
            startIndex={buddiesPagination.startIndex}
            endIndex={buddiesPagination.endIndex}
            pageSize={buddiesPagination.pageSize}
            onPageChange={buddiesPagination.setPage}
            onPageSizeChange={buddiesPagination.setPageSize}
            itemLabel="buddies"
          />
        </div>
      )}

      {/* Modal: Assign Buddy */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pair New Hire with Onboarding Buddy</DialogTitle>
            <DialogDescription>Select an incoming direct report, choose an eligible buddy mentor, and attach a checklist.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {validationError && (
              <div
                data-testid="buddy-validation-error"
                className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-md border border-red-200 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Incoming Mentee (Direct Report) *</label>
              <select
                data-testid="mentee-select"
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={selectedNewHireId}
                onChange={(e) => {
                  setSelectedNewHireId(e.target.value);
                  setValidationError('');
                }}
              >
                <option value="">-- Select Direct Report Mentee --</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.email}) - {emp.department || 'General'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Available Designated Buddy *</label>
              <select
                data-testid="buddy-select"
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={selectedBuddyId}
                onChange={(e) => {
                  setSelectedBuddyId(e.target.value);
                  setValidationError('');
                }}
              >
                <option value="">-- Select Registered Buddy --</option>
                {availableBuddies?.map((b: any) => (
                  <option key={b.userId?._id} value={b.userId?._id}>
                    {b.userId?.profile?.firstName} {b.userId?.profile?.lastName} ({b.department}) - Active Load: {b.currentMenteeCount}/{b.maxMentees}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Checklist Template *</label>
              <select
                data-testid="checklist-template-select"
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="Standard Cultural Onboarding">Standard Cultural Onboarding</option>
                <option value="Technical Deep Dive & Tooling">Technical Deep Dive & Tooling</option>
                <option value="Leadership & Executive Fast Track">Leadership & Executive Fast Track</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleAssignBuddy}
              data-testid="create-pairing-btn"
            >
              Create Pairing
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
