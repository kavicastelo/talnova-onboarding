import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Wand2,
  Sparkles,
  BookOpen,
  HelpCircle,
  CheckCircle,
  RefreshCw,
  Trash2,
  Layers
} from 'lucide-react';
import {
  useGenerateCourse,
  useCourseDrafts,
  usePublishCourseDraft,
  useRegenerateModule,
  useDeleteCourseDraft
} from '../hooks/useAICourseBuilder';
import { toast } from 'sonner';

export function AICourseBuilder() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [department, setDepartment] = useState('Engineering');

  const { data: drafts, isLoading: isDraftsLoading } = useCourseDrafts();
  const generateCourseMutation = useGenerateCourse();
  const publishDraftMutation = usePublishCourseDraft();
  const regenerateModuleMutation = useRegenerateModule();
  const deleteDraftMutation = useDeleteCourseDraft();

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error('Please enter a course prompt topic.');
      return;
    }

    generateCourseMutation.mutate(
      {
        prompt,
        targetRole,
        department,
      },
      {
        onSuccess: (newDraft) => {
          toast.success(`AI generated course draft "${newDraft.title}"!`);
          setPrompt('');
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to generate AI course draft');
        },
      }
    );
  };

  const handlePublish = (draftId: string) => {
    publishDraftMutation.mutate(draftId, {
      onSuccess: () => {
        toast.success('Course draft published to live Journeys!');
        navigate('/journeys');
      },
      onError: () => {
        toast.error('Failed to publish draft to journeys');
      },
    });
  };

  const handleRegenerateModule = (draftId: string, moduleId: string) => {
    regenerateModuleMutation.mutate(
      { draftId, moduleId },
      {
        onSuccess: () => {
          toast.success('Module content regenerated with AI!');
        },
      }
    );
  };

  const handleDeleteDraft = (draftId: string) => {
    deleteDraftMutation.mutate(draftId, {
      onSuccess: () => {
        toast.success('Course draft deleted.');
      },
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Wand2 className="h-7 w-7 text-indigo-600" />
          AI Course & Journey Builder
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate full onboarding curriculum, lesson content, and quizzes grounded in company knowledge with 1-click human review approval.
        </p>
      </div>

      {/* Prompt Generator Card */}
      <Card className="border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-background to-background shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            AI Onboarding Curriculum Generator
          </CardTitle>
          <CardDescription>Enter a role or onboarding topic to synthesize a structured learning journey.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Onboarding Topic or Prompt</label>
            <Input
              placeholder="e.g. Senior DevOps Engineer Security & Infrastructure Onboarding"
              value={prompt}
              onChange={(e: any) => setPrompt(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Target Role</label>
              <Input
                placeholder="DevOps Engineer"
                value={targetRole}
                onChange={(e: any) => setTargetRole(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Department</label>
              <Input
                placeholder="Engineering"
                value={department}
                onChange={(e: any) => setDepartment(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={handleGenerate}
            disabled={generateCourseMutation.isPending || !prompt.trim()}
          >
            {generateCourseMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Synthesizing Course & Quizzes...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" /> Generate Onboarding Course Draft with AI
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* AI Course Drafts Inspector */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-600" />
          AI Course Drafts & Review Queue
        </h2>

        {isDraftsLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        ) : (drafts || []).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-xs">
            No course drafts generated yet. Use the prompt wizard above to synthesize your first onboarding journey!
          </Card>
        ) : (
          <div className="space-y-6">
            {drafts?.map((draft) => (
              <Card key={draft._id} className="border shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/20 pb-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-semibold">{draft.title}</CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          draft.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }
                      >
                        {draft.status.toUpperCase()} (v{draft.version})
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">{draft.description}</CardDescription>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {draft.status !== 'published' && (
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        size="sm"
                        onClick={() => handlePublish(draft._id)}
                        disabled={publishDraftMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" /> Approve & Publish to Journeys
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDeleteDraft(draft._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Modules Tree */}
                  {draft.modules.map((mod, mIdx) => (
                    <div key={mod.moduleId || mIdx} className="p-4 bg-muted/10 border rounded-lg space-y-4">
                      <div className="flex justify-between items-center border-b pb-2">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{mod.title}</h4>
                          <p className="text-xs text-muted-foreground">{mod.description}</p>
                        </div>
                        {draft.status !== 'published' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleRegenerateModule(draft._id, mod.moduleId)}
                            disabled={regenerateModuleMutation.isPending}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Regenerate Module
                          </Button>
                        )}
                      </div>

                      {/* Lessons & Quizzes */}
                      <div className="space-y-3 pl-2">
                        {mod.lessons.map((lesson, lIdx) => (
                          <div key={lesson.lessonId || lIdx} className="p-3 bg-card border rounded-md text-xs space-y-2">
                            <div className="flex items-center justify-between font-semibold">
                              <span className="flex items-center gap-1.5 text-foreground">
                                <BookOpen className="h-4 w-4 text-indigo-600" />
                                {lesson.title} ({lesson.durationMinutes} mins)
                              </span>
                            </div>
                            <p className="text-muted-foreground leading-relaxed">{lesson.content}</p>

                            {/* Quiz Questions */}
                            {lesson.quizQuestions && lesson.quizQuestions.length > 0 && (
                              <div className="pt-2 border-t mt-2 space-y-2">
                                <div className="font-semibold text-amber-600 flex items-center gap-1">
                                  <HelpCircle className="h-3.5 w-3.5" /> AI Generated Quiz Item:
                                </div>
                                {lesson.quizQuestions.map((q, qIdx) => (
                                  <div key={q.questionId || qIdx} className="p-2 bg-amber-500/5 border border-amber-500/20 rounded">
                                    <div className="font-medium text-foreground">{q.questionText}</div>
                                    <div className="grid grid-cols-2 gap-1 mt-1 text-[11px]">
                                      {q.options.map((opt, optIdx) => (
                                        <div
                                          key={optIdx}
                                          className={`p-1 rounded ${
                                            optIdx === q.correctOptionIndex
                                              ? 'bg-emerald-500/20 text-emerald-700 font-bold'
                                              : 'text-muted-foreground'
                                          }`}
                                        >
                                          {optIdx + 1}. {opt} {optIdx === q.correctOptionIndex && '✓'}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AICourseBuilder;
