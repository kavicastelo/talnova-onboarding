import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Badge } from '../components/Badge';
import { Skeleton } from '../components/Skeleton';
import {
  Wand2,
  Sparkles,
  BookOpen,
  HelpCircle,
  CheckCircle,
  RefreshCw,
  Trash2,
  Layers,
  UploadCloud,
  FileText,
  Edit2,
  Check,
  Save,
} from 'lucide-react';
import {
  useGenerateCourse,
  useCourseDrafts,
  usePublishCourseDraft,
  useRegenerateModule,
  useDeleteCourseDraft,
  useSaveCourseToLMS,
} from '../hooks/useAICourseBuilder';
import { useOrganizationCapabilities } from '../hooks/useOrganizationCapabilities';
import { useRole } from '../context/RoleContext';
import { AICourseDraftData } from '../services/ai-course.service';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function AICourseBuilder() {
  const { t } = useTranslation('journeys');
  const navigate = useNavigate();
  const { role } = useRole();
  const isOrgAdmin = role === 'admin' || role === 'owner' || role === 'super_admin' || role === 'hr_admin';
  const { isAIAvailable, aiReason } = useOrganizationCapabilities();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState('');
  const [targetRole, setTargetRole] = useState('All Employees');
  const [department, setDepartment] = useState('General');
  const [level, setLevel] = useState('Intermediate');
  const [moduleCount, setModuleCount] = useState('3');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Active editable draft state
  const [activeDraft, setActiveDraft] = useState<AICourseDraftData | null>(null);
  const [editingModuleIdx, setEditingModuleIdx] = useState<number | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState('');

  const { data: drafts, isLoading: isDraftsLoading } = useCourseDrafts();
  const generateCourseMutation = useGenerateCourse();
  const publishDraftMutation = usePublishCourseDraft();
  const regenerateModuleMutation = useRegenerateModule();
  const deleteDraftMutation = useDeleteCourseDraft();
  const saveCourseMutation = useSaveCourseToLMS();

  // Set latest draft as active if none selected
  useEffect(() => {
    if (drafts && drafts.length > 0 && !activeDraft) {
      setActiveDraft(drafts[0]);
    }
  }, [drafts, activeDraft]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    // Parse file content or use filename as policy document prompt
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && content.length > 0) {
        setPrompt(`Policy Document (${file.name}): ${content.slice(0, 300)}`);
      } else {
        setPrompt(`Document Policy: ${file.name.replace(/\.[^/.]+$/, '')}`);
      }
      toast.success(t('aiBuilder.toasts.attachedDoc', { name: file.name, defaultValue: `Attached document: ${file.name}` }));
    };
    reader.readAsText(file);
  };

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error(t('aiBuilder.toasts.promptRequired', { defaultValue: 'Please enter a course prompt or upload a policy document.' }));
      return;
    }

    generateCourseMutation.mutate(
      {
        prompt,
        targetRole,
        department,
        level,
        moduleCount: parseInt(moduleCount, 10) || 3,
      },
      {
        onSuccess: (newDraft) => {
          toast.success(t('aiBuilder.toasts.generatedSuccess', { title: newDraft.title, defaultValue: `AI generated course draft "${newDraft.title}"!` }));
          setActiveDraft(newDraft);
        },
        onError: (err: any) => {
          toast.error(
            err?.response?.data?.message || err?.message || t('aiBuilder.toasts.generateFailed', { defaultValue: 'Failed to generate AI course draft' })
          );
        },
      }
    );
  };

  const handleStartEditModule = (idx: number, currentTitle: string) => {
    setEditingModuleIdx(idx);
    setEditingModuleTitle(currentTitle);
  };

  const handleSaveModuleTitle = (idx: number) => {
    if (!activeDraft) return;
    const updatedModules = [...activeDraft.modules];
    updatedModules[idx] = {
      ...updatedModules[idx],
      title: editingModuleTitle,
    };
    setActiveDraft({
      ...activeDraft,
      modules: updatedModules,
    });
    setEditingModuleIdx(null);
    toast.success(t('aiBuilder.toasts.moduleTitleUpdated', { index: idx + 1, title: editingModuleTitle, defaultValue: `Module ${idx + 1} title updated to "${editingModuleTitle}"` }));
  };

  const handleSaveToLMS = () => {
    if (!activeDraft) {
      toast.error(t('aiBuilder.toasts.noDraftToSave', { defaultValue: 'No course draft available to save' }));
      return;
    }

    // Convert draft to LMS Course / Journey structure
    const coursePayload = {
      title: activeDraft.title,
      description: activeDraft.description || 'Synthesized course generated via AI Course Builder',
      category: activeDraft.department || 'Compliance & Security',
      tags: ['AI-Generated', 'LMS-Course', activeDraft.targetRole || 'Compliance'],
      modules: activeDraft.modules.map((mod, mIdx) => ({
        title: mod.title,
        description: mod.description || '',
        order: mIdx + 1,
        estimatedDurationMinutes:
          mod.lessons?.reduce((acc, l) => acc + (l.durationMinutes || 10), 0) || 15,
        lessons: mod.lessons.map((lesson, lIdx) => {
          const hasQuiz = lesson.quizQuestions && lesson.quizQuestions.length > 0;
          return {
            title: lesson.title,
            description: lesson.content || lesson.title,
            order: lIdx + 1,
            estimatedDurationMinutes: lesson.durationMinutes || 10,
            contentBlocks: [
              {
                type: 'text',
                title: lesson.title,
                content: lesson.content || 'Lesson content overview',
                order: 1,
              },
            ],
            completionRules: {
              requireContentCompletion: true,
              requireQuizCompletion: hasQuiz,
            },
            quiz: hasQuiz
              ? {
                  title: `${lesson.title} Assessment`,
                  passingScore: 80,
                  questions: lesson.quizQuestions.map((q) => ({
                    type: 'single_choice',
                    question: q.questionText,
                    points: 1,
                    options: q.options.map((opt, optIdx) => ({
                      text: opt,
                      isCorrect: optIdx === q.correctOptionIndex,
                    })),
                    explanation: q.explanation || '',
                  })),
                }
              : undefined,
          };
        }),
      })),
    };

    saveCourseMutation.mutate(coursePayload, {
      onSuccess: () => {
        toast.success(t('aiBuilder.toasts.courseSavedSuccess', { defaultValue: 'Course saved successfully' }));
        navigate('/journeys');
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || t('aiBuilder.toasts.saveCourseFailed', { defaultValue: 'Failed to save course to LMS' }));
      },
    });
  };

  const handlePublish = (draftId: string) => {
    publishDraftMutation.mutate(draftId, {
      onSuccess: () => {
        toast.success(t('aiBuilder.toasts.publishedSuccess', { defaultValue: 'Course draft published to live Journeys!' }));
        navigate('/journeys');
      },
      onError: () => {
        toast.error(t('aiBuilder.toasts.publishFailed', { defaultValue: 'Failed to publish draft to journeys' }));
      },
    });
  };

  const handleRegenerateModule = (draftId: string, moduleId: string) => {
    regenerateModuleMutation.mutate(
      { draftId, moduleId },
      {
        onSuccess: () => {
          toast.success(t('aiBuilder.toasts.moduleRegenerated', { defaultValue: 'Module content regenerated with AI!' }));
        },
      }
    );
  };

  const handleDeleteDraft = (draftId: string) => {
    deleteDraftMutation.mutate(draftId, {
      onSuccess: () => {
        toast.success(t('aiBuilder.toasts.draftDeleted', { defaultValue: 'Course draft deleted.' }));
        if (activeDraft?._id === draftId) {
          setActiveDraft(null);
        }
      },
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wand2 className="h-7 w-7 text-indigo-600" />
          {t('aiBuilder.title', { defaultValue: 'AI Course & Journey Builder' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('aiBuilder.subtitle', { defaultValue: 'Generate full onboarding curriculum, lesson content, and quizzes grounded in company knowledge with 1-click human review approval.' })}
        </p>
      </div>

      {!isAIAvailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm" data-testid="ai-capability-course-banner">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <span className="font-semibold text-foreground">{t('aiBuilder.banner.blockedLabel', { defaultValue: 'Course Synthesis Blocked: ' })}</span>
              <span className="text-muted-foreground">
                {aiReason || t('aiBuilder.banner.defaultReason', { defaultValue: 'An AI provider integration must be configured for your organization before courses can be synthesized.' })}
              </span>
            </div>
          </div>
          {isOrgAdmin ? (
            <Button
              size="sm"
              onClick={() => navigate('/settings?tab=ai')}
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {t('aiBuilder.banner.configureBtn', { defaultValue: 'Configure AI in Settings' })}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('aiBuilder.banner.contactAdmin', { defaultValue: 'Please contact your administrator to configure an AI provider.' })}
            </span>
          )}
        </div>
      )}

      {/* Prompt Generator Card */}
      <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-background to-background shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            {t('aiBuilder.generator.cardTitle', { defaultValue: 'AI Onboarding Curriculum Generator' })}
          </CardTitle>
          <CardDescription>
            {t('aiBuilder.generator.cardDesc', { defaultValue: 'Enter a role, topic, or upload a policy document to synthesize a structured learning course.' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-muted-foreground">
                {t('aiBuilder.generator.topicLabel', { defaultValue: 'Onboarding Topic, Policy Document, or Prompt' })}
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {uploadedFileName ? t('aiBuilder.generator.attachedFile', { name: uploadedFileName, defaultValue: `Attached: ${uploadedFileName}` }) : t('aiBuilder.generator.uploadFile', { defaultValue: 'Upload Policy File' })}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                data-testid="policy-file-input"
                className="hidden"
                accept=".txt,.pdf,.csv,.doc,.docx"
                onChange={handleFileUpload}
              />
            </div>
            <Input
              data-testid="course-prompt-input"
              placeholder={t('aiBuilder.generator.promptPlaceholder', { defaultValue: 'e.g. Enterprise Data Privacy & GDPR Guidelines for 2026' })}
              value={prompt}
              onChange={(e: any) => setPrompt(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('aiBuilder.generator.targetRole', { defaultValue: 'Target Role' })}</label>
              <Input
                data-testid="target-role-input"
                placeholder={t('aiBuilder.generator.rolePlaceholder', { defaultValue: 'e.g. All Employees' })}
                value={targetRole}
                onChange={(e: any) => setTargetRole(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('aiBuilder.generator.department', { defaultValue: 'Department' })}</label>
              <Input
                data-testid="department-input"
                placeholder={t('aiBuilder.generator.deptPlaceholder', { defaultValue: 'e.g. Compliance' })}
                value={department}
                onChange={(e: any) => setDepartment(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('aiBuilder.generator.courseLevel', { defaultValue: 'Course Level' })}</label>
              <select
                data-testid="course-level-select"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Beginner">{t('aiBuilder.generator.levels.beginner', { defaultValue: 'Beginner' })}</option>
                <option value="Intermediate">{t('aiBuilder.generator.levels.intermediate', { defaultValue: 'Intermediate' })}</option>
                <option value="Advanced">{t('aiBuilder.generator.levels.advanced', { defaultValue: 'Advanced' })}</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{t('aiBuilder.generator.modules', { defaultValue: 'Modules' })}</label>
              <select
                data-testid="course-modules-select"
                value={moduleCount}
                onChange={(e) => setModuleCount(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="2">{t('aiBuilder.generator.moduleOption', { count: 2, defaultValue: '2 Modules' })}</option>
                <option value="3">{t('aiBuilder.generator.moduleOption', { count: 3, defaultValue: '3 Modules' })}</option>
                <option value="4">{t('aiBuilder.generator.moduleOption', { count: 4, defaultValue: '4 Modules' })}</option>
                <option value="5">{t('aiBuilder.generator.moduleOption', { count: 5, defaultValue: '5 Modules' })}</option>
              </select>
            </div>
          </div>

          <Button
            data-testid="generate-course-btn"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleGenerate}
            disabled={!isAIAvailable || generateCourseMutation.isPending || !prompt.trim()}
          >
            {!isAIAvailable ? (
              <>
                <Wand2 className="h-4 w-4 mr-2" /> {t('aiBuilder.generator.btnBlocked', { defaultValue: 'AI Configuration Required to Generate Course' })}
              </>
            ) : generateCourseMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> {t('aiBuilder.generator.btnSynthesizing', { defaultValue: 'Synthesizing Course & Quizzes...' })}
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" /> {t('aiBuilder.generator.btnGenerate', { defaultValue: 'Generate Course Draft' })}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Interactive Course Preview & Editor */}
      {activeDraft && (
        <div className="space-y-4" data-testid="course-preview-editor">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                {t('aiBuilder.editor.title', { defaultValue: 'Course Draft Preview & Editor' })}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('aiBuilder.editor.subtitle', { defaultValue: 'Review generated syllabus, edit module titles, and save the course directly to the LMS.' })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="save-course-lms-btn"
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                onClick={handleSaveToLMS}
                disabled={saveCourseMutation.isPending}
              >
                {saveCourseMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" /> {t('aiBuilder.editor.savingToLMS', { defaultValue: 'Saving Course...' })}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1.5" /> {t('aiBuilder.editor.saveToLMS', { defaultValue: 'Save Course to LMS' })}
                  </>
                )}
              </Button>
              {activeDraft.status !== 'published' && (
                <Button
                  data-testid="publish-journey-btn"
                  variant="outline"
                  className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handlePublish(activeDraft._id)}
                  disabled={publishDraftMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" /> {t('aiBuilder.editor.approveAndPublish', { defaultValue: 'Approve & Publish' })}
                </Button>
              )}
            </div>
          </div>

          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg font-bold" data-testid="draft-title">
                    {activeDraft.title}
                  </CardTitle>
                  <CardDescription className="mt-1">{activeDraft.description}</CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="bg-indigo-500/10 text-indigo-700 border-indigo-500/30"
                >
                  {t('aiBuilder.editor.modulesGenerated', { count: activeDraft.modules.length, defaultValue: `${activeDraft.modules.length} Modules Generated` })}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {activeDraft.modules.map((mod, mIdx) => (
                <div
                  key={mod.moduleId || mIdx}
                  data-testid={`preview-module-${mIdx + 1}`}
                  className="p-5 bg-muted/10 border rounded-lg space-y-4"
                >
                  {/* Module Header with Inline Edit */}
                  <div className="flex justify-between items-center border-b pb-3">
                    <div className="flex-1 mr-4">
                      {editingModuleIdx === mIdx ? (
                        <div className="flex items-center gap-2">
                          <Input
                            data-testid={`edit-module-input-${mIdx + 1}`}
                            value={editingModuleTitle}
                            onChange={(e) => setEditingModuleTitle(e.target.value)}
                            className="h-8 text-sm max-w-md"
                            autoFocus
                          />
                          <Button
                            data-testid={`save-module-title-btn-${mIdx + 1}`}
                            size="sm"
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => handleSaveModuleTitle(mIdx)}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> {t('aiBuilder.editor.saveModuleTitle', { defaultValue: 'Save' })}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                            {t('aiBuilder.editor.moduleIndex', { index: mIdx + 1, defaultValue: `Module ${mIdx + 1}:` })}
                          </span>
                          <h4
                            className="font-bold text-sm text-foreground"
                            data-testid={`module-title-${mIdx + 1}`}
                          >
                            {mod.title}
                          </h4>
                          <button
                            type="button"
                            data-testid={`edit-module-btn-${mIdx + 1}`}
                            onClick={() => handleStartEditModule(mIdx, mod.title)}
                            className="text-muted-foreground hover:text-indigo-600 p-1"
                            title={t('aiBuilder.editor.editModuleTitle', { defaultValue: 'Edit Module Title' })}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                    </div>

                    {activeDraft._id && activeDraft.status !== 'published' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs shrink-0"
                        onClick={() => handleRegenerateModule(activeDraft._id, mod.moduleId)}
                        disabled={regenerateModuleMutation.isPending}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" /> {t('aiBuilder.editor.regenerateBtn', { defaultValue: 'Regenerate' })}
                      </Button>
                    )}
                  </div>

                  {/* Lessons & Quizzes */}
                  <div className="space-y-3 pl-2">
                    {mod.lessons.map((lesson, lIdx) => (
                      <div
                        key={lesson.lessonId || lIdx}
                        className="p-3 bg-card border rounded-md text-xs space-y-2 shadow-xs"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <BookOpen className="h-4 w-4 text-indigo-600" />
                            {lesson.title} ({t('aiBuilder.editor.minsDuration', { minutes: lesson.durationMinutes, defaultValue: `${lesson.durationMinutes} mins` })})
                          </span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{lesson.content}</p>

                        {/* Quiz Questions */}
                        {lesson.quizQuestions && lesson.quizQuestions.length > 0 && (
                          <div
                            className="pt-2 border-t mt-2 space-y-2"
                            data-testid={`module-${mIdx + 1}-quiz`}
                          >
                            <div className="font-semibold text-amber-600 flex items-center gap-1">
                              <HelpCircle className="h-3.5 w-3.5" /> {t('aiBuilder.editor.quizAssessment', { count: lesson.quizQuestions.length, defaultValue: `Quiz Assessment (${lesson.quizQuestions.length} Questions):` })}
                            </div>
                            {lesson.quizQuestions.map((q, qIdx) => (
                              <div
                                key={q.questionId || qIdx}
                                data-testid={`quiz-question-${qIdx + 1}`}
                                className="p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-md"
                              >
                                <div className="font-medium text-foreground">
                                  {qIdx + 1}. {q.questionText}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 text-[11px]">
                                  {q.options.map((opt, optIdx) => (
                                    <div
                                      key={optIdx}
                                      className={`p-1.5 rounded border ${
                                        optIdx === q.correctOptionIndex
                                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                                          : 'bg-background border-border text-muted-foreground'
                                      }`}
                                    >
                                      <span className="font-mono mr-1">
                                        {String.fromCharCode(65 + optIdx)}.
                                      </span>
                                      {opt} {optIdx === q.correctOptionIndex && ` ${t('aiBuilder.editor.correctOption', { defaultValue: '✓ (Correct)' })}`}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historical Drafts Queue */}
      <div className="space-y-4">
        <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600" />
          {t('aiBuilder.queue.title', { defaultValue: 'All Course Drafts Queue' })}
        </h2>

        {isDraftsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (drafts || []).length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground text-xs">
            {t('aiBuilder.queue.empty', { defaultValue: 'No previous course drafts found.' })}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drafts?.map((draft) => (
              <Card
                key={draft._id}
                className={`border p-4 cursor-pointer transition hover:border-indigo-500/50 ${
                  activeDraft?._id === draft._id ? 'ring-2 ring-indigo-600' : ''
                }`}
                onClick={() => setActiveDraft(draft)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{draft.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {draft.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {t('aiBuilder.queue.modulesBadge', { count: draft.modules.length, defaultValue: `${draft.modules.length} Modules` })}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={
                          draft.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]'
                        }
                      >
                        {draft.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDraft(draft._id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AICourseBuilder;

