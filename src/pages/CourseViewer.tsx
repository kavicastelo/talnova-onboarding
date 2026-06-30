import { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { Progress } from '../components/Progress';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  FileText,
  AlertCircle,
  RefreshCw,
  Award,
  Check
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ScrollArea } from '../components/ScrollArea';
import { Separator } from '../components/Separator';
import { useCourse, useUpdateLessonCompletion, useSubmitQuiz } from '../hooks/useCourses';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';

export function CourseViewer() {
  const { id } = useParams();
  const { data: course, isLoading, isError, error, refetch } = useCourse(id || '');
  const updateLessonCompletion = useUpdateLessonCompletion();
  const submitQuiz = useSubmitQuiz();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [retryMode, setRetryMode] = useState<boolean>(false);

  const allLessons = course?.modules.flatMap((m) => m.lessons) || [];
  const selectedLesson =
    allLessons.find((l) => l.id === selectedLessonId) || allLessons[0];

  const selectedIndex = allLessons.findIndex((l) => l.id === (selectedLesson?.id));

  // Reset selected answers when lesson changes
  useEffect(() => {
    setSelectedAnswers({});
    setRetryMode(false);
  }, [selectedLesson?.id]);

  const handleNext = () => {
    if (selectedIndex < allLessons.length - 1) {
      setSelectedLessonId(allLessons[selectedIndex + 1].id);
    }
  };

  const handlePrevious = () => {
    if (selectedIndex > 0) {
      setSelectedLessonId(allLessons[selectedIndex - 1].id);
    }
  };

  const toggleCompletion = () => {
    if (course && selectedLesson) {
      updateLessonCompletion.mutate({
        courseId: course.id,
        lessonId: selectedLesson.id,
        isCompleted: !selectedLesson.isCompleted,
      });
    }
  };

  const handleOptionSelect = (questionId: string, optionId: string, type: 'single_choice' | 'multiple_choice') => {
    setSelectedAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === 'single_choice') {
        return { ...prev, [questionId]: [optionId] };
      } else {
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      }
    });
  };

  const handleSubmitQuiz = async () => {
    if (!selectedLesson || !selectedLesson.quiz) return;

    let moduleId = '';
    if (course) {
      for (const m of course.modules) {
        if (m.lessons.some((l) => l.id === selectedLesson.id)) {
          moduleId = m.id;
          break;
        }
      }
    }

    if (!moduleId) {
      toast.error('Module context not found.');
      return;
    }

    const answersPayload = selectedLesson.quiz.questions.map((q) => ({
      questionId: q.id,
      selectedOptions: selectedAnswers[q.id] || [],
    }));

    try {
      const result = await submitQuiz.mutateAsync({
        courseId: course!.id,
        moduleId,
        lessonId: selectedLesson.id,
        answers: answersPayload,
      });

      if (result.passed) {
        toast.success(`Congratulations! You passed the quiz with a score of ${result.score}%!`);
      } else {
        toast.error(`You scored ${result.score}%, which is below the passing score of ${selectedLesson.quiz.passingScore}%.`);
      }
      setRetryMode(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit quiz.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full bg-background animate-pulse">
        <div className="w-80 border-r flex flex-col bg-muted/30 p-4 gap-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-2 w-full" />
          <div className="space-y-4 mt-8">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="flex-1 flex flex-col p-6 gap-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="max-w-md mx-auto text-center p-8 border rounded-lg space-y-4 my-12">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold">Failed to Load Course</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'The course curriculum is not available.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#0B0F19]">
      <div className="w-80 border-r border-white/10 flex flex-col bg-white/[0.02] backdrop-blur-md">
        <div className="p-4 border-b border-white/10">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-gray-400 hover:text-white"
            asChild>
            <Link to="/employee">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h2 className="font-semibold text-lg text-white leading-tight mb-2">
            {course.title}
          </h2>
          <div className="flex items-center gap-2 mb-1">
            <Progress value={course.progress} className="h-2 flex-1 bg-white/10" />
            <span className="text-xs text-gray-400 font-medium">
              {course.progress}%
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {course.modules.map((module, mIdx) => (
              <div key={module.id}>
                {mIdx > 0 && <Separator className="my-4 bg-white/10" />}
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  {module.title}
                </h3>
                <div className="space-y-1">
                  {module.lessons.map((lesson) => {
                    const isSelected = selectedLesson?.id === lesson.id;
                    const isCompleted = lesson.isCompleted;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => setSelectedLessonId(lesson.id)}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-lg transition-all text-left ${
                          isSelected ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/[0.04] text-gray-400 hover:text-white border border-transparent'
                        }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                        ) : lesson.type === 'Video' ? (
                          <PlayCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`} />
                        ) : lesson.type === 'Quiz' ? (
                          <Award className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`} />
                        ) : (
                          <FileText className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`} />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${isSelected ? 'text-white font-semibold' : ''}`}>
                            {lesson.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {lesson.type} • {lesson.duration}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-[#0B0F19]">
        {selectedLesson ? (
          <>
            <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-white/[0.01]">
              <h1 className="font-semibold text-white text-sm">{selectedLesson.title}</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={selectedIndex <= 0}
                  className="border-white/10 text-gray-300 hover:bg-white/5"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={selectedIndex >= allLessons.length - 1}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </header>
            <main className="flex-1 p-8 overflow-auto flex justify-center">
              <div className="max-w-3xl w-full space-y-8">
                {selectedLesson.type === 'Video' && (
                  <div className="space-y-4">
                    {selectedLesson.content ? (() => {
                      const videoDetails = getVideoEmbedUrl(selectedLesson.content);
                      if (videoDetails.type === 'youtube' || videoDetails.type === 'vimeo') {
                        return (
                          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                            <iframe
                              className="w-full h-full"
                              src={videoDetails.src}
                              title={`${selectedLesson.title} player`}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        );
                      } else {
                        return (
                          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
                            <video
                              src={videoDetails.src}
                              controls
                              className="w-full h-full"
                            />
                          </div>
                        );
                      }
                    })() : (
                      <div className="aspect-video bg-white/[0.02] rounded-xl border border-white/10 flex flex-col items-center justify-center text-white/40 p-6 shadow-2xl">
                        <PlayCircle className="h-12 w-12 text-gray-500 mb-3" />
                        <h4 className="font-semibold text-sm text-gray-300">No Video Available</h4>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs text-center">
                          An administrator has not uploaded or linked any video asset for this lesson yet.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {selectedLesson.type === 'Quiz' && selectedLesson.quiz ? (
                  <div className="space-y-6">
                    {selectedLesson.quizAttempt && !retryMode ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-6 shadow-xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                          <Award className="h-7 w-7" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-2xl font-bold text-white">Quiz Evaluation Results</h3>
                          <p className="text-gray-400 text-sm">
                            {selectedLesson.quizAttempt.passed ? 'Excellent work! You passed the assessment requirements.' : 'You did not score enough to pass the assessment this time.'}
                          </p>
                        </div>
                        <div className="flex justify-center gap-6 text-sm">
                          <div className="bg-white/[0.03] px-6 py-4 rounded-xl border border-white/5 w-32 shadow-inner">
                            <span className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">Your Score</span>
                            <span className={`text-2xl font-bold block mt-1 ${selectedLesson.quizAttempt.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                              {selectedLesson.quizAttempt.score}%
                            </span>
                          </div>
                          <div className="bg-white/[0.03] px-6 py-4 rounded-xl border border-white/5 w-32 shadow-inner">
                            <span className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">Passing Score</span>
                            <span className="text-2xl font-bold text-white block mt-1">
                              {selectedLesson.quiz.passingScore}%
                            </span>
                          </div>
                          <div className="bg-white/[0.03] px-6 py-4 rounded-xl border border-white/5 w-32 shadow-inner">
                            <span className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">Attempt No</span>
                            <span className="text-2xl font-bold text-white block mt-1">
                              {selectedLesson.quizAttempt.attemptNumber}
                            </span>
                          </div>
                        </div>

                        {selectedLesson.quizAttempt.passed ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="h-4 w-4" /> Passed & Completed
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
                            <AlertCircle className="h-4 w-4" /> Verification Incomplete
                          </div>
                        )}

                        <div className="pt-4">
                          <Button onClick={() => setRetryMode(true)} className="bg-indigo-600 hover:bg-indigo-700">
                            {selectedLesson.quizAttempt.passed ? 'Retake Quiz' : 'Try Again'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="border-b border-white/10 pb-4">
                          <h3 className="text-xl font-bold text-white">Lesson Assessment</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            Answer the questions below to verify your learning. You need at least {selectedLesson.quiz.passingScore}% to pass.
                          </p>
                        </div>

                        <div className="space-y-6">
                          {selectedLesson.quiz.questions.map((question, qIdx) => {
                            const userAnswers = selectedAnswers[question.id] || [];
                            return (
                              <div key={question.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4 shadow-lg">
                                <div className="flex items-start gap-3">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-xs font-bold text-indigo-400">
                                    {qIdx + 1}
                                  </span>
                                  <div className="space-y-1">
                                    <h4 className="font-semibold text-white leading-snug">{question.questionText}</h4>
                                    <p className="text-xs text-gray-500 font-medium">
                                      {question.type === 'single_choice' ? 'Select single choice option' : 'Multiple choices allowed'} • {question.points} points
                                    </p>
                                  </div>
                                </div>

                                <div className="grid gap-3 pt-2">
                                  {question.options.map((option) => {
                                    const isSelected = userAnswers.includes(option.id);
                                    return (
                                      <button
                                        key={option.id}
                                        type="button"
                                        onClick={() => handleOptionSelect(question.id, option.id, question.type)}
                                        className={`flex items-center justify-between w-full px-4 py-3.5 rounded-lg border text-left text-sm transition-all ${
                                          isSelected
                                            ? 'border-indigo-500 bg-indigo-500/5 text-indigo-300 shadow-lg shadow-indigo-500/5'
                                            : 'border-white/10 bg-white/[0.01] hover:border-white/20 text-gray-300'
                                        }`}
                                      >
                                        <span>{option.optionText}</span>
                                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                                          isSelected
                                            ? 'border-indigo-500 bg-indigo-500 text-white'
                                            : 'border-white/25'
                                        }`}>
                                          {isSelected && <Check className="h-3.5 w-3.5" />}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-white/10">
                          <Button
                            onClick={handleSubmitQuiz}
                            disabled={submitQuiz.isPending || Object.keys(selectedAnswers).length < selectedLesson.quiz.questions.length}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20"
                          >
                            {submitQuiz.isPending ? (
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Submit Assessment
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <h2 className="text-white text-2xl font-bold mb-4">{selectedLesson.title}</h2>
                    <div className="text-gray-300 leading-relaxed">
                      <MarkdownPreview content={selectedLesson.content || ''} />
                    </div>
                  </div>
                )}

                {/* Show mark completed button only for non-quiz lessons */}
                {selectedLesson.type !== 'Quiz' && (
                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <Button
                      variant={selectedLesson.isCompleted ? 'outline' : 'default'}
                      onClick={toggleCompletion}
                      disabled={updateLessonCompletion.isPending}
                      className={selectedLesson.isCompleted ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
                    >
                      {updateLessonCompletion.isPending ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : selectedLesson.isCompleted ? (
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-400" />
                      ) : null}
                      {selectedLesson.isCompleted ? 'Completed' : 'Mark as Completed'}
                    </Button>
                  </div>
                )}
              </div>
            </main>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            Select a topic to start learning.
          </div>
        )}
      </div>
    </div>
  );
}

function getVideoEmbedUrl(url: string): { type: 'youtube' | 'vimeo' | 'direct' | 'invalid'; src: string } {
  if (!url) return { type: 'invalid', src: '' };
  
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[1]}` };
  }
  
  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }
  
  // Direct link or other
  return { type: 'direct', src: url };
}

function MarkdownPreview({ content }: { content: string }) {
  if (!content) return <p className="text-gray-400 italic text-sm">No content written yet.</p>;
  
  const lines = content.split('\n');
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert space-y-4">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          return <h1 key={idx} className="text-2xl font-bold tracking-tight border-b border-white/10 pb-2 mt-6 text-white">{trimmed.slice(2)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx} className="text-xl font-semibold mt-5 text-white">{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={idx} className="text-lg font-semibold mt-4 text-white">{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <ul key={idx} className="list-disc pl-6 space-y-1 text-gray-300">
              <li>{trimmed.slice(2)}</li>
            </ul>
          );
        }
        if (trimmed.startsWith('> ')) {
          return <blockquote key={idx} className="border-l-4 border-indigo-500 pl-4 italic my-2 bg-white/[0.02] py-1 rounded-r text-gray-400">{trimmed.slice(2)}</blockquote>;
        }
        if (trimmed.startsWith('```')) {
          if (trimmed === '```') return null;
          return <pre key={idx} className="bg-black/40 p-3 rounded-md font-mono text-xs overflow-x-auto border border-white/10 text-indigo-300">{trimmed.replace(/```/g, '')}</pre>;
        }
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }
        return <p key={idx} className="leading-relaxed text-gray-300">{trimmed}</p>;
      })}
    </div>
  );
}