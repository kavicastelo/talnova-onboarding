import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  useMyBuddyProfile,
  useAvailableBuddies,
  useBuddyAssignments,
  useRegisterBuddy,
  useAssignBuddy,
  useUpdateBuddyChecklist,
  useLogBuddyCheckin,
  useAddBuddyChecklistTask
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
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { SearchableSelect } from '../components/SearchableSelect';
import { usePagination } from '../hooks/usePagination';
import { CompatibilityRadarWidget } from '../components/buddy/CompatibilityRadarWidget';
import { ProactiveCoachingFeed } from '../components/buddy/ProactiveCoachingFeed';
import { AdminBuddyOverrideModal } from '../components/buddy/AdminBuddyOverrideModal';
import { buddyMatchingService } from '../services/buddy-matching.service';

export const BuddyProgram: React.FC = () => {
  const { t } = useTranslation('buddy');
  const { role } = useRole();
  const canAssignBuddy = role === 'manager' || role === 'admin' || role === 'owner' || role === 'hr_admin' || role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'my-buddy' | 'my-mentees' | 'pairings' | 'directory' | 'matching'>('my-buddy');
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overridePairing, setOverridePairing] = useState<any>(null);
  const [selectedHireForMatching, setSelectedHireForMatching] = useState<string>('');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isCustomTaskModalOpen, setIsCustomTaskModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [customTaskAssignmentId, setCustomTaskAssignmentId] = useState<string | null>(null);

  // Form states
  const [selectedNewHireId, setSelectedNewHireId] = useState('');
  const [selectedBuddyId, setSelectedBuddyId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('Standard Cultural Onboarding');
  const [validationError, setValidationError] = useState('');
  const [profileValidationError, setProfileValidationError] = useState('');
  const [customTaskTitle, setCustomTaskTitle] = useState('');
  const [customTaskStage, setCustomTaskStage] = useState<'day_1' | 'week_1' | 'month_1'>('day_1');
  const [checkinNotes, setCheckinNotes] = useState('');
  const [checkinRating, setCheckinRating] = useState(5);
  const [checkinSentiment, setCheckinSentiment] = useState<'positive' | 'neutral' | 'challenged'>('positive');
  const [checkinValidationError, setCheckinValidationError] = useState('');
  const [buddyBio, setBuddyBio] = useState('');
  const [buddySkills, setBuddySkills] = useState('');
  const [buddyLanguages, setBuddyLanguages] = useState('');
  const [maxMentees, setMaxMentees] = useState(2);
  const [isAvailable, setIsAvailable] = useState(true);

  const { data: myBuddy, isLoading: buddyLoading, refetch: refetchBuddy } = useMyBuddy();
  const { data: myBuddyProfile, refetch: refetchMyProfile } = useMyBuddyProfile();
  const { data: mentees, isLoading: menteesLoading, refetch: refetchMentees } = useMyMentees();
  const { data: availableBuddies, isLoading: availableLoading, refetch: refetchAvailable } = useAvailableBuddies();
  const { data: allAssignments, isLoading: assignmentsLoading, refetch: refetchAssignments } = useBuddyAssignments();

  const menteesPagination = usePagination({ data: mentees || [], initialPageSize: 6 });
  const buddiesPagination = usePagination({ data: availableBuddies || [], initialPageSize: 6 });
  const assignmentsPagination = usePagination({ data: allAssignments || [], initialPageSize: 6 });
  const { data: employeesData } = useEmployees({ page: 1, limit: 1000 });

  const registerBuddyMutation = useRegisterBuddy();
  const assignBuddyMutation = useAssignBuddy();
  const updateChecklistMutation = useUpdateBuddyChecklist();
  const logCheckinMutation = useLogBuddyCheckin();
  const addCustomTaskMutation = useAddBuddyChecklistTask();

  const employees = employeesData?.employees || [];

  const handleToggleTask = (assignmentId: string, taskId: string, currentStatus: boolean) => {
    updateChecklistMutation.mutate(
      { assignmentId, taskId, completed: !currentStatus },
      {
        onSuccess: () => {
          toast.success(t('toasts.checklistUpdated', { defaultValue: 'Checklist item updated!' }));
          refetchBuddy();
          refetchMentees();
          refetchAssignments();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.checklistUpdateError', { defaultValue: 'Failed to update checklist item' }));
        }
      }
    );
  };

  const handleAssignBuddy = () => {
    setValidationError('');

    if (!selectedNewHireId || !selectedBuddyId) {
      const err = t('toasts.selectBothRequired', { defaultValue: 'Please select both a new hire mentee and an onboarding buddy.' });
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (selectedNewHireId === selectedBuddyId) {
      const err = t('toasts.cannotPairSelf', { defaultValue: 'Cannot pair an employee with themselves as buddy' });
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
          toast.success(t('toasts.buddyAssigned', { defaultValue: 'Buddy assigned to new hire successfully!' }));
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
          const errMsg = err?.response?.data?.message || err?.message || t('toasts.buddyAssignError', { defaultValue: 'Failed to assign buddy' });
          setValidationError(errMsg);
          toast.error(errMsg);
        }
      }
    );
  };

  const handleConfirmBuddyOverride = async ({
    newHireId,
    targetBuddyId,
    reason,
  }: {
    newHireId: string;
    targetBuddyId: string;
    reason: string;
    notifyParties: boolean;
  }) => {
    assignBuddyMutation.mutate(
      {
        newHireUserId: newHireId,
        buddyUserId: targetBuddyId,
        checklistTemplate: 'Standard Cultural Onboarding',
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.overrideSuccess', { reason, defaultValue: `Buddy partnership reassigned: ${reason}` }));
          setIsOverrideModalOpen(false);
          setOverridePairing(null);
          refetchBuddy();
          refetchMentees();
          refetchAvailable();
          refetchAssignments();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.overrideError', { defaultValue: 'Failed to reassign buddy.' }));
        },
      }
    );
  };

  const handleLogCheckin = () => {
    setCheckinValidationError('');
    if (!checkinNotes.trim()) {
      const msg = t('toasts.checkinNotesRequired', { defaultValue: 'Please provide check-in meeting notes.' });
      setCheckinValidationError(msg);
      toast.error(msg);
      return;
    }

    if (!selectedAssignmentId) {
      toast.error(t('toasts.noAssignmentSelected', { defaultValue: 'No assignment selected for check-in' }));
      return;
    }

    logCheckinMutation.mutate(
      {
        assignmentId: selectedAssignmentId,
        payload: {
          notes: checkinNotes.trim(),
          rating: checkinRating,
          sentiment: checkinSentiment,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.checkinLogged', { defaultValue: '1-on-1 Buddy check-in logged!' }));
          setIsCheckinModalOpen(false);
          setCheckinNotes('');
          setCheckinValidationError('');
          setSelectedAssignmentId(null);
          refetchMentees();
          refetchBuddy();
          refetchAssignments();
        },
        onError: (err: any) => {
          const errMsg = err?.response?.data?.message || err?.message || t('toasts.checkinError', { defaultValue: 'Failed to log check-in' });
          setCheckinValidationError(errMsg);
          toast.error(errMsg);
        }
      }
    );
  };

  const handleAddCustomTask = () => {
    if (!customTaskAssignmentId || !customTaskTitle.trim()) {
      toast.error(t('toasts.taskTitleRequired', { defaultValue: 'Please provide a task title' }));
      return;
    }

    addCustomTaskMutation.mutate(
      {
        assignmentId: customTaskAssignmentId,
        payload: {
          title: customTaskTitle.trim(),
          stage: customTaskStage,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.customTaskAdded', { defaultValue: 'Custom task added to checklist!' }));
          setIsCustomTaskModalOpen(false);
          setCustomTaskTitle('');
          setCustomTaskAssignmentId(null);
          refetchMentees();
          refetchBuddy();
          refetchAssignments();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.customTaskError', { defaultValue: 'Failed to add custom task' }));
        },
      }
    );
  };

  const handleOpenRegisterModal = () => {
    setProfileValidationError('');
    if (myBuddyProfile) {
      setBuddyBio(myBuddyProfile.bio || '');
      setBuddySkills((myBuddyProfile.skills || []).join(', '));
      setBuddyLanguages((myBuddyProfile.languages || []).join(', '));
      setMaxMentees(myBuddyProfile.maxMentees ?? 2);
      setIsAvailable(myBuddyProfile.isAvailable ?? true);
    } else {
      setBuddyBio('');
      setBuddySkills('');
      setBuddyLanguages('');
      setMaxMentees(2);
      setIsAvailable(true);
    }
    setIsRegisterModalOpen(true);
  };

  const handleToggleAvailability = (currentAvailability: boolean) => {
    const nextAvailability = !currentAvailability;
    registerBuddyMutation.mutate(
      {
        isAvailable: nextAvailability,
        maxMentees: myBuddyProfile?.maxMentees ?? 2,
        bio: myBuddyProfile?.bio,
        skills: myBuddyProfile?.skills,
        languages: myBuddyProfile?.languages,
      },
      {
        onSuccess: () => {
          toast.success(nextAvailability
            ? t('toasts.availabilityActive', { defaultValue: 'Availability set to Active!' })
            : t('toasts.availabilityAway', { defaultValue: 'Availability set to Away / Vacation' })
          );
          refetchMyProfile();
          refetchAvailable();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('toasts.availabilityError', { defaultValue: 'Failed to update availability' }));
        }
      }
    );
  };

  const handleRegisterBuddyProfile = () => {
    setProfileValidationError('');
    if (!maxMentees || maxMentees < 1 || maxMentees > 10) {
      const msg = t('toasts.maxMenteesRange', { defaultValue: 'Max mentees must be between 1 and 10' });
      setProfileValidationError(msg);
      toast.error(msg);
      return;
    }

    registerBuddyMutation.mutate(
      {
        isAvailable,
        maxMentees: Number(maxMentees),
        bio: buddyBio,
        skills: buddySkills.split(',').map((s) => s.trim()).filter(Boolean),
        languages: buddyLanguages.split(',').map((s) => s.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          toast.success(t('toasts.profileSaved', { defaultValue: 'Buddy profile saved successfully!' }));
          setIsRegisterModalOpen(false);
          refetchAvailable();
          refetchMyProfile();
        },
        onError: (err: any) => {
          const errMsg = err?.response?.data?.message || err?.message || t('toasts.profileSaveError', { defaultValue: 'Failed to register profile' });
          setProfileValidationError(errMsg);
          toast.error(errMsg);
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
            {t('title', { defaultValue: 'Buddy & Peer Onboarding Support' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle', { defaultValue: 'Pair new hires with experienced peer buddies for informal guidance, cultural integration, and regular check-ins.' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleOpenRegisterModal}
            data-testid="join-as-buddy-btn"
          >
            <Sparkles className="h-4 w-4 mr-2" /> {myBuddyProfile ? t('editProfile', { defaultValue: 'Edit Buddy Profile' }) : t('joinProgram', { defaultValue: 'Join as Buddy' })}
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
              <Plus className="h-4 w-4 mr-2" /> {t('assignBuddy', { defaultValue: 'Assign Buddy' })}
            </Button>
          )}
        </div>
      </div>

      {/* Buddy Profile Active Card */}
      {myBuddyProfile && (
        <Card data-testid="buddy-profile-active-card" className="border-l-4 border-l-indigo-600 bg-gradient-to-r from-indigo-50/50 via-white to-background dark:from-indigo-950/20 dark:via-background dark:to-background">
          <CardContent className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  {t('profileBanner.title', { defaultValue: 'Your Buddy Profile' })}
                </h3>
                <Badge
                  data-testid="buddy-status-badge"
                  className={
                    myBuddyProfile.isAvailable
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                  }
                >
                  {myBuddyProfile.isAvailable
                    ? t('profileBanner.active', { defaultValue: 'Buddy Profile Active' })
                    : t('profileBanner.inactive', { defaultValue: 'On Vacation / Inactive' })}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {myBuddyProfile.bio || t('profileBanner.defaultBio', { defaultValue: 'Senior peer mentor supporting onboarding colleagues.' })}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                <span><strong>{t('profileBanner.maxMentees', { defaultValue: 'Max Mentees:' })}</strong> {myBuddyProfile.maxMentees}</span>
                <span><strong>{t('profileBanner.currentLoad', { defaultValue: 'Current Load:' })}</strong> {t('profileBanner.menteesCount', { count: myBuddyProfile.currentMenteeCount || 0, defaultValue: `${myBuddyProfile.currentMenteeCount || 0} mentees` })}</span>
                {myBuddyProfile.skills && myBuddyProfile.skills.length > 0 && (
                  <span><strong>{t('profileBanner.skills', { defaultValue: 'Skills:' })}</strong> {myBuddyProfile.skills.join(', ')}</span>
                )}
                {myBuddyProfile.languages && myBuddyProfile.languages.length > 0 && (
                  <span><strong>{t('profileBanner.languages', { defaultValue: 'Languages:' })}</strong> {myBuddyProfile.languages.join(', ')}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                data-testid="availability-toggle"
                onClick={() => handleToggleAvailability(myBuddyProfile.isAvailable)}
                className="text-xs"
              >
                {myBuddyProfile.isAvailable
                  ? t('profileBanner.setAway', { defaultValue: 'Set to Away / Vacation' })
                  : t('profileBanner.setActive', { defaultValue: 'Set to Active' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="edit-buddy-profile-btn"
                onClick={handleOpenRegisterModal}
                className="text-xs"
              >
                {t('profileBanner.editBtn', { defaultValue: 'Edit Profile' })}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
          <HeartHandshake className="h-4 w-4" /> {t('tabs.myBuddy', { defaultValue: 'My Buddy' })}
        </button>
        <button
          className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'my-mentees'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('my-mentees')}
        >
          <Users className="h-4 w-4" /> {t('tabs.myMentees', { count: mentees?.length || 0, defaultValue: `My Mentees (${mentees?.length || 0})` })}
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
            <Users className="h-4 w-4" /> {t('tabs.pairings', { count: allAssignments?.length || 0, defaultValue: `Active Pairings (${allAssignments?.length || 0})` })}
          </button>
        )}
        {canAssignBuddy && (
          <button
            className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'matching'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('matching')}
          >
            <Sparkles className="h-4 w-4 text-indigo-600" /> {t('tabs.matching', { defaultValue: 'Algorithmic Matching & Coaching' })}
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
          <Building2 className="h-4 w-4" /> {t('tabs.directory', { count: availableBuddies?.length || 0, defaultValue: `Available Buddies Directory (${availableBuddies?.length || 0})` })}
        </button>
      </div>

      {/* Tab 1: My Onboarding Buddy */}
      {activeTab === 'my-buddy' && (
        <div className="space-y-6">
          {buddyLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              {t('myBuddyTab.loading', { defaultValue: 'Loading buddy details...' })}
            </div>
          ) : !myBuddy ? (
            <Card className="border-2 border-dashed p-8 text-center space-y-3">
              <HeartHandshake className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="font-semibold text-base">
                {t('myBuddyTab.noBuddyTitle', { defaultValue: 'No Buddy Assigned Yet' })}
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {t('myBuddyTab.noBuddyDesc', { defaultValue: 'Your manager or HR admin will pair you with an onboarding buddy to help you get settled during your first weeks.' })}
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
                    {myBuddy.buddyUserId?.employment?.jobTitle || t('myBuddyTab.peerBuddy', { defaultValue: 'Peer Buddy' })} | {myBuddy.buddyUserId?.employment?.department || t('myBuddyTab.team', { defaultValue: 'Team' })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="p-3 border rounded-lg bg-muted/20 text-center">
                    {t('myBuddyTab.assignedOn', {
                      date: new Date(myBuddy.assignedAt).toLocaleDateString(),
                      defaultValue: `Assigned on ${new Date(myBuddy.assignedAt).toLocaleDateString()}`
                    })}
                  </div>

                  {myBuddy.communicationLinks?.email && (
                    <a
                      href={`mailto:${myBuddy.communicationLinks.email}`}
                      className="p-3 border rounded-lg flex items-center justify-center gap-2 font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <Mail className="h-4 w-4" /> {t('myBuddyTab.sendEmail', { defaultValue: 'Send Email' })}
                    </a>
                  )}
                </CardContent>
              </Card>

              {/* Buddy Checklist & Check-ins */}
              <Card className="lg:col-span-2">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CheckSquare className="h-5 w-5 text-indigo-600" /> {t('myBuddyTab.checklistTitle', { defaultValue: 'Buddy Onboarding Checklist' })}
                  </CardTitle>
                  <CardDescription>
                    {t('myBuddyTab.checklistDesc', { defaultValue: 'Tasks to complete together with your onboarding buddy.' })}
                  </CardDescription>
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
                      <MessageSquare className="h-3.5 w-3.5" /> {t('myBuddyTab.checkinHistory', {
                        count: myBuddy.checkins?.length || 0,
                        defaultValue: `1-on-1 Check-In History (${myBuddy.checkins?.length || 0})`
                      })}
                    </h4>
                    {myBuddy.checkins?.map((c: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-md bg-muted/10 text-xs space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>
                            {t('myBuddyTab.checkinOn', {
                              date: new Date(c.completedAt).toLocaleDateString(),
                              defaultValue: `Check-in on ${new Date(c.completedAt).toLocaleDateString()}`
                            })}
                          </span>
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
            <CardTitle className="text-base font-semibold">
              {t('myMenteesTab.title', { defaultValue: 'Assigned Onboarding Mentees' })}
            </CardTitle>
            <CardDescription>
              {t('myMenteesTab.desc', { defaultValue: 'Track new hires you are mentoring as an Onboarding Buddy.' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {menteesLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                {t('myMenteesTab.loading', { defaultValue: 'Loading mentees...' })}
              </div>
            ) : (mentees || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {t('myMenteesTab.empty', { defaultValue: 'You do not have any active onboarding mentees assigned.' })}
              </div>
            ) : (
              <div>
                <div className="divide-y">
                  {menteesPagination.paginatedData.map((m) => {
                    const newHireName = m.newHireUserId?.profile
                      ? `${m.newHireUserId.profile.firstName || ''} ${m.newHireUserId.profile.lastName || ''}`.trim()
                      : 'New Hire';

                    const completedTasks = m.checklist?.filter((c) => c.completed).length || 0;
                    const totalTasks = m.checklist?.length || 1;
                    const progressPercentage = Math.round((completedTasks / totalTasks) * 100);

                    return (
                      <div
                        key={m._id}
                        data-testid="mentee-card"
                        className="p-6 space-y-4 hover:bg-muted/5 transition-colors border-b last:border-b-0"
                      >
                        {/* Mentee Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-foreground">{newHireName}</h4>
                              <Badge variant="outline" className="text-xs">
                                {m.newHireUserId?.employment?.department || 'General'}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {m.newHireUserId?.employment?.jobTitle || 'New Hire'}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t('myMenteesTab.pairedOn', {
                                date: new Date(m.assignedAt).toLocaleDateString(),
                                defaultValue: `Paired on ${new Date(m.assignedAt).toLocaleDateString()}`
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              data-testid="add-custom-task-btn"
                              onClick={() => {
                                setCustomTaskAssignmentId(m._id);
                                setCustomTaskTitle('');
                                setCustomTaskStage('day_1');
                                setIsCustomTaskModalOpen(true);
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> {t('myMenteesTab.addCustomTask', { defaultValue: 'Add Custom Task' })}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                              data-testid="log-checkin-btn"
                              onClick={() => {
                                setSelectedAssignmentId(m._id);
                                setIsCheckinModalOpen(true);
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5 mr-1" /> {t('myMenteesTab.logCheckin', { defaultValue: 'Log 1-on-1 Check-In' })}
                            </Button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5 bg-muted/20 p-3.5 rounded-lg border">
                          <div className="flex justify-between items-center text-xs font-semibold text-foreground">
                            <span>{t('myMenteesTab.rampProgress', { defaultValue: 'Mentee Ramp Progress' })}</span>
                            <span data-testid="mentee-progress-bar">
                              {t('myMenteesTab.progressSummary', {
                                percent: progressPercentage,
                                completed: completedTasks,
                                total: totalTasks,
                                defaultValue: `${progressPercentage}% (${completedTasks} of ${totalTasks} tasks completed)`
                              })}
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                            <div
                              data-testid="checklist-progress"
                              className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Checklist Items */}
                        <div className="space-y-2 pt-1">
                          <h5 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                            <CheckSquare className="h-3.5 w-3.5 text-indigo-600" /> {t('myMenteesTab.checklistHeading', { defaultValue: 'Onboarding & Cultural Checklist' })}
                          </h5>
                          <div className="space-y-2">
                            {m.checklist?.map((item: any) => (
                              <div
                                key={item._id || item.title}
                                className="p-3 border rounded-lg flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={item.completed}
                                    data-testid="checklist-task-checkbox"
                                    data-task-title={item.title}
                                    onChange={() => handleToggleTask(m._id, item._id || item.title, item.completed)}
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                  />
                                  <span className={item.completed ? 'line-through text-muted-foreground text-xs' : 'text-xs font-medium text-foreground'}>
                                    {item.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.completedAt && (
                                    <span className="text-[10px] text-muted-foreground">
                                      {t('myMenteesTab.doneOn', {
                                        date: new Date(item.completedAt).toLocaleDateString(),
                                        defaultValue: `Done ${new Date(item.completedAt).toLocaleDateString()}`
                                      })}
                                    </span>
                                  )}
                                  <Badge variant="outline" className="uppercase text-[9px]">
                                    {item.stage.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Check-In Timeline */}
                        <div data-testid="checkin-timeline" className="space-y-2 pt-3 border-t">
                          <div className="flex justify-between items-center">
                            <h5 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-indigo-600" /> {t('myMenteesTab.recentInteractions', {
                                count: m.checkins?.length || 0,
                                defaultValue: `Recent Check-In Interactions (${m.checkins?.length || 0})`
                              })}
                            </h5>
                          </div>
                          {(!m.checkins || m.checkins.length === 0) ? (
                            <p className="text-xs text-muted-foreground italic py-1">
                              {t('myMenteesTab.noInteractions', { defaultValue: 'No check-ins logged yet. Schedule or log an informal 1-on-1 check-in above.' })}
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {m.checkins.slice().reverse().map((c: any, idx: number) => {
                                const sentiment = c.sentiment || 'positive';
                                return (
                                  <div
                                    key={c._id || idx}
                                    data-testid="checkin-entry"
                                    className="p-3.5 border rounded-lg bg-card text-xs space-y-1.5 shadow-sm"
                                  >
                                    <div className="flex flex-wrap justify-between items-center gap-2">
                                      <div className="flex items-center gap-2 font-semibold text-foreground">
                                        <span>
                                          {t('myBuddyTab.checkinOn', {
                                            date: new Date(c.completedAt).toLocaleDateString(),
                                            defaultValue: `Check-in on ${new Date(c.completedAt).toLocaleDateString()}`
                                          })}
                                        </span>
                                        <Badge
                                          data-testid="sentiment-badge"
                                          className={
                                            sentiment === 'positive'
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                                              : sentiment === 'challenged'
                                              ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                                              : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300'
                                          }
                                        >
                                          {sentiment === 'positive'
                                            ? t('myMenteesTab.sentimentPositive', { defaultValue: 'Positive' })
                                            : sentiment === 'challenged'
                                            ? t('myMenteesTab.sentimentChallenged', { defaultValue: 'Challenged' })
                                            : t('myMenteesTab.sentimentNeutral', { defaultValue: 'Neutral' })}
                                        </Badge>
                                      </div>
                                      {c.rating && (
                                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                                          <Star className="h-3 w-3 fill-current" /> {c.rating}/5
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-muted-foreground italic">"{c.notes}"</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
                    itemLabel={t('myMenteesTab.menteesItemLabel', { defaultValue: 'mentees' })}
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
                <CardTitle className="text-base font-semibold">
                  {t('pairingsTab.title', { defaultValue: 'Active Onboarding Buddy Pairings' })}
                </CardTitle>
                <CardDescription>
                  {t('pairingsTab.desc', { defaultValue: 'Review peer mentorship pairings, checklist progress, and re-assign buddies.' })}
                </CardDescription>
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
                <Plus className="h-4 w-4 mr-1" /> {t('pairingsTab.newPairing', { defaultValue: 'New Pairing' })}
              </Button>
            </CardHeader>
            <CardContent className="p-6">
              {assignmentsLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  {t('pairingsTab.loading', { defaultValue: 'Loading pairings...' })}
                </div>
              ) : (allAssignments || []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {t('pairingsTab.empty', { defaultValue: 'No active buddy pairings found. Click "Assign Buddy" to create one.' })}
                </div>
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
                              {t('pairingsTab.mentee', { defaultValue: 'Mentee' })} ({p.newHireUserId?.employment?.department || 'Department'}) &bull; {t('pairingsTab.pairedWith', { defaultValue: 'Paired with' })}{' '}
                              <span className="font-semibold text-foreground">{buddyName}</span>
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
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> {t('pairingsTab.reassign', { defaultValue: 'Re-assign' })}
                          </Button>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span>{t('pairingsTab.checklistProgress', { defaultValue: 'Checklist Progress' })}</span>
                            <span data-testid="checklist-progress">{progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {t('pairingsTab.tasksCompleted', {
                              completed: completedCount,
                              total: totalCount,
                              defaultValue: `${completedCount} of ${totalCount} onboarding tasks completed`
                            })}
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
                              {t('pairingsTab.moreItems', {
                                count: (p.checklist?.length || 0) - 3,
                                defaultValue: `+ ${(p.checklist?.length || 0) - 3} more checklist items`
                              })}
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
              <div className="p-8 text-center text-muted-foreground col-span-3">
                {t('directoryTab.loading', { defaultValue: 'Loading available buddies...' })}
              </div>
            ) : (availableBuddies || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground col-span-3">
                {t('directoryTab.empty', { defaultValue: 'No buddies registered in this organization yet.' })}
              </div>
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
                      {t('directoryTab.menteeCapacity', { defaultValue: 'Mentee Capacity:' })}{' '}
                      <strong className="text-foreground">{b.currentMenteeCount} / {b.maxMentees}</strong>
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
                        {t('directoryTab.pairMentee', { defaultValue: 'Pair Mentee' })}
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
            itemLabel={t('directoryTab.buddiesItemLabel', { defaultValue: 'buddies' })}
          />
        </div>
      )}

      {/* Tab 5: Algorithmic Multi-Factor Matching & Proactive Coaching */}
      {activeTab === 'matching' && (
        <div className="space-y-6">
          <Card className="border shadow-sm bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    {t('matchingTab.title', { defaultValue: 'Algorithmic Multi-Factor Buddy Matching Engine' })}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t('matchingTab.desc', { defaultValue: 'Evaluates candidate mentors against incoming new hires across 5 weighted factors (Dept 35%, Loc/Tz 25%, Lang 20%, Capacity 15%, Skills 5%).' })}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200">
                  {t('matchingTab.badge', { defaultValue: 'Dynamic Algorithmic Scoring' })}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
              {/* Mentee Selector */}
              <div className="max-w-md space-y-1.5">
                <label className="text-xs font-semibold text-foreground block">
                  {t('matchingTab.selectHireLabel', { defaultValue: 'Select New Hire to Analyze Compatibility:' })}
                </label>
                <SearchableSelect
                  value={selectedHireForMatching || employees[0]?.id || ''}
                  onChange={setSelectedHireForMatching}
                  placeholder={t('matchingTab.selectHirePlaceholder', { defaultValue: 'Select new hire...' })}
                  options={employees.map((e: any) => ({
                    value: e.id,
                    label: e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Employee',
                    sublabel: `${e.department} • ${e.location || 'Remote'}`,
                  }))}
                />
              </div>

              {/* Compatibility Rankings Grid */}
              {(() => {
                const targetHire = employees.find((e: any) => e.id === (selectedHireForMatching || employees[0]?.id)) || employees[0];
                const candidateMatches = targetHire && (availableBuddies || []).length > 0
                  ? buddyMatchingService.rankBuddyCandidates(targetHire, availableBuddies || [])
                  : [];

                if (!targetHire || candidateMatches.length === 0) {
                  return (
                    <div className="p-8 text-center text-muted-foreground text-xs">
                      {t('matchingTab.emptyNotice', { defaultValue: 'Please register available buddies and select a new hire to compute algorithmic match metrics.' })}
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t('matchingTab.topRankedHeading', {
                          name: targetHire.name,
                          count: candidateMatches.length,
                          defaultValue: `Top Ranked Mentor Candidates for ${targetHire.name} (${candidateMatches.length} candidates evaluated):`
                        })}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {candidateMatches.slice(0, 4).map((match, idx) => {
                        const buddyUser = match.buddy?.userId;
                        const buddyName = `${buddyUser?.profile?.firstName || ''} ${buddyUser?.profile?.lastName || ''}`.trim() || 'Mentor';
                        return (
                          <div key={match.buddy._id} className="p-4 rounded-xl border border-border/80 bg-background/50 hover:bg-muted/10 transition-colors space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                                  #{idx + 1}
                                </span>
                                <div>
                                  <h5 className="font-bold text-xs text-foreground">{buddyName}</h5>
                                  <p className="text-[11px] text-muted-foreground">
                                    {match.buddy?.department || 'General'} • {t('matchingTab.activeMentees', {
                                      current: match.buddy?.currentMenteeCount || 0,
                                      max: match.buddy?.maxMentees || 3,
                                      defaultValue: `${match.buddy?.currentMenteeCount || 0}/${match.buddy?.maxMentees || 3} active mentees`
                                    })}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setOverridePairing({
                                    newHireId: targetHire.id,
                                    newHireName: targetHire.name,
                                    currentBuddyName: buddyName,
                                    department: targetHire.department,
                                  });
                                  setIsOverrideModalOpen(true);
                                }}
                                className="text-xs h-7 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                              >
                                {t('matchingTab.pairMentorBtn', { defaultValue: 'Pair Mentor' })}
                              </Button>
                            </div>

                            <CompatibilityRadarWidget
                              score={match.score}
                              scorePercent={match.scorePercent}
                              criteria={match.criteria}
                              buddyName={buddyName}
                              menteeName={targetHire.name}
                              reasons={match.reasons}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Proactive Coaching Sentinel Feed */}
          <ProactiveCoachingFeed
            onLogCheckin={(prompt) => {
              toast.info(t('toasts.quickCheckinOpening', { name: prompt.menteeName, defaultValue: `Opening quick check-in log for ${prompt.menteeName}` }));
              setIsCheckinModalOpen(true);
            }}
            onScheduleSync={(prompt) => {
              toast.success(t('toasts.inviteDispatched', {
                week: prompt.week,
                name: prompt.menteeName,
                defaultValue: `1-on-1 calendar invite dispatched for Week ${prompt.week} check-in with ${prompt.menteeName}`
              }));
            }}
          />
        </div>
      )}

      {/* Modal: Pair Buddy & Mentee */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <DialogTitle>{t('assignModal.title', { defaultValue: 'Pair Mentee with Onboarding Buddy' })}</DialogTitle>
            <DialogDescription>{t('assignModal.desc', { defaultValue: 'Select an incoming direct report, choose an eligible buddy mentor, and attach a checklist.' })}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 text-sm">
            {validationError && (
              <div
                data-testid="buddy-validation-error"
                className="p-3 text-xs bg-destructive/15 text-destructive rounded-xl border border-destructive/20 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('assignModal.menteeLabel', { defaultValue: 'Incoming Mentee (Direct Report) *' })}
              </label>
              <SearchableSelect
                data-testid="mentee-select"
                value={selectedNewHireId}
                onChange={(val) => {
                  setSelectedNewHireId(val);
                  setValidationError('');
                }}
                placeholder={t('assignModal.menteePlaceholder', { defaultValue: 'Search & select incoming mentee...' })}
                searchPlaceholder={t('assignModal.menteeSearchPlaceholder', { defaultValue: 'Search by mentee name, email, dept...' })}
                options={employees.map((emp: any) => ({
                  value: emp.id,
                  label: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unnamed',
                  sublabel: emp.email,
                  badge: emp.department || 'General',
                }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('assignModal.buddyLabel', { defaultValue: 'Available Designated Buddy *' })}
              </label>
              <SearchableSelect
                data-testid="buddy-select"
                value={selectedBuddyId}
                onChange={(val) => {
                  setSelectedBuddyId(val);
                  setValidationError('');
                }}
                placeholder={t('assignModal.buddyPlaceholder', { defaultValue: 'Search & select registered buddy...' })}
                searchPlaceholder={t('assignModal.buddySearchPlaceholder', { defaultValue: 'Search buddy by name, department...' })}
                options={(availableBuddies || []).map((b: any) => {
                  const bName = `${b.userId?.profile?.firstName || ''} ${b.userId?.profile?.lastName || ''}`.trim() || b.userId?.email || 'Buddy';
                  return {
                    value: b.userId?._id,
                    label: bName,
                    sublabel: t('assignModal.capacitySublabel', {
                      dept: b.department || 'General',
                      current: b.currentMenteeCount,
                      max: b.maxMentees,
                      defaultValue: `${b.department || 'General'} • Mentee Capacity: ${b.currentMenteeCount}/${b.maxMentees}`
                    }),
                    badge: t('assignModal.loadBadge', {
                      current: b.currentMenteeCount,
                      max: b.maxMentees,
                      defaultValue: `${b.currentMenteeCount}/${b.maxMentees} load`
                    }),
                  };
                })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('assignModal.templateLabel', { defaultValue: 'Checklist Template *' })}
              </label>
              <select
                data-testid="checklist-template-select"
                className="w-full text-xs p-2.5 border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
              >
                <option value="Standard Cultural Onboarding">
                  {t('assignModal.templates.standard', { defaultValue: 'Standard Cultural Onboarding' })}
                </option>
                <option value="Technical Deep Dive & Tooling">
                  {t('assignModal.templates.technical', { defaultValue: 'Technical Deep Dive & Tooling' })}
                </option>
                <option value="Leadership & Executive Fast Track">
                  {t('assignModal.templates.leadership', { defaultValue: 'Leadership & Executive Fast Track' })}
                </option>
              </select>
            </div>
          </DialogBody>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
              {t('assignModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={handleAssignBuddy}
              data-testid="create-pairing-btn"
            >
              {t('assignModal.createBtn', { defaultValue: 'Create Pairing' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Log 1-on-1 Check-In */}
      <Dialog open={isCheckinModalOpen} onOpenChange={setIsCheckinModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <DialogTitle>{t('checkinModal.title', { defaultValue: 'Log 1-on-1 Buddy Check-In' })}</DialogTitle>
            <DialogDescription>{t('checkinModal.desc', { defaultValue: 'Record meeting notes, guidance provided, and mentee sentiment.' })}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 text-sm">
            {checkinValidationError && (
              <div
                data-testid="checkin-validation-error"
                className="p-3 text-xs bg-destructive/15 text-destructive rounded-xl border border-destructive/20 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{checkinValidationError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('checkinModal.sentimentLabel', { defaultValue: 'Mentee Sentiment *' })}
              </label>
              <select
                data-testid="checkin-sentiment-select"
                className="w-full text-xs p-2.5 border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                value={checkinSentiment}
                onChange={(e: any) => setCheckinSentiment(e.target.value)}
              >
                <option value="positive">{t('checkinModal.sentiments.positive', { defaultValue: 'Positive - Settling in well & confident' })}</option>
                <option value="neutral">{t('checkinModal.sentiments.neutral', { defaultValue: 'Neutral - Steady ramp & on track' })}</option>
                <option value="challenged">{t('checkinModal.sentiments.challenged', { defaultValue: 'Challenged - Facing blockers or support needed' })}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('checkinModal.ratingLabel', { defaultValue: 'Meeting Rating (1 to 5 Stars):' })}
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setCheckinRating(star)}
                    className={`p-2 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                      checkinRating >= star ? 'bg-amber-100 border-amber-400 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-background text-muted-foreground'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('checkinModal.notesLabel', { defaultValue: '1-on-1 Meeting Notes & Observations *' })}
              </label>
              <textarea
                data-testid="checkin-notes-textarea"
                className="w-full min-h-[90px] text-xs p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-background text-foreground resize-none"
                placeholder={t('checkinModal.notesPlaceholder', { defaultValue: 'Met for coffee. Mentee is settling in well and enjoying the codebase...' })}
                value={checkinNotes}
                onChange={(e) => {
                  setCheckinNotes(e.target.value);
                  setCheckinValidationError('');
                }}
              />
            </div>
          </DialogBody>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => setIsCheckinModalOpen(false)}>
              {t('checkinModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={handleLogCheckin}
              data-testid="submit-checkin-btn"
            >
              {t('checkinModal.submitBtn', { defaultValue: 'Submit Check-in' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Become a Buddy */}
      <Dialog open={isRegisterModalOpen} onOpenChange={setIsRegisterModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <DialogTitle>
              {myBuddyProfile
                ? t('registerModal.titleEdit', { defaultValue: 'Edit Buddy Profile' })
                : t('registerModal.titleCreate', { defaultValue: 'Join as an Onboarding Buddy' })}
            </DialogTitle>
            <DialogDescription>
              {t('registerModal.desc', { defaultValue: 'Submit your mentorship bio, languages, technical skills, and mentee capacity.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 text-sm">
            {profileValidationError && (
              <div
                data-testid="buddy-profile-error"
                className="p-3 text-xs bg-destructive/15 text-destructive rounded-xl border border-destructive/20 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{profileValidationError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('registerModal.bioLabel', { defaultValue: 'Bio & Mentorship Introduction *' })}
              </label>
              <textarea
                data-testid="buddy-bio-input"
                className="w-full min-h-[80px] text-xs p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-background text-foreground resize-none"
                placeholder={t('registerModal.bioPlaceholder', { defaultValue: 'Share your experience and how you can support new team members...' })}
                value={buddyBio}
                onChange={(e) => {
                  setBuddyBio(e.target.value);
                  setProfileValidationError('');
                }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('registerModal.skillsLabel', { defaultValue: 'Technical Skills (comma separated)' })}
              </label>
              <Input
                data-testid="buddy-skills-input"
                placeholder={t('registerModal.skillsPlaceholder', { defaultValue: 'e.g. TypeScript, MongoDB, Node.js' })}
                value={buddySkills}
                onChange={(e: any) => {
                  setBuddySkills(e.target.value);
                  setProfileValidationError('');
                }}
                className="text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('registerModal.languagesLabel', { defaultValue: 'Languages (comma separated)' })}
              </label>
              <Input
                data-testid="buddy-languages-input"
                placeholder={t('registerModal.languagesPlaceholder', { defaultValue: 'e.g. English, Spanish' })}
                value={buddyLanguages}
                onChange={(e: any) => {
                  setBuddyLanguages(e.target.value);
                  setProfileValidationError('');
                }}
                className="text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('registerModal.capacityLabel', { defaultValue: 'Max Mentees Capacity (1 to 10) *' })}
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                data-testid="buddy-max-mentees-input"
                value={maxMentees}
                onChange={(e: any) => {
                  setMaxMentees(parseInt(e.target.value, 10) || 0);
                  setProfileValidationError('');
                }}
                className="text-xs rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="buddy-is-available"
                data-testid="buddy-availability-toggle"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded border-border text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="buddy-is-available" className="text-xs font-medium cursor-pointer text-foreground">
                {t('registerModal.availableCheckbox', { defaultValue: 'Available for new mentee pairings (uncheck if on vacation)' })}
              </label>
            </div>
          </DialogBody>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => setIsRegisterModalOpen(false)}>
              {t('registerModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={handleRegisterBuddyProfile}
              data-testid="save-profile-btn"
            >
              {t('registerModal.saveBtn', { defaultValue: 'Save Profile' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Add Custom Task */}
      <Dialog open={isCustomTaskModalOpen} onOpenChange={setIsCustomTaskModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-4">
            <DialogTitle>
              {t('customTaskModal.title', { defaultValue: 'Add Custom Task to Mentee Checklist' })}
            </DialogTitle>
            <DialogDescription>
              {t('customTaskModal.desc', { defaultValue: 'Create an ad-hoc mentoring or cultural milestone for this mentee.' })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('customTaskModal.titleLabel', { defaultValue: 'Task Title *' })}
              </label>
              <Input
                data-testid="custom-task-title-input"
                placeholder={t('customTaskModal.titlePlaceholder', { defaultValue: 'e.g. Schedule team lunch or review project goals' })}
                value={customTaskTitle}
                onChange={(e: any) => setCustomTaskTitle(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('customTaskModal.stageLabel', { defaultValue: 'Onboarding Stage' })}
              </label>
              <select
                data-testid="custom-task-stage-select"
                className="w-full text-xs p-2.5 border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
                value={customTaskStage}
                onChange={(e: any) => setCustomTaskStage(e.target.value)}
              >
                <option value="day_1">{t('customTaskModal.stages.day1', { defaultValue: 'Day 1' })}</option>
                <option value="week_1">{t('customTaskModal.stages.week1', { defaultValue: 'Week 1' })}</option>
                <option value="month_1">{t('customTaskModal.stages.month1', { defaultValue: 'Month 1' })}</option>
              </select>
            </div>
          </DialogBody>

          <DialogFooter className="p-4 sm:px-6 border-t border-border/60 bg-muted/30">
            <Button variant="outline" size="sm" onClick={() => setIsCustomTaskModalOpen(false)}>
              {t('customTaskModal.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              onClick={handleAddCustomTask}
              data-testid="save-custom-task-btn"
            >
              {t('customTaskModal.addBtn', { defaultValue: 'Add Task' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Manual Override & Partner Reassignment Modal (HITL Guardrail) */}
      <AdminBuddyOverrideModal
        isOpen={isOverrideModalOpen}
        onClose={() => {
          setIsOverrideModalOpen(false);
          setOverridePairing(null);
        }}
        pairing={overridePairing}
        availableBuddies={(availableBuddies || []).map((b) => ({
          id: b.userId?._id || b._id,
          name: `${b.userId?.profile?.firstName || ''} ${b.userId?.profile?.lastName || ''}`.trim() || 'Buddy Mentor',
          department: b.department || 'General',
          currentMentees: b.currentMenteeCount || 0,
          maxMentees: b.maxMentees || 3,
        }))}
        onConfirmOverride={handleConfirmBuddyOverride}
      />
    </div>
  );
};

export default BuddyProgram;
