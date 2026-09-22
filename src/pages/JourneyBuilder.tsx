import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '../components/Card';
import { Badge } from '../components/Badge';
import { ScrollArea } from '../components/ScrollArea';
import { Separator } from '../components/Separator';
import { Switch } from '../components/Switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/Select';
import { SearchableSelect } from '../components/SearchableSelect';
import {
  ChevronLeft,
  GripVertical,
  Plus,
  Users,
  FileText,
  Video,
  HelpCircle,
  AlertCircle,
  RefreshCw,
  Upload,
  Link2,
  Trash2,
  Bold,
  Italic,
  Code,
  List,
  Eye,
  PlusCircle,
  Save,
  ArrowRight,
  ArrowLeft,
  Check,
  ExternalLink,
  Search,
  UserCheck,
  Square
} from 'lucide-react';
import {
  useJourney,
  useUpdateJourney,
  useCreateJourney,
  useBulkAssignJourney,
  useJourneyAssignments,
  useIssueCertificate
} from '../hooks/useJourneys';
import { useEmployees } from '../hooks/useEmployees';
import { useWorkspaceSettings } from '../hooks/useSettings';
import { Skeleton } from '../components/Skeleton';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';
import { toast } from 'sonner';
import { CourseModule, Lesson } from '../types';
import { Trash, X, Lock, Globe, FileSpreadsheet, Headphones, Image as ImageIcon, CheckSquare, BookOpen } from 'lucide-react';
import { uploadService } from '../services/upload.service';

export function JourneyBuilder() {
  const { t } = useTranslation(['journeys', 'common']);
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: journey, isLoading: journeyLoading, isError, error, refetch } = useJourney(isNew ? '' : (id || ''));
  const updateJourney = useUpdateJourney();
  const createJourney = useCreateJourney();

  const { data: assignments = [] } = useJourneyAssignments(isNew ? '' : (id || ''));
  const assignmentsPagination = usePagination({ data: assignments, initialPageSize: 10 });
  const { data: employeesRes } = useEmployees({ limit: 10000 });
  const employees = Array.isArray(employeesRes) ? employeesRes : (employeesRes?.employees || []);
  const { data: workspaceSettings } = useWorkspaceSettings();
  const bulkAssignMut = useBulkAssignJourney();
  const issueCertificateMut = useIssueCertificate();

  const availableCategories = workspaceSettings?.categories || ["Engineering", "Sales", "General"];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);

  // Bulk employee selector state
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('all');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [empPage, setEmpPage] = useState(1);
  const [empPageSize, setEmpPageSize] = useState(10);

  // settings & certificate options
  const [allowSkipLessons, setAllowSkipLessons] = useState(false);
  const [requireSequentialCompletion, setRequireSequentialCompletion] = useState(true);
  const [allowRetakes, setAllowRetakes] = useState(true);
  const [maxRetakes, setMaxRetakes] = useState<number>(3);
  const [certificateEnabled, setCertificateEnabled] = useState(false);
  const [passingScore, setPassingScore] = useState<number>(80);

  // Modals state
  const [modals, setModals] = useState<{
    type: 'add_module' | 'add_lesson' | 'confirm_delete_module' | 'confirm_delete_lesson' | 'unsaved_changes' | null;
    moduleId?: string;
    lessonId?: string;
    inputValue1?: string;
    inputValue2?: string;
    onConfirm?: () => void;
  }>({ type: null });

  const [isDirty, setIsDirty] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');
  const [activeTab, setActiveTab] = useState<'settings' | 'builder' | 'assignments'>('settings');

  const handleTabChange = (newTab: 'settings' | 'builder' | 'assignments') => {
    if (isDirty) {
      handleSave(() => setActiveTab(newTab));
    } else {
      setActiveTab(newTab);
    }
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync state with loaded journey
  useEffect(() => {
    if (journey) {
      setTitle(journey.title || '');
      setDescription(journey.description || '');
      setCategory(journey.category || (availableCategories[0] ? availableCategories[0].toLowerCase() : 'engineering'));
      setModules(journey.modules || []);
      setIsPublic(journey.audience?.isPublic || false);
      setAllowSkipLessons(journey.settings?.allowSkipLessons ?? false);
      setRequireSequentialCompletion(journey.settings?.requireSequentialCompletion ?? true);
      setAllowRetakes(journey.settings?.allowRetakes ?? true);
      setMaxRetakes(journey.settings?.maxRetakes ?? 3);
      setCertificateEnabled(journey.certificate?.enabled ?? false);
      setPassingScore(journey.certificate?.passingScore ?? 80);
    }
  }, [journey, availableCategories]);

  // Set default category for new journey
  useEffect(() => {
    if (isNew && !category && availableCategories.length > 0) {
      setCategory(availableCategories[0].toLowerCase());
    }
  }, [isNew, category, availableCategories]);

  // Track if state is dirty
  useEffect(() => {
    if (!journey) return;
    const defaultCat = availableCategories[0] ? availableCategories[0].toLowerCase() : 'engineering';
    const hasChanges =
      title !== (journey.title || '') ||
      description !== (journey.description || '') ||
      category !== (journey.category || defaultCat) ||
      isPublic !== (journey.audience?.isPublic || false) ||
      JSON.stringify(modules) !== JSON.stringify(journey.modules || []) ||
      allowSkipLessons !== (journey.settings?.allowSkipLessons ?? false) ||
      requireSequentialCompletion !== (journey.settings?.requireSequentialCompletion ?? true) ||
      allowRetakes !== (journey.settings?.allowRetakes ?? true) ||
      maxRetakes !== (journey.settings?.maxRetakes ?? 3) ||
      certificateEnabled !== (journey.certificate?.enabled ?? false) ||
      passingScore !== (journey.certificate?.passingScore ?? 80);

    setIsDirty(hasChanges);
    (window as any).isJourneyBuilderDirty = hasChanges;
  }, [
    title,
    description,
    category,
    isPublic,
    modules,
    allowSkipLessons,
    requireSequentialCompletion,
    allowRetakes,
    maxRetakes,
    certificateEnabled,
    passingScore,
    journey,
    availableCategories
  ]);

  // Clean up global flag on unmount
  useEffect(() => {
    return () => {
      (window as any).isJourneyBuilderDirty = false;
    };
  }, []);

  const isLoading = !isNew && journeyLoading;

  const getErrorMessage = (err: any) => {
    const data = err?.response?.data;
    if (data?.errors && Array.isArray(data.errors)) {
      return data.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
    }
    return data?.message || data?.error || err?.message || 'An error occurred';
  };

  const handleSave = (onSuccessCallback?: () => void) => {
    const settings = {
      allowSkipLessons,
      requireSequentialCompletion,
      allowRetakes,
      maxRetakes
    };
    const certificate = {
      enabled: certificateEnabled,
      passingScore
    };

    const journeyPayload = {
      title: title.trim() || 'Untitled Journey',
      description,
      category: category || (availableCategories[0] ? availableCategories[0].toLowerCase() : 'engineering'),
      modules,
      audience: { isPublic },
      settings,
      certificate
    };

    if (isNew) {
      createJourney.mutate(
        journeyPayload,
        {
          onSuccess: (newJourney) => {
            (window as any).isJourneyBuilderDirty = false;
            setIsDirty(false);
            toast.success(t('builder.toasts.draftSaved'));
            navigate(`/journeys/${newJourney.id}`, { replace: true });
            if (onSuccessCallback) onSuccessCallback();
          },
          onError: (err: any) => {
            toast.error(getErrorMessage(err));
          },
        }
      );
    } else if (id) {
      updateJourney.mutate(
        {
          id,
          journey: journeyPayload
        },
        {
          onSuccess: () => {
            (window as any).isJourneyBuilderDirty = false;
            setIsDirty(false);
            toast.success(t('builder.toasts.draftSavedSuccess'));
            if (onSuccessCallback) onSuccessCallback();
          },
          onError: (err: any) => {
            toast.error(getErrorMessage(err));
          },
        }
      );
    }
  };

  const handlePublish = () => {
    if (id) {
      updateJourney.mutate(
        { id, journey: { status: 'Active' } },
        {
          onSuccess: () => {
            toast.success(t('builder.toasts.publishedSuccess'));
          },
          onError: (err: any) => {
            toast.error(err?.message || t('builder.toasts.publishFailed'));
          },
        }
      );
    }
  };

  const handleAddModule = () => {
    setModals({
      type: 'add_module',
      inputValue1: ''
    });
  };

  const handleRemoveModule = (moduleId: string) => {
    setModals({
      type: 'confirm_delete_module',
      moduleId
    });
  };

  const handleAddLesson = (moduleId: string) => {
    setModals({
      type: 'add_lesson',
      moduleId,
      inputValue1: '',
      inputValue2: 'Article'
    });
  };

  const handleRemoveLesson = (moduleId: string, lessonId: string) => {
    setModals({
      type: 'confirm_delete_lesson',
      moduleId,
      lessonId
    });
  };

  const updateSelectedLesson = (fields: Partial<Lesson>) => {
    if (!selectedLessonId) return;
    setModules((prevModules) =>
      prevModules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) =>
          l.id === selectedLessonId ? { ...l, ...fields } : l
        ),
      }))
    );
  };

  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  const updateQuiz = (fields: Partial<NonNullable<Lesson['quiz']>>) => {
    if (!selectedLesson) return;
    const currentQuiz = selectedLesson.quiz || { id: Math.random().toString(36).substring(7), passingScore: 80, questions: [] };
    updateSelectedLesson({
      quiz: {
        ...currentQuiz,
        ...fields
      }
    });
  };

  const handleAddQuestion = () => {
    if (!selectedLesson) return;
    const currentQuiz = selectedLesson.quiz || { id: Math.random().toString(36).substring(7), passingScore: 80, questions: [] };
    const newQuestion = {
      id: Math.random().toString(36).substring(7),
      questionText: 'New Question',
      type: 'single_choice' as const,
      points: 1,
      options: [
        { id: Math.random().toString(36).substring(7), optionText: 'Option 1', isCorrect: true },
        { id: Math.random().toString(36).substring(7), optionText: 'Option 2', isCorrect: false }
      ]
    };
    updateQuiz({
      questions: [...currentQuiz.questions, newQuestion]
    });
  };

  const handleUpdateQuestion = (qId: string, qFields: any) => {
    if (!selectedLesson?.quiz) return;
    const updatedQuestions = selectedLesson.quiz.questions.map((q) =>
      q.id === qId ? { ...q, ...qFields } : q
    );
    updateQuiz({ questions: updatedQuestions });
  };

  const handleRemoveQuestion = (qId: string) => {
    if (!selectedLesson?.quiz) return;
    const updatedQuestions = selectedLesson.quiz.questions.filter((q) => q.id !== qId);
    updateQuiz({ questions: updatedQuestions });
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadPercent(0);

    try {
      const { url } = await uploadService.uploadFile(file, 'public', (pct) => {
        setUploadPercent(pct);
      });
      updateSelectedLesson({ content: url });
      toast.success(t('builder.toasts.fileUploaded'));
    } catch (err: any) {
      toast.error(err?.message || t('builder.toasts.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-6 animate-pulse">
        <header className="flex-none border-b bg-background px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </header>
        <div className="flex-1 bg-muted/10 p-6">
          <Skeleton className="h-full w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError && !isNew) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">{t('builder.error.title')}</h2>
        <p className="text-muted-foreground">{(error as any)?.message || t('builder.error.fallback')}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> {t('builder.error.retry')}
        </Button>
      </div>
    );
  }

  const handleTogglePublic = (publicVal: boolean) => {
    setIsPublic(publicVal);
    if (!isNew && id) {
      const policyLabel = publicVal ? t('builder.toasts.policyPublic') : t('builder.toasts.policyRestricted');
      updateJourney.mutate(
        { id, journey: { audience: { isPublic: publicVal } } },
        {
          onSuccess: () => {
            toast.success(t('builder.toasts.accessUpdated', { policy: policyLabel }));
          },
          onError: (err: any) => {
            toast.error(err?.message || t('builder.toasts.accessUpdateFailed'));
            setIsPublic(!publicVal); // revert
          }
        }
      );
    }
  };

  const handleBulkAssign = () => {
    if (selectedEmpIds.length === 0) {
      toast.error(t('builder.toasts.selectEmployeeRequired'));
      return;
    }
    if (!id || isNew) {
      toast.error(t('builder.toasts.saveJourneyFirst'));
      return;
    }

    bulkAssignMut.mutate(
      { journeyId: id, employeeIds: selectedEmpIds },
      {
        onSuccess: (res: any) => {
          toast.success(t('builder.toasts.bulkAssignedSuccess', { count: res.assignedCount || selectedEmpIds.length }));
          setSelectedEmpIds([]);
        },
        onError: (err: any) => {
          toast.error(err?.message || t('builder.toasts.bulkAssignFailed'));
        }
      }
    );
  };

  // Helper calculations for Bulk Employee Table
  const employeeDepartments = Array.from(
    new Set(employees.map((emp: any) => emp.department || 'General').filter(Boolean))
  );

  const assignedEmployeeIds = new Set(
    assignments.map((assign: any) => {
      return typeof assign.employeeId === 'object' ? assign.employeeId?._id : assign.employeeId;
    })
  );

  const filteredEmployees = employees.filter((emp: any) => {
    const nameMatch = (emp.name || '').toLowerCase().includes(empSearch.toLowerCase());
    const emailMatch = (emp.email || '').toLowerCase().includes(empSearch.toLowerCase());
    const roleMatch = (emp.role || '').toLowerCase().includes(empSearch.toLowerCase());
    const deptMatch = (emp.department || '').toLowerCase().includes(empSearch.toLowerCase());

    const matchesSearch = nameMatch || emailMatch || roleMatch || deptMatch;
    const matchesDept = empDeptFilter === 'all' || (emp.department || 'General').toLowerCase() === empDeptFilter.toLowerCase();

    return matchesSearch && matchesDept;
  });

  const totalEmpCount = filteredEmployees.length;
  const totalEmpPages = Math.ceil(totalEmpCount / empPageSize) || 1;
  const currentEmpPage = Math.min(empPage, totalEmpPages);

  const paginatedEmployees = filteredEmployees.slice(
    (currentEmpPage - 1) * empPageSize,
    currentEmpPage * empPageSize
  );

  const pageUnassignedIds = paginatedEmployees
    .filter((emp: any) => !assignedEmployeeIds.has(emp.id))
    .map((emp: any) => emp.id);

  const isPageAllSelected = pageUnassignedIds.length > 0 && pageUnassignedIds.every((empId: string) => selectedEmpIds.includes(empId));

  const toggleSelectPage = () => {
    if (isPageAllSelected) {
      setSelectedEmpIds((prev) => prev.filter((id) => !pageUnassignedIds.includes(id)));
    } else {
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...pageUnassignedIds])));
    }
  };

  const toggleSelectFilteredAll = () => {
    const allFilteredUnassignedIds = filteredEmployees
      .filter((emp: any) => !assignedEmployeeIds.has(emp.id))
      .map((emp: any) => emp.id);

    if (allFilteredUnassignedIds.length > 0 && allFilteredUnassignedIds.every((empId: string) => selectedEmpIds.includes(empId))) {
      setSelectedEmpIds((prev) => prev.filter((id) => !allFilteredUnassignedIds.includes(id)));
    } else {
      setSelectedEmpIds((prev) => Array.from(new Set([...prev, ...allFilteredUnassignedIds])));
    }
  };

  const handleIssueCertificate = (assignmentId: string) => {
    issueCertificateMut.mutate(
      { assignmentId, journeyId: id || '' },
      {
        onSuccess: () => {
          toast.success(t('builder.toasts.certificateIssuedSuccess'));
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('builder.toasts.certificateIssueFailed'));
        }
      }
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">{t('builder.assignmentsTab.enrollments.statusCompleted')}</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20">{t('builder.assignmentsTab.enrollments.statusInProgress')}</Badge>;
      case 'assigned':
        return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">{t('builder.assignmentsTab.enrollments.statusAssigned')}</Badge>;
      case 'overdue':
        return <Badge className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20">{t('builder.assignmentsTab.enrollments.statusOverdue')}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const allLessons = modules.flatMap((m) => m.lessons);
  const selectedLesson = allLessons.find((l) => l.id === selectedLessonId) || allLessons[0];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-6">
      <header className="flex-none border-b bg-background px-4 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            title={t('builder.header.backTooltip')}
            onClick={() => {
              if (isDirty) {
                setModals({
                  type: 'unsaved_changes',
                  onConfirm: () => navigate('/journeys')
                });
              } else {
                navigate('/journeys');
              }
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">
                {isNew ? (title || t('builder.header.newJourneyFallback')) : (journey?.title || t('builder.header.defaultTitleFallback'))}
              </h1>
              <Badge variant={journey?.status === 'Active' ? 'default' : 'secondary'}>
                {journey?.status === 'Active' ? t('builder.header.statusActive') : t('builder.header.statusDraft')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {isDirty ? (
                <span className="text-amber-500 font-medium">{t('builder.header.unsavedChanges')}</span>
              ) : isNew ? (
                t('builder.header.notSavedYet')
              ) : (
                <span className="text-emerald-500 font-medium">{t('builder.header.draftSaved')}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            onClick={() => handleSave()}
            disabled={updateJourney.isPending || createJourney.isPending}
            className="w-full sm:w-auto"
          >
            {(updateJourney.isPending || createJourney.isPending) ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {updateJourney.isPending || createJourney.isPending
              ? t('builder.header.savingDraft')
              : t('builder.header.saveDraft')}
          </Button>

          {activeTab === 'assignments' ? (
            journey?.status !== 'Active' ? (
              <Button onClick={handlePublish} disabled={updateJourney.isPending || createJourney.isPending} className="w-full sm:w-auto">
                <Check className="mr-2 h-4 w-4" /> {t('builder.header.publishJourney')}
              </Button>
            ) : (
              <Button onClick={() => handleSave(() => navigate('/journeys'))} disabled={updateJourney.isPending || createJourney.isPending} className="w-full sm:w-auto">
                <Check className="mr-2 h-4 w-4" /> {t('builder.header.finish')}
              </Button>
            )
          ) : (
            <Button
              onClick={() => handleSave(() => setActiveTab(activeTab === 'settings' ? 'builder' : 'assignments'))}
              disabled={updateJourney.isPending || createJourney.isPending}
              className="w-full sm:w-auto"
            >
              {t('builder.header.saveAndNext')} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(val) => handleTabChange(val as any)} className="h-full flex flex-col">
          <div className="px-6 border-b">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-muted">
                {t('builder.tabs.settings')}
              </TabsTrigger>
              <TabsTrigger
                value="builder"
                className="data-[state=active]:bg-muted">
                {t('builder.tabs.builder')}
              </TabsTrigger>
              <TabsTrigger
                value="assignments"
                className="data-[state=active]:bg-muted">
                {t('builder.tabs.assignments')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="settings"
            className="flex-1 p-8 m-0 overflow-auto">

            <div className="max-w-2xl mx-auto space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">{t('builder.settingsTab.title')}</h2>
                <div className="space-y-6">
                  <Card className="overflow-visible">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">{t('builder.settingsTab.generalTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('builder.settingsTab.journeyTitleLabel')}</label>
                        <Input value={title} onChange={(e: any) => setTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('builder.settingsTab.descriptionLabel')}</label>
                        <Input value={description} onChange={(e: any) => setDescription(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('builder.settingsTab.categoryLabel')}</label>
                        <SearchableSelect
                          value={category}
                          onChange={setCategory}
                          placeholder={t('builder.settingsTab.categoryPlaceholder')}
                          searchPlaceholder={t('builder.settingsTab.categorySearchPlaceholder')}
                          options={availableCategories.map((cat) => ({
                            value: cat.toLowerCase(),
                            label: cat,
                          }))}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">{t('builder.settingsTab.rulesTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-medium">{t('builder.settingsTab.sequentialTitle')}</label>
                          <p className="text-xs text-muted-foreground">{t('builder.settingsTab.sequentialDesc')}</p>
                        </div>
                        <Switch
                          checked={requireSequentialCompletion}
                          onCheckedChange={setRequireSequentialCompletion}
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-medium">{t('builder.settingsTab.skipTitle')}</label>
                          <p className="text-xs text-muted-foreground">{t('builder.settingsTab.skipDesc')}</p>
                        </div>
                        <Switch
                          checked={allowSkipLessons}
                          onCheckedChange={setAllowSkipLessons}
                        />
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-medium">{t('builder.settingsTab.retakesTitle')}</label>
                          <p className="text-xs text-muted-foreground">{t('builder.settingsTab.retakesDesc')}</p>
                        </div>
                        <Switch
                          checked={allowRetakes}
                          onCheckedChange={setAllowRetakes}
                        />
                      </div>
                      {allowRetakes && (
                        <div className="flex items-center gap-4 pl-6">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">{t('builder.settingsTab.maxRetakesLabel')}</label>
                            <Input
                              type="number"
                              value={maxRetakes}
                              onChange={(e: any) => setMaxRetakes(Number(e.target.value))}
                              className="w-24 h-8"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base font-semibold">{t('builder.settingsTab.certificateTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <label className="text-sm font-medium">{t('builder.settingsTab.awardCertificateTitle')}</label>
                          <p className="text-xs text-muted-foreground">{t('builder.settingsTab.awardCertificateDesc')}</p>
                        </div>
                        <Switch
                          checked={certificateEnabled}
                          onCheckedChange={setCertificateEnabled}
                        />
                      </div>
                      {certificateEnabled && (
                        <div className="space-y-4 pl-6">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">{t('builder.settingsTab.passingScoreLabel')}</label>
                            <Input
                              type="number"
                              value={passingScore}
                              onChange={(e: any) => setPassingScore(Number(e.target.value))}
                              className="w-24 h-8"
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center justify-between pt-6 border-t mt-8">
                  <Button variant="outline" onClick={() => handleSave()} disabled={updateJourney.isPending || createJourney.isPending}>
                    <Save className="mr-2 h-4 w-4" /> {t('builder.settingsTab.saveDraftBtn')}
                  </Button>
                  <Button onClick={() => handleSave(() => setActiveTab('builder'))} disabled={updateJourney.isPending || createJourney.isPending}>
                    {t('builder.settingsTab.saveNextBtn')} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="builder"
            className="flex-1 flex flex-col md:flex-row overflow-hidden m-0 data-[state=active]:flex">

            {/* Left Sidebar - Outline */}
            {(!isMobile || mobileView === 'list') && (
              <div className="w-full md:w-64 flex-none border-r bg-muted/10 flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-medium">{t('builder.curriculum.outlineTitle')}</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title={t('builder.curriculum.addModuleTooltip')} onClick={handleAddModule}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {modules.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground p-4">
                        {t('builder.curriculum.emptyOutline')}
                      </div>
                    ) : (
                      modules.map((module, mIdx) => (
                        <div key={module.id}>
                          {mIdx > 0 && <Separator className="my-2" />}
                          <div>
                            <div className="flex items-center justify-between mb-2 group">
                              <div className="flex items-center gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                                <h4 className="text-sm font-semibold">{mIdx + 1}. {module.title}</h4>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t('builder.curriculum.addLessonTooltip')}
                                  className="h-6 w-6 text-muted-foreground hover:text-indigo-400"
                                  onClick={() => handleAddLesson(module.id)}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={t('builder.curriculum.removeModuleTooltip')}
                                  className="h-6 w-6 text-muted-foreground hover:text-red-400"
                                  onClick={() => handleRemoveModule(module.id)}
                                >
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-1 pl-6">
                              {module.lessons.map((lesson) => {
                                const isSelected = selectedLesson?.id === lesson.id;
                                return (
                                  <div
                                    key={lesson.id}
                                    className={`flex items-center justify-between p-2 rounded-md text-sm cursor-pointer group/lesson ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                                      }`}>
                                    <div className="flex items-center gap-2" onClick={() => {
                                      setSelectedLessonId(lesson.id);
                                      if (isMobile) setMobileView('editor');
                                    }}>
                                      {lesson.type === 'Video' ? (
                                        <Video className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      ) : lesson.type === 'Quiz' ? (
                                        <HelpCircle className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      ) : lesson.type === 'Audio' ? (
                                        <Headphones className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      ) : lesson.type === 'Image' ? (
                                        <ImageIcon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      ) : lesson.type === 'Task' ? (
                                        <CheckSquare className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      ) : lesson.type === 'Document' ? (
                                        <FileSpreadsheet className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      ) : lesson.type === 'PDF' ? (
                                        <FileText className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      ) : (
                                        <BookOpen className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                      )}
                                      <span>{lesson.title}</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title={t('builder.curriculum.removeLessonTooltip')}
                                      className="h-5 w-5 opacity-0 group-hover/lesson:opacity-100 text-muted-foreground hover:text-red-400"
                                      onClick={() => handleRemoveLesson(module.id, lesson.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Main Content Area & Lesson Settings Panel */}
            {(!isMobile || mobileView === 'editor') && (
              <div className="flex-1 min-w-0 flex flex-col md:flex-row bg-background overflow-auto">
                {selectedLesson ? (
                  <>
                    <div className="flex-1 min-w-0 p-4 md:p-8 space-y-6 max-w-3xl mx-auto w-full">
                      {isMobile && (
                        <Button
                          variant="ghost"
                          className="self-start pl-0 text-primary mb-4"
                          onClick={() => setMobileView('list')}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> {t('builder.curriculum.backToCurriculum')}
                        </Button>
                      )}
                      <div>
                        <Input
                          value={selectedLesson.title}
                          onChange={(e: any) => updateSelectedLesson({ title: e.target.value })}
                          className="text-2xl md:text-3xl font-bold h-auto py-2 px-0 border-0 focus-visible:ring-0 rounded-none bg-transparent"
                        />
                        <p className="text-muted-foreground mt-2 text-xs md:text-sm">
                          {t('builder.curriculum.lessonSubheader', {
                            type: t(`builder.curriculum.lessonTypes.${selectedLesson.type.toLowerCase()}` as any, selectedLesson.type),
                            duration: selectedLesson.duration,
                          })}
                        </p>
                      </div>

                      <Card>
                        <CardContent className="p-0">
                          {selectedLesson.type === 'Video' && (
                            <div className="space-y-6 p-6">
                              <div className="space-y-4">
                                <label className="text-sm font-medium">{t('builder.curriculum.videoEditor.title')}</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="border rounded-lg p-4 bg-muted/10 space-y-4 flex flex-col justify-between">
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-medium flex items-center gap-2">
                                        <Upload className="h-4 w-4 text-primary" />
                                        {t('builder.curriculum.videoEditor.uploadTitle')}
                                      </h4>
                                      <p className="text-xs text-muted-foreground">{t('builder.curriculum.videoEditor.uploadDesc')}</p>
                                    </div>
                                    <div>
                                      <input
                                        type="file"
                                        id="video-upload-input"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={handleUploadFile}
                                        disabled={isUploading}
                                      />
                                      <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => document.getElementById('video-upload-input')?.click()}
                                        disabled={isUploading}
                                      >
                                        {isUploading
                                          ? t('builder.curriculum.videoEditor.uploadingPercent', { percent: uploadPercent })
                                          : t('builder.curriculum.videoEditor.chooseFile')}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="border rounded-lg p-4 bg-muted/10 space-y-4 flex flex-col justify-between">
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-medium flex items-center gap-2">
                                        <Link2 className="h-4 w-4 text-primary" />
                                        {t('builder.curriculum.videoEditor.embedTitle')}
                                      </h4>
                                      <p className="text-xs text-muted-foreground">{t('builder.curriculum.videoEditor.embedDesc')}</p>
                                    </div>
                                    <Input
                                      placeholder={t('builder.curriculum.videoEditor.embedPlaceholder')}
                                      value={selectedLesson.content || ''}
                                      onChange={(e: any) => updateSelectedLesson({ content: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>

                              {selectedLesson.content && (
                                <div className="space-y-2">
                                  <label className="text-sm font-medium">{t('builder.curriculum.videoEditor.previewTitle')}</label>
                                  {selectedLesson.content.includes('youtube.com') || selectedLesson.content.includes('youtu.be') ? (
                                    <div className="aspect-video bg-black rounded-lg overflow-hidden border">
                                      <iframe
                                        className="w-full h-full"
                                        src={selectedLesson.content.replace('watch?v=', 'embed/')}
                                        title="YouTube video player"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                      />
                                    </div>
                                  ) : (
                                    <video
                                      src={selectedLesson.content}
                                      controls
                                      className="w-full aspect-video rounded-lg border bg-black"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {(selectedLesson.type === 'Article' || selectedLesson.type === 'Task') && (
                            <div className="space-y-4 p-6">
                              <div className="flex items-center justify-between border-b pb-2">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant={editorTab === 'write' ? 'secondary' : 'ghost'}
                                    onClick={() => setEditorTab('write')}
                                    className="h-8"
                                  >
                                    {t('builder.curriculum.articleEditor.editTab')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={editorTab === 'preview' ? 'secondary' : 'ghost'}
                                    onClick={() => setEditorTab('preview')}
                                    className="h-8"
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    {t('builder.curriculum.articleEditor.previewTab')}
                                  </Button>
                                </div>

                                {editorTab === 'write' && (
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const val = selectedLesson.content || '';
                                        updateSelectedLesson({ content: val + ' **Bold Text** ' });
                                      }}
                                      title={t('builder.curriculum.articleEditor.bold')}
                                    >
                                      <Bold className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const val = selectedLesson.content || '';
                                        updateSelectedLesson({ content: val + ' *Italic Text* ' });
                                      }}
                                      title={t('builder.curriculum.articleEditor.italic')}
                                    >
                                      <Italic className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const val = selectedLesson.content || '';
                                        updateSelectedLesson({ content: val + '\n# Header\n' });
                                      }}
                                      title={t('builder.curriculum.articleEditor.header')}
                                    >
                                      <FileText className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const val = selectedLesson.content || '';
                                        updateSelectedLesson({ content: val + '\n```\nCode Block\n```\n' });
                                      }}
                                      title={t('builder.curriculum.articleEditor.code')}
                                    >
                                      <Code className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        const val = selectedLesson.content || '';
                                        updateSelectedLesson({ content: val + '\n- Bullet item\n' });
                                      }}
                                      title={t('builder.curriculum.articleEditor.list')}
                                    >
                                      <List className="h-4 w-4" />
                                    </Button>
                                    <Separator orientation="vertical" className="h-4 mx-1" />
                                    <input
                                      type="file"
                                      id="article-file-upload"
                                      className="hidden"
                                      onChange={handleUploadFile}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => document.getElementById('article-file-upload')?.click()}
                                      title={t('builder.curriculum.articleEditor.uploadMedia')}
                                    >
                                      <Upload className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {editorTab === 'write' ? (
                                <textarea
                                  placeholder={t('builder.curriculum.articleEditor.markdownPlaceholder')}
                                  className="w-full min-h-[300px] border-0 focus:ring-0 resize-y bg-transparent p-0 outline-none text-sm leading-relaxed"
                                  value={selectedLesson.content || ''}
                                  onChange={(e: any) => updateSelectedLesson({ content: e.target.value })}
                                />
                              ) : (
                                <div className="min-h-[300px] p-2">
                                  <MarkdownPreview content={selectedLesson.content || ''} />
                                </div>
                              )}
                            </div>
                          )}

                          {(selectedLesson.type === 'PDF' || selectedLesson.type === 'Document' || selectedLesson.type === 'Audio' || selectedLesson.type === 'Image') && (
                            <div className="space-y-6 p-6">
                              <div className="space-y-4">
                                <label className="text-sm font-medium">
                                  {t('builder.curriculum.fileEditor.sourceTitle', {
                                    type: t(`builder.curriculum.lessonTypes.${selectedLesson.type.toLowerCase()}` as any, selectedLesson.type),
                                  })}
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="border rounded-lg p-4 bg-muted/10 space-y-4 flex flex-col justify-between">
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-medium flex items-center gap-2">
                                        <Upload className="h-4 w-4 text-primary" />
                                        {t('builder.curriculum.fileEditor.uploadTitle')}
                                      </h4>
                                      <p className="text-xs text-muted-foreground">
                                        {selectedLesson.type === 'PDF' && t('builder.curriculum.fileEditor.uploadPdfDesc')}
                                        {selectedLesson.type === 'Document' && t('builder.curriculum.fileEditor.uploadDocDesc')}
                                        {selectedLesson.type === 'Audio' && t('builder.curriculum.fileEditor.uploadAudioDesc')}
                                        {selectedLesson.type === 'Image' && t('builder.curriculum.fileEditor.uploadImageDesc')}
                                      </p>
                                    </div>
                                    <div>
                                      <input
                                        type="file"
                                        id="file-upload-input-generic"
                                        accept={
                                          selectedLesson.type === 'PDF' ? 'application/pdf' :
                                            selectedLesson.type === 'Document' ? '.doc,.docx,.xls,.xlsx,.ppt,.pptx' :
                                              selectedLesson.type === 'Audio' ? 'audio/*' :
                                                selectedLesson.type === 'Image' ? 'image/*' : '*'
                                        }
                                        className="hidden"
                                        onChange={handleUploadFile}
                                        disabled={isUploading}
                                      />
                                      <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => document.getElementById('file-upload-input-generic')?.click()}
                                        disabled={isUploading}
                                      >
                                        {isUploading
                                          ? t('builder.curriculum.fileEditor.uploadingPercent', { percent: uploadPercent })
                                          : t('builder.curriculum.fileEditor.chooseFile')}
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="border rounded-lg p-4 bg-muted/10 space-y-4 flex flex-col justify-between">
                                    <div className="space-y-1">
                                      <h4 className="text-sm font-medium flex items-center gap-2">
                                        <Link2 className="h-4 w-4 text-primary" />
                                        {t('builder.curriculum.fileEditor.urlTitle')}
                                      </h4>
                                      <p className="text-xs text-muted-foreground">{t('builder.curriculum.fileEditor.urlDesc')}</p>
                                    </div>
                                    <Input
                                      placeholder={t('builder.curriculum.fileEditor.urlPlaceholder')}
                                      value={selectedLesson.content || ''}
                                      onChange={(e: any) => updateSelectedLesson({ content: e.target.value })}
                                    />
                                  </div>
                                </div>
                              </div>

                              {selectedLesson.content && (
                                <div className="space-y-4">
                                  <label className="text-sm font-medium">{t('builder.curriculum.fileEditor.previewTitle')}</label>
                                  <div className="border rounded-lg p-4 bg-muted/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2 overflow-hidden mr-4 min-w-0">
                                      <FileText className="h-5 w-5 text-indigo-400 shrink-0" />
                                      <a
                                        href={selectedLesson.content}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm truncate font-medium text-primary hover:underline"
                                        title={selectedLesson.content}
                                      >
                                        {selectedLesson.content}
                                      </a>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(selectedLesson.content, '_blank')}
                                      className="shrink-0"
                                    >
                                      <ExternalLink className="h-4 w-4 mr-1.5" />
                                      {t('builder.curriculum.fileEditor.openNewTab')}
                                    </Button>
                                  </div>

                                  {(selectedLesson.type === 'PDF' || selectedLesson.content.toLowerCase().includes('.pdf')) && (
                                    <div className="border rounded-xl overflow-hidden bg-muted/10 shadow-sm mt-3">
                                      <div className="p-3 bg-muted/30 border-b flex items-center justify-between">
                                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                          <FileText className="h-4 w-4 text-red-500" />
                                          {t('builder.curriculum.fileEditor.pdfLivePreview')}
                                        </span>
                                        <a
                                          href={selectedLesson.content}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                                        >
                                          {t('builder.curriculum.fileEditor.fullScreen')} <ExternalLink className="h-3 w-3" />
                                        </a>
                                      </div>
                                      <div className="h-[450px] w-full bg-white">
                                        <iframe
                                          src={`${selectedLesson.content}#toolbar=1`}
                                          className="w-full h-full border-none"
                                          title={selectedLesson.title || 'PDF Document Preview'}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {selectedLesson.type === 'Quiz' && (
                            <div className="space-y-6 p-6">
                              <div className="flex items-center justify-between border-b pb-4">
                                <div>
                                  <h4 className="text-sm font-medium">{t('builder.curriculum.quizEditor.title')}</h4>
                                  <p className="text-xs text-muted-foreground">{t('builder.curriculum.quizEditor.desc')}</p>
                                </div>
                                <Button size="sm" onClick={handleAddQuestion}>
                                  <PlusCircle className="h-4 w-4 mr-2" />
                                  {t('builder.curriculum.quizEditor.addQuestion')}
                                </Button>
                              </div>

                              <div className="space-y-6">
                                {(!selectedLesson.quiz || !selectedLesson.quiz.questions || selectedLesson.quiz.questions.length === 0) ? (
                                  <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                                    {t('builder.curriculum.quizEditor.emptyQuestions')}
                                  </div>
                                ) : (
                                  selectedLesson.quiz.questions.map((q, qIdx) => (
                                    <div key={q.id} className="border rounded-lg p-4 space-y-4 bg-muted/10">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3">
                                        <h5 className="text-sm font-semibold">
                                          {t('builder.curriculum.quizEditor.questionNumber', { number: qIdx + 1 })}
                                        </h5>
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-muted-foreground">{t('builder.curriculum.quizEditor.typeLabel')}</span>
                                            <Select
                                              value={q.type || 'single_choice'}
                                              onValueChange={(val: 'single_choice' | 'multiple_choice' | 'true_false' | any) => {
                                                const updatedFields: any = { type: val };
                                                if (val === 'true_false') {
                                                  updatedFields.options = [
                                                    { id: Math.random().toString(36).substring(7), optionText: 'True', isCorrect: true },
                                                    { id: Math.random().toString(36).substring(7), optionText: 'False', isCorrect: false }
                                                  ];
                                                }
                                                handleUpdateQuestion(q.id, updatedFields);
                                              }}
                                            >
                                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="single_choice">
                                                  {t('builder.curriculum.quizEditor.types.singleChoice')}
                                                </SelectItem>
                                                <SelectItem value="multiple_choice">
                                                  {t('builder.curriculum.quizEditor.types.multipleChoice')}
                                                </SelectItem>
                                                <SelectItem value="true_false">
                                                  {t('builder.curriculum.quizEditor.types.trueFalse')}
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-muted-foreground">{t('builder.curriculum.quizEditor.pointsLabel')}</span>
                                            <Input
                                              type="number"
                                              value={q.points || 1}
                                              onChange={(e: any) => handleUpdateQuestion(q.id, { points: Number(e.target.value) })}
                                              className="w-16 h-8 text-xs"
                                            />
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            title={t('builder.curriculum.quizEditor.removeQuestion')}
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                            onClick={() => handleRemoveQuestion(q.id)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        <label className="text-xs font-medium">{t('builder.curriculum.quizEditor.questionTextLabel')}</label>
                                        <Input
                                          value={q.questionText}
                                          onChange={(e: any) => handleUpdateQuestion(q.id, { questionText: e.target.value })}
                                          placeholder={t('builder.curriculum.quizEditor.questionPlaceholder')}
                                        />
                                      </div>

                                      <div className="space-y-3">
                                        <label className="text-xs font-medium flex items-center justify-between">
                                          <span>{t('builder.curriculum.quizEditor.optionsLabel')}</span>
                                          <span className="text-[10px] text-muted-foreground italic">
                                            {q.type === 'multiple_choice' && t('builder.curriculum.quizEditor.multipleChoiceHint')}
                                            {q.type === 'single_choice' && t('builder.curriculum.quizEditor.singleChoiceHint')}
                                            {q.type === 'true_false' && t('builder.curriculum.quizEditor.trueFalseHint')}
                                          </span>
                                        </label>
                                        <div className="space-y-2">
                                          {q.options.map((opt, oIdx) => (
                                            <div key={opt.id} className="flex items-center gap-2">
                                              <input
                                                type={q.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                                                name={`q-builder-${q.id}`}
                                                checked={opt.isCorrect || false}
                                                onChange={(e) => {
                                                  const newOpts = q.options.map((o) => {
                                                    if (o.id === opt.id) return { ...o, isCorrect: e.target.checked };
                                                    // If single choice or true/false, uncheck other choices
                                                    return q.type !== 'multiple_choice' ? { ...o, isCorrect: false } : o;
                                                  });
                                                  handleUpdateQuestion(q.id, { options: newOpts });
                                                }}
                                                className={q.type === 'multiple_choice' ? "rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" : "rounded-full border-gray-300 text-primary focus:ring-primary h-4 w-4"}
                                              />
                                              <Input
                                                value={opt.optionText}
                                                disabled={q.type === 'true_false'}
                                                onChange={(e: any) => {
                                                  const newOpts = q.options.map((o) =>
                                                    o.id === opt.id ? { ...o, optionText: e.target.value } : o
                                                  );
                                                  handleUpdateQuestion(q.id, { options: newOpts });
                                                }}
                                                placeholder={t('builder.curriculum.quizEditor.optionPlaceholder', { number: oIdx + 1 })}
                                                className="flex-1 h-9"
                                              />
                                              {q.type !== 'true_false' && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                  onClick={() => {
                                                    const newOpts = q.options.filter((o) => o.id !== opt.id);
                                                    handleUpdateQuestion(q.id, { options: newOpts });
                                                  }}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        {q.type !== 'true_false' && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              const newOpts = [
                                                ...q.options,
                                                { id: Math.random().toString(36).substring(7), optionText: '', isCorrect: false }
                                              ];
                                              handleUpdateQuestion(q.id, { options: newOpts });
                                            }}
                                            className="h-8 text-xs"
                                          >
                                            {t('builder.curriculum.quizEditor.addOption')}
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          <div className="p-4 border-t bg-muted/10">
                            <label className="text-xs font-medium text-muted-foreground">{t('builder.curriculum.lessonSidebar.lessonDescLabel')}</label>
                            <Input
                              placeholder={t('builder.curriculum.lessonSidebar.lessonDescPlaceholder')}
                              className="border-0 focus-visible:ring-0 px-0 bg-transparent"
                              value={selectedLesson.description || ''}
                              onChange={(e: any) => updateSelectedLesson({ description: e.target.value })}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Right Sidebar - Settings */}
                    <div className="w-full md:w-64 flex-none border-t md:border-t-0 md:border-l bg-muted/10 flex flex-col border-b md:border-b-0">
                      <div className="p-4 border-b">
                        <h3 className="font-medium">{t('builder.curriculum.lessonSidebar.title')}</h3>
                      </div>
                      <div className="p-4 space-y-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('builder.curriculum.lessonSidebar.estimatedTime')}</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={selectedLesson.estimatedTime || 5}
                              onChange={(e: any) => updateSelectedLesson({ estimatedTime: Number(e.target.value) })}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">{t('builder.curriculum.lessonSidebar.minutesLabel')}</span>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('builder.curriculum.lessonSidebar.completionRule')}</label>
                          <Select
                            value={selectedLesson.completionRule || 'video'}
                            onValueChange={(val: any) => updateSelectedLesson({ completionRule: val as any })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="video">{t('builder.curriculum.lessonSidebar.completionRules.video')}</SelectItem>
                              <SelectItem value="button">{t('builder.curriculum.lessonSidebar.completionRules.button')}</SelectItem>
                              <SelectItem value="quiz">{t('builder.curriculum.lessonSidebar.completionRules.quiz')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm p-8">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        className="mb-4 text-primary"
                        onClick={() => setMobileView('list')}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" /> {t('builder.curriculum.backToCurriculum')}
                      </Button>
                    )}
                    {t('builder.curriculum.selectLessonPrompt')}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="assignments"
            className="flex-1 p-8 m-0 overflow-auto">

            <div className="max-w-4xl mx-auto space-y-8">
              {journey?.status !== 'Active' && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">{t('builder.assignmentsTab.draftWarningTitle')}</h4>
                    <p className="text-xs text-amber-500/80 mt-1">
                      {t('builder.assignmentsTab.draftWarningDesc')}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold mb-4">{t('builder.assignmentsTab.visibility.title')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Public Card */}
                  <div
                    onClick={() => handleTogglePublic(true)}
                    className={`cursor-pointer border rounded-xl p-5 transition-all flex items-start gap-4 ${isPublic
                      ? 'border-indigo-600 bg-indigo-50/5 ring-1 ring-indigo-600'
                      : 'border-muted hover:border-muted-foreground/30 bg-card'
                      }`}
                  >
                    <div className={`p-2.5 rounded-lg ${isPublic ? 'bg-indigo-600/10 text-indigo-400' : 'bg-muted text-muted-foreground'}`}>
                      <Globe className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {t('builder.assignmentsTab.visibility.publicTitle')}
                        {isPublic && <Badge className="bg-indigo-600/15 text-indigo-400 border-indigo-600/20">{t('builder.assignmentsTab.visibility.activeBadge')}</Badge>}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('builder.assignmentsTab.visibility.publicDesc')}
                      </p>
                    </div>
                  </div>

                  {/* Restricted Card */}
                  <div
                    onClick={() => handleTogglePublic(false)}
                    className={`cursor-pointer border rounded-xl p-5 transition-all flex items-start gap-4 ${!isPublic
                      ? 'border-indigo-600 bg-indigo-50/5 ring-1 ring-indigo-600'
                      : 'border-muted hover:border-muted-foreground/30 bg-card'
                      }`}
                  >
                    <div className={`p-2.5 rounded-lg ${!isPublic ? 'bg-indigo-600/10 text-indigo-400' : 'bg-muted text-muted-foreground'}`}>
                      <Lock className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {t('builder.assignmentsTab.visibility.restrictedTitle')}
                        {!isPublic && <Badge className="bg-indigo-600/15 text-indigo-400 border-indigo-600/20">{t('builder.assignmentsTab.visibility.activeBadge')}</Badge>}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('builder.assignmentsTab.visibility.restrictedDesc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {!isPublic && (
                <Card>
                  <CardHeader className="pb-3 border-b bg-muted/10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                          <Users className="h-5 w-5 text-indigo-500" />
                          {t('builder.assignmentsTab.bulk.title')}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('builder.assignmentsTab.bulk.desc')}
                        </p>
                      </div>
                      {selectedEmpIds.length > 0 && (
                        <Button
                          onClick={handleBulkAssign}
                          disabled={bulkAssignMut.isPending || (isNew && !id)}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                        >
                          {bulkAssignMut.isPending ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <UserCheck className="mr-2 h-4 w-4" />
                          )}
                          {t('builder.assignmentsTab.bulk.assignSelectedBtn', {
                            count: selectedEmpIds.length,
                            label: selectedEmpIds.length === 1
                              ? t('builder.assignmentsTab.bulk.employeeSingle')
                              : t('builder.assignmentsTab.bulk.employeePlural')
                          })}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {/* Filter Controls Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-6 relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder={t('builder.assignmentsTab.bulk.searchPlaceholder')}
                          value={empSearch}
                          onChange={(e: any) => {
                            setEmpSearch(e.target.value);
                            setEmpPage(1);
                          }}
                          className="pl-9"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <SearchableSelect
                          value={empDeptFilter}
                          onChange={(val) => {
                            setEmpDeptFilter(val || 'all');
                            setEmpPage(1);
                          }}
                          placeholder={t('builder.assignmentsTab.bulk.allDepartments')}
                          searchPlaceholder={t('builder.assignmentsTab.bulk.searchDeptPlaceholder')}
                          options={[
                            { value: 'all', label: t('builder.assignmentsTab.bulk.allDepartments') },
                            ...employeeDepartments.map((dept: any) => ({
                              value: dept.toLowerCase(),
                              label: dept,
                            }))
                          ]}
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <Select value={empPageSize.toString()} onValueChange={(val: any) => { setEmpPageSize(Number(val)); setEmpPage(1); }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('common:pagination.pageSize', 'Page Size')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">{t('builder.assignmentsTab.bulk.pageSizeOption', { size: 10 })}</SelectItem>
                            <SelectItem value="25">{t('builder.assignmentsTab.bulk.pageSizeOption', { size: 25 })}</SelectItem>
                            <SelectItem value="50">{t('builder.assignmentsTab.bulk.pageSizeOption', { size: 50 })}</SelectItem>
                            <SelectItem value="100">{t('builder.assignmentsTab.bulk.pageSizeOption', { size: 100 })}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Batch Selection Action Ribbon */}
                    <div className="flex items-center justify-between text-xs bg-muted/20 p-2.5 px-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleSelectPage}
                          className="h-7 text-xs px-2"
                        >
                          {isPageAllSelected ? <CheckSquare className="h-4 w-4 mr-1.5 text-indigo-500" /> : <Square className="h-4 w-4 mr-1.5" />}
                          {t('builder.assignmentsTab.bulk.selectPage', { count: pageUnassignedIds.length })}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={toggleSelectFilteredAll}
                          className="h-7 text-xs px-2 text-indigo-500 hover:text-indigo-600 font-medium"
                        >
                          {t('builder.assignmentsTab.bulk.selectAllMatched', { count: totalEmpCount })}
                        </Button>

                        {selectedEmpIds.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEmpIds([])}
                            className="h-7 text-xs px-2 text-red-500 hover:text-red-600"
                          >
                            {t('builder.assignmentsTab.bulk.clearSelection')}
                          </Button>
                        )}
                      </div>

                      <span className="font-semibold text-muted-foreground">
                        {t('builder.assignmentsTab.bulk.selectedCount', { count: selectedEmpIds.length })}
                      </span>
                    </div>

                    {/* Pageable Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-muted/30 text-xs font-semibold text-muted-foreground uppercase border-b">
                          <tr>
                            <th className="p-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={isPageAllSelected && pageUnassignedIds.length > 0}
                                onChange={toggleSelectPage}
                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                              />
                            </th>
                            <th className="p-3">{t('builder.assignmentsTab.bulk.tableHeaders.employee')}</th>
                            <th className="p-3">{t('builder.assignmentsTab.bulk.tableHeaders.department')}</th>
                            <th className="p-3">{t('builder.assignmentsTab.bulk.tableHeaders.role')}</th>
                            <th className="p-3 text-right">{t('builder.assignmentsTab.bulk.tableHeaders.status')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {paginatedEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-8 text-center text-muted-foreground text-xs">
                                {t('builder.assignmentsTab.bulk.noEmployeesFound')}
                              </td>
                            </tr>
                          ) : (
                            paginatedEmployees.map((emp: any) => {
                              const isAssigned = assignedEmployeeIds.has(emp.id);
                              const isSelected = selectedEmpIds.includes(emp.id);

                              return (
                                <tr
                                  key={emp.id}
                                  className={`hover:bg-muted/10 transition-colors ${isSelected ? 'bg-indigo-500/5' : ''}`}
                                >
                                  <td className="p-3 text-center">
                                    <input
                                      type="checkbox"
                                      disabled={isAssigned}
                                      checked={isSelected || isAssigned}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedEmpIds((prev) => [...prev, emp.id]);
                                        } else {
                                          setSelectedEmpIds((prev) => prev.filter((id) => id !== emp.id));
                                        }
                                      }}
                                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 disabled:opacity-50"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <div className="font-medium text-foreground">{emp.name}</div>
                                    <div className="text-xs text-muted-foreground">{emp.email}</div>
                                  </td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="capitalize text-xs font-normal">
                                      {emp.department || 'General'}
                                    </Badge>
                                  </td>
                                  <td className="p-3">
                                    <span className="text-xs text-muted-foreground capitalize">{emp.role}</span>
                                  </td>
                                  <td className="p-3 text-right">
                                    {isAssigned ? (
                                      <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs font-normal">
                                        {t('builder.assignmentsTab.bulk.assignedBadge')}
                                      </Badge>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs font-normal">
                                        {t('builder.assignmentsTab.bulk.availableBadge')}
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Pagination Footer */}
                    <div className="pt-2">
                      <SimplePagination
                        currentPage={currentEmpPage}
                        totalPages={totalEmpPages}
                        totalItems={totalEmpCount}
                        startIndex={totalEmpCount === 0 ? 0 : (currentEmpPage - 1) * empPageSize + 1}
                        endIndex={Math.min(currentEmpPage * empPageSize, totalEmpCount)}
                        pageSize={empPageSize}
                        onPageChange={setEmpPage}
                        onPageSizeChange={(newSize) => {
                          setEmpPageSize(newSize);
                          setEmpPage(1);
                        }}
                        itemLabel={t('builder.assignmentsTab.bulk.itemLabel')}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {isPublic
                      ? t('builder.assignmentsTab.enrollments.titlePublic')
                      : t('builder.assignmentsTab.enrollments.titleRestricted')}
                  </h3>
                  <Badge variant="outline">
                    {t('builder.assignmentsTab.enrollments.personCount', { count: assignments.length })}
                  </Badge>
                </div>

                {assignments.length === 0 ? (
                  <Card>
                    <CardContent className="p-0">
                      <div className="p-8 text-center text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">{t('builder.assignmentsTab.enrollments.emptyTitle')}</p>
                        <p className="text-sm mt-1">
                          {isPublic
                            ? t('builder.assignmentsTab.enrollments.emptyPublicDesc')
                            : t('builder.assignmentsTab.enrollments.emptyRestrictedDesc')}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead>
                            <tr className="border-b bg-muted/20 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                              <th className="px-6 py-3 border-b">{t('builder.assignmentsTab.enrollments.tableHeaders.employee')}</th>
                              <th className="px-6 py-3 border-b">{t('builder.assignmentsTab.enrollments.tableHeaders.status')}</th>
                              <th className="px-6 py-3 border-b">{t('builder.assignmentsTab.enrollments.tableHeaders.progress')}</th>
                              <th className="px-6 py-3 border-b">{t('builder.assignmentsTab.enrollments.tableHeaders.assignedDate')}</th>
                              <th className="px-6 py-3 border-b text-right">{t('builder.assignmentsTab.enrollments.tableHeaders.actions')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {assignmentsPagination.paginatedData.map((assign: any) => {
                              const emp = assign.employeeId;
                              const name = emp?.profile ? `${emp.profile.firstName} ${emp.profile.lastName}` : 'Unknown';
                              const email = emp?.auth?.email || 'N/A';
                              const percentage = assign.progress?.completionPercentage || 0;

                              return (
                                <tr key={assign._id} className="hover:bg-muted/5">
                                  <td className="px-6 py-4">
                                    <div className="font-medium">{name}</div>
                                    <div className="text-xs text-muted-foreground">{email}</div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {getStatusBadge(assign.status)}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 max-w-[200px]">
                                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                        <div
                                          className="bg-indigo-600 h-1.5 rounded-full"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground font-medium">{percentage}%</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-muted-foreground text-xs">
                                    {new Date(assign.assignment?.assignedAt || assign.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {assign.status === 'completed' ? (
                                      assign.certificate?.issued ? (
                                        <div className="flex items-center justify-end gap-2">
                                          <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                                            {t('builder.assignmentsTab.enrollments.issuedBadge')}
                                          </Badge>
                                          <a
                                            href={`/public/certificate/${assign._id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-indigo-400 hover:text-indigo-300 underline font-normal text-xs"
                                          >
                                            {t('builder.assignmentsTab.enrollments.viewCertificate')}
                                          </a>
                                        </div>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2 text-xs"
                                          onClick={() => handleIssueCertificate(assign._id)}
                                          disabled={issueCertificateMut.isPending}
                                        >
                                          {issueCertificateMut.isPending
                                            ? t('builder.assignmentsTab.enrollments.issuingCertificate')
                                            : t('builder.assignmentsTab.enrollments.issueCertificateBtn')}
                                        </Button>
                                      )
                                    ) : (
                                      <span className="text-muted-foreground text-xs italic">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="p-3 border-t">
                        <SimplePagination
                          currentPage={assignmentsPagination.page}
                          totalPages={assignmentsPagination.totalPages}
                          totalItems={assignmentsPagination.totalItems}
                          startIndex={assignmentsPagination.startIndex}
                          endIndex={assignmentsPagination.endIndex}
                          pageSize={assignmentsPagination.pageSize}
                          onPageChange={assignmentsPagination.setPage}
                          onPageSizeChange={assignmentsPagination.setPageSize}
                          itemLabel={t('builder.assignmentsTab.enrollments.itemLabel')}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-center justify-between pt-6 border-t mt-8">
                  <Button variant="outline" onClick={() => setActiveTab('builder')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> {t('builder.assignmentsTab.enrollments.prevBuilderBtn')}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleSave()} disabled={updateJourney.isPending || createJourney.isPending}>
                      <Save className="mr-2 h-4 w-4" /> {t('builder.header.saveDraft')}
                    </Button>
                    {journey?.status !== 'Active' ? (
                      <Button onClick={handlePublish} disabled={updateJourney.isPending || createJourney.isPending}>
                        <Check className="mr-2 h-4 w-4" /> {t('builder.assignmentsTab.enrollments.savePublishBtn')}
                      </Button>
                    ) : (
                      <Button onClick={() => handleSave(() => navigate('/journeys'))} disabled={updateJourney.isPending || createJourney.isPending}>
                        <Check className="mr-2 h-4 w-4" /> {t('builder.assignmentsTab.enrollments.finishExitBtn')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Custom Dialogs */}
      <Dialog open={modals.type === 'add_module'} onOpenChange={(open: boolean) => !open && setModals({ type: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('builder.modals.addModule.title')}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('builder.modals.addModule.label')}</label>
              <Input
                value={modals.inputValue1 || ''}
                onChange={(e: any) => setModals({ ...modals, inputValue1: e.target.value })}
                placeholder={t('builder.modals.addModule.placeholder')}
                autoFocus
                onKeyDown={(e: any) => {
                  if (e.key === 'Enter' && modals.inputValue1) {
                    const newModule: CourseModule = {
                      id: Math.random().toString(36).substring(2, 9),
                      title: modals.inputValue1,
                      lessons: [],
                    };
                    setModules([...modules, newModule]);
                    setModals({ type: null });
                  }
                }}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModals({ type: null })}>{t('builder.modals.addModule.cancel')}</Button>
            <Button
              onClick={() => {
                const titleVal = modals.inputValue1;
                if (titleVal) {
                  const newModule: CourseModule = {
                    id: Math.random().toString(36).substring(2, 9),
                    title: titleVal,
                    lessons: [],
                  };
                  setModules([...modules, newModule]);
                  setModals({ type: null });
                }
              }}
              disabled={!modals.inputValue1}
            >
              {t('builder.modals.addModule.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modals.type === 'add_lesson'} onOpenChange={(open: boolean) => !open && setModals({ type: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('builder.modals.addLesson.title')}</DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('builder.modals.addLesson.titleLabel')}</label>
              <Input
                value={modals.inputValue1 || ''}
                onChange={(e: any) => setModals({ ...modals, inputValue1: e.target.value })}
                placeholder={t('builder.modals.addLesson.titlePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('builder.modals.addLesson.typeLabel')}</label>
              <Select
                value={modals.inputValue2 || 'Article'}
                onValueChange={(val: any) => setModals({ ...modals, inputValue2: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Article">{t('builder.curriculum.lessonTypes.article')}</SelectItem>
                  <SelectItem value="Video">{t('builder.curriculum.lessonTypes.video')}</SelectItem>
                  <SelectItem value="Quiz">{t('builder.curriculum.lessonTypes.quiz')}</SelectItem>
                  <SelectItem value="PDF">{t('builder.curriculum.lessonTypes.pdf')}</SelectItem>
                  <SelectItem value="Document">{t('builder.curriculum.lessonTypes.document')}</SelectItem>
                  <SelectItem value="Audio">{t('builder.curriculum.lessonTypes.audio')}</SelectItem>
                  <SelectItem value="Image">{t('builder.curriculum.lessonTypes.image')}</SelectItem>
                  <SelectItem value="Task">{t('builder.curriculum.lessonTypes.task')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModals({ type: null })}>{t('builder.modals.addLesson.cancel')}</Button>
            <Button
              onClick={() => {
                const titleVal = modals.inputValue1;
                const typeVal = modals.inputValue2 || 'Article';
                if (titleVal && modals.moduleId) {
                  const newLesson: Lesson = {
                    id: Math.random().toString(36).substring(2, 9),
                    title: titleVal,
                    type: typeVal as any,
                    duration: '5 min',
                    isCompleted: false,
                    description: '',
                    content: '',
                    estimatedTime: 5,
                    completionRule: typeVal === 'Video' ? 'video' : (typeVal === 'Quiz' ? 'quiz' : 'button'),
                  };

                  setModules(
                    modules.map((m) => {
                      if (m.id === modals.moduleId) {
                        return {
                          ...m,
                          lessons: [...m.lessons, newLesson],
                        };
                      }
                      return m;
                    })
                  );
                  setSelectedLessonId(newLesson.id);
                  setModals({ type: null });
                }
              }}
              disabled={!modals.inputValue1}
            >
              {t('builder.modals.addLesson.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modals.type === 'confirm_delete_module' || modals.type === 'confirm_delete_lesson'} onOpenChange={(open: boolean) => !open && setModals({ type: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('builder.modals.confirmDelete.title')}</DialogTitle>
          </DialogHeader>

          <DialogBody className="text-sm text-muted-foreground">
            {modals.type === 'confirm_delete_module'
              ? t('builder.modals.confirmDelete.moduleDesc')
              : t('builder.modals.confirmDelete.lessonDesc')}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModals({ type: null })}>{t('builder.modals.confirmDelete.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (modals.type === 'confirm_delete_module' && modals.moduleId) {
                  setModules(modules.filter((m) => m.id !== modals.moduleId));
                  setSelectedLessonId(null);
                } else if (modals.type === 'confirm_delete_lesson' && modals.moduleId && modals.lessonId) {
                  setModules(
                    modules.map((m) => {
                      if (m.id === modals.moduleId) {
                        return {
                          ...m,
                          lessons: m.lessons.filter((l) => l.id !== modals.lessonId),
                        };
                      }
                      return m;
                    })
                  );
                  if (selectedLessonId === modals.lessonId) {
                    setSelectedLessonId(null);
                  }
                }
                setModals({ type: null });
              }}
            >
              {t('builder.modals.confirmDelete.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modals.type === 'unsaved_changes'} onOpenChange={(open: boolean) => !open && setModals({ type: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('builder.modals.unsavedChanges.title')}</DialogTitle>
          </DialogHeader>

          <DialogBody className="text-sm text-muted-foreground">
            {t('builder.modals.unsavedChanges.desc')}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModals({ type: null })}>{t('builder.modals.unsavedChanges.stay')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setModals({ type: null });
                if (modals.onConfirm) {
                  modals.onConfirm();
                }
              }}
            >
              {t('builder.modals.unsavedChanges.discard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderFormattedText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 break-all font-medium"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function MarkdownPreview({ content }: { content: string }) {
  const { t } = useTranslation('journeys');
  if (!content) return <p className="text-muted-foreground italic text-sm">{t('builder.curriculum.articleEditor.emptyMarkdown')}</p>;

  const lines = content.split('\n');
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert space-y-4">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          return <h1 key={idx} className="text-2xl font-bold tracking-tight border-b pb-2 mt-6">{renderFormattedText(trimmed.slice(2))}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx} className="text-xl font-semibold mt-5">{renderFormattedText(trimmed.slice(3))}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={idx} className="text-lg font-semibold mt-4">{renderFormattedText(trimmed.slice(4))}</h3>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <ul key={idx} className="list-disc pl-6 space-y-1">
              <li>{renderFormattedText(trimmed.slice(2))}</li>
            </ul>
          );
        }
        if (trimmed.startsWith('> ')) {
          return <blockquote key={idx} className="border-l-4 border-primary pl-4 italic my-2 bg-muted/30 py-1 rounded-r">{renderFormattedText(trimmed.slice(2))}</blockquote>;
        }
        if (trimmed.startsWith('```')) {
          if (trimmed === '```') return null;
          return <pre key={idx} className="bg-muted p-3 rounded-md font-mono text-xs overflow-x-auto border">{trimmed.replace(/```/g, '')}</pre>;
        }
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }
        return <p key={idx} className="leading-relaxed">{renderFormattedText(trimmed)}</p>;
      })}
    </div>
  );
}

export default JourneyBuilder;