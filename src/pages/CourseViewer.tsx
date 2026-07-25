import React, { useState, useEffect } from 'react';
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
  Check,
  Menu,
  ExternalLink
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ScrollArea } from '../components/ScrollArea';
import { Separator } from '../components/Separator';
import { useCourse, useUpdateLessonCompletion, useSubmitQuiz } from '../hooks/useCourses';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';
import { apiClient } from '../api/client';

interface TranslateTextProps {
  text?: string;
  children?: string;
  language: 'en' | 'si' | 'ta';
}

class TranslationQueue {
  private queue: Array<{ text: string; language: string; resolve: (val: string) => void; reject: (err: any) => void }> = [];
  private timeoutId: any = null;

  add(text: string, language: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push({ text, language, resolve, reject });
      this.scheduleProcessing();
    });
  }

  private scheduleProcessing() {
    if (this.timeoutId) return;
    this.timeoutId = setTimeout(() => this.processQueue(), 50);
  }

  private async processQueue() {
    this.timeoutId = null;
    const currentQueue = [...this.queue];
    this.queue = [];

    if (currentQueue.length === 0) return;

    // Group by language
    const byLanguage: Record<string, typeof currentQueue> = {};
    for (const item of currentQueue) {
      if (!byLanguage[item.language]) {
        byLanguage[item.language] = [];
      }
      byLanguage[item.language].push(item);
    }

    // Process each language group in parallel
    for (const [lang, items] of Object.entries(byLanguage)) {
      const textsToTranslate = items.map((i) => i.text);

      try {
        const res = await apiClient.post('/localization/translate-realtime', {
          text: textsToTranslate,
          targetLanguage: lang
        });

        const translatedArray = res.data.data.translatedText;
        items.forEach((item, index) => {
          const translated = Array.isArray(translatedArray) ? translatedArray[index] : translatedArray;
          item.resolve(translated || item.text);
        });
      } catch (err) {
        items.forEach((item) => {
          item.resolve(item.text); // fallback to original text on error
        });
      }
    }
  }
}

const translationQueue = new TranslationQueue();

function TranslateText({ text, children, language }: TranslateTextProps) {
  const rawText = text || children || '';
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (language === 'en' || !rawText.trim()) {
      setTranslatedText(rawText);
      return;
    }

    // Check localStorage cache
    const cacheKey = `tr:v2:${language}:${rawText}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setTranslatedText(cached);
      return;
    }

    // Trigger API translation via queue
    setIsLoading(true);
    translationQueue.add(rawText, language)
      .then(translated => {
        localStorage.setItem(cacheKey, translated);
        setTranslatedText(translated);
      })
      .catch(() => {
        setTranslatedText(rawText); // fallback
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [rawText, language]);

  if (isLoading) {
    return <span className="animate-pulse text-indigo-400">Translating...</span>;
  }

  return <>{translatedText}</>;
}

export function CourseViewer() {
  const { id } = useParams();
  const { data: course, isLoading, isError, error, refetch } = useCourse(id || '');
  const updateLessonCompletion = useUpdateLessonCompletion();
  const submitQuiz = useSubmitQuiz();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string[]>>({});
  const [retryMode, setRetryMode] = useState<boolean>(false);
  const [translationLanguage, setTranslationLanguage] = useState<'en' | 'si' | 'ta'>('en');

  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1024px)');
    const onChange = () => {
      setIsMobile(mql.matches);
      setSidebarOpen(!mql.matches);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    setSidebarOpen(!mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

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

  const autoMarkCompleted = () => {
    if (course && selectedLesson && !selectedLesson.isCompleted && !updateLessonCompletion.isPending) {
      updateLessonCompletion.mutate(
        {
          courseId: course.id,
          lessonId: selectedLesson.id,
          isCompleted: true,
        },
        {
          onSuccess: () => {
            toast.success('Lesson completed automatically!');
          },
        }
      );
    }
  };

  const handleVideoProgress = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget;
    if (video.duration > 0) {
      const percentage = (video.currentTime / video.duration) * 100;
      if (percentage >= 90) {
        autoMarkCompleted();
      }
    }
  };

  const handleAudioProgress = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget;
    if (audio.duration > 0) {
      const percentage = (audio.currentTime / audio.duration) * 100;
      if (percentage >= 90) {
        autoMarkCompleted();
      }
    }
  };

  const handleOptionSelect = (questionId: string, optionId: string, type: 'single_choice' | 'multiple_choice' | 'true_false') => {
    setSelectedAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === 'multiple_choice') {
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      } else {
        return { ...prev, [questionId]: [optionId] };
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

  const renderContentBlock = (block: any) => {
    switch (block.type) {
      case 'video': {
        const videoSrc = block.uploadUrl || block.embedUrl || block.content;
        const videoDetails = getVideoEmbedUrl(videoSrc);

        if (videoDetails.type === 'youtube' || videoDetails.type === 'vimeo') {
          return (
            <div key={block.id} className="space-y-2">
              {block.title && <h3 className="text-white font-semibold text-lg"><TranslateText language={translationLanguage}>{block.title}</TranslateText></h3>}
              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <iframe
                  className="w-full h-full"
                  src={videoDetails.src}
                  title={block.title || `${selectedLesson.title} video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          );
        } else if (videoDetails.src) {
          return (
            <div key={block.id} className="space-y-2">
              {block.title && <h3 className="text-white font-semibold text-lg"><TranslateText language={translationLanguage}>{block.title}</TranslateText></h3>}
              <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
                <video
                  src={videoDetails.src}
                  controls
                  className="w-full h-full"
                  onTimeUpdate={handleVideoProgress}
                />
              </div>
            </div>
          );
        }
        return null;
      }

      case 'audio': {
        return (
          <div key={block.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400">
                <PlayCircle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">
                  <TranslateText language={translationLanguage}>{block.title || 'Audio Lesson'}</TranslateText>
                </h4>
                <p className="text-xs text-gray-400">
                  <TranslateText language={translationLanguage}>Audio Playback</TranslateText>
                </p>
              </div>
            </div>
            {block.uploadUrl && (
              <audio
                src={block.uploadUrl}
                controls
                className="w-full"
                onTimeUpdate={handleAudioProgress}
              />
            )}
          </div>
        );
      }

      case 'pdf': {
        return (
          <div key={block.id} className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/10 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">
                    <TranslateText language={translationLanguage}>{block.title || 'Document.pdf'}</TranslateText>
                  </h4>
                  <p className="text-xs text-gray-400">
                    <TranslateText language={translationLanguage}>PDF Reader</TranslateText>
                  </p>
                </div>
              </div>
              {block.uploadUrl && (
                <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/10" onClick={() => window.open(block.uploadUrl, '_blank')}>
                  <TranslateText language={translationLanguage}>Open PDF</TranslateText>
                </Button>
              )}
            </div>
            {block.uploadUrl && (
              <div className="aspect-[3/4] md:h-[600px] w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-white">
                <iframe
                  src={`${block.uploadUrl}#toolbar=0`}
                  className="w-full h-full border-none"
                  title={block.title || 'PDF Frame'}
                />
              </div>
            )}
          </div>
        );
      }

      case 'image': {
        return (
          <div key={block.id} className="space-y-2">
            {block.title && (
              <h4 className="text-white font-semibold text-sm">
                <TranslateText language={translationLanguage}>{block.title}</TranslateText>
              </h4>
            )}
            <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-black/20">
              <img src={block.uploadUrl} alt={block.title || "Image block"} className="w-full max-h-[500px] object-contain mx-auto" />
            </div>
          </div>
        );
      }

      case 'document': {
        return (
          <div key={block.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-sm">
                  <TranslateText language={translationLanguage}>{block.title || 'Attached Document'}</TranslateText>
                </h4>
                <p className="text-xs text-gray-400">
                  <TranslateText language={translationLanguage}>Word/Excel/Powerpoint Attachment</TranslateText>
                </p>
              </div>
            </div>
            {block.uploadUrl && (
              <Button size="sm" onClick={() => window.open(block.uploadUrl, '_blank')}>
                <TranslateText language={translationLanguage}>Download File</TranslateText>
              </Button>
            )}
          </div>
        );
      }

      case 'embed': {
        return (
          <div key={block.id} className="space-y-2">
            {block.title && (
              <h4 className="text-white font-semibold text-sm">
                <TranslateText language={translationLanguage}>{block.title}</TranslateText>
              </h4>
            )}
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl">
              <iframe
                className="w-full h-full"
                src={block.embedUrl}
                title={block.title || 'Embed block'}
                allowFullScreen
              />
            </div>
          </div>
        );
      }

      case 'checklist': {
        return (
          <div key={block.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-3 shadow-xl">
            <h4 className="text-white font-semibold text-sm">
              <TranslateText language={translationLanguage}>{block.title || 'Checklist Tasks'}</TranslateText>
            </h4>
            <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
              <TranslateText language={translationLanguage}>{block.content}</TranslateText>
            </div>
          </div>
        );
      }

      case 'text':
      default: {
        return (
          <div key={block.id} className="prose prose-sm dark:prose-invert max-w-none text-gray-300 leading-relaxed">
            {block.title && (
              <h3 className="text-white font-bold text-xl mt-6">
                <TranslateText language={translationLanguage}>{block.title}</TranslateText>
              </h3>
            )}
            <MarkdownPreview content={block.content || ''} language={translationLanguage} />
          </div>
        );
      }
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
    <div className="flex h-screen w-full bg-[#0B0F19] overflow-hidden">
      {/* Backdrop for mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Curriculum Sidebar */}
      <div
        className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-40 w-80 bg-[#0E1321] transition-transform duration-200 transform ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `transition-[width,margin-left] duration-200 ${
                sidebarOpen ? 'w-80 border-r border-white/10 bg-white/[0.02]' : 'w-0 overflow-hidden'
              }`
        } flex flex-col h-full shrink-0`}
      >
        <div className="p-4 border-b border-white/10 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-gray-400 hover:text-white"
              asChild>
              <Link to="/employee">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white h-8 w-8"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="font-semibold text-lg text-white leading-tight mb-2 truncate">
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
                        onClick={() => {
                          setSelectedLessonId(lesson.id);
                          if (isMobile) setSidebarOpen(false);
                        }}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-lg transition-all text-left ${
                          isSelected ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'hover:bg-white/[0.04] text-gray-400 hover:text-white border border-transparent'
                        }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                        ) : lesson.type === 'Video' ? (
                          <PlayCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`} />
                        ) : lesson.type === 'Quiz' ? (
                          <Award className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`} />
                        ) : lesson.type === 'PDF' || lesson.type === 'Document' ? (
                          <FileText className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`} />
                        ) : lesson.type === 'Audio' ? (
                          <PlayCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-indigo-400' : 'text-gray-500'}`} />
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
            <header className="h-14 border-b border-white/10 flex items-center justify-between px-4 sm:px-6 bg-white/[0.01]">
              <div className="flex items-center gap-2 min-w-0">
                {!sidebarOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(true)}
                    className="text-gray-400 hover:text-white shrink-0 mr-1"
                    title="Show Sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                )}
                <h1 className="font-semibold text-white text-sm truncate">
                  <TranslateText language={translationLanguage}>{selectedLesson.title}</TranslateText>
                </h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Real-time Translation Toggle Switcher */}
                <div className="flex items-center bg-white/[0.04] p-0.5 rounded-lg border border-white/10 mr-2 shadow-inner">
                  <button
                    onClick={() => setTranslationLanguage('en')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
                      translationLanguage === 'en'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => setTranslationLanguage('si')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
                      translationLanguage === 'si'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    සිංහල (SI)
                  </button>
                  <button
                    onClick={() => setTranslationLanguage('ta')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 ${
                      translationLanguage === 'ta'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    தமிழ் (TA)
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={selectedIndex <= 0}
                  className="border-white/10 text-gray-300 hover:bg-white/5 px-2.5 sm:px-3"
                >
                  <ChevronLeft className="sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={selectedIndex >= allLessons.length - 1}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 sm:px-3"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="sm:ml-2 h-4 w-4" />
                </Button>
              </div>
            </header>
            <main className="flex-1 p-4 sm:p-8 overflow-auto flex justify-center">
              <div className="max-w-3xl w-full space-y-8">
                {selectedLesson.type === 'Quiz' && selectedLesson.quiz ? (
                  <div className="space-y-6">
                    {selectedLesson.quizAttempt && !retryMode ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-8 text-center space-y-6 shadow-xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                          <Award className="h-7 w-7" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl sm:text-2xl font-bold text-white">
                            <TranslateText language={translationLanguage}>Quiz Evaluation Results</TranslateText>
                          </h3>
                          <p className="text-gray-400 text-sm">
                            {selectedLesson.quizAttempt.passed ? (
                              <TranslateText language={translationLanguage}>Excellent work! You passed the assessment requirements.</TranslateText>
                            ) : (
                              <TranslateText language={translationLanguage}>You did not score enough to pass the assessment this time.</TranslateText>
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm">
                          <div className="bg-white/[0.03] px-6 py-4 rounded-xl border border-white/5 w-32 shadow-inner">
                            <span className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">
                              <TranslateText language={translationLanguage}>Your Score</TranslateText>
                            </span>
                            <span className={`text-2xl font-bold block mt-1 ${selectedLesson.quizAttempt.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                              {selectedLesson.quizAttempt.score}%
                            </span>
                          </div>
                          <div className="bg-white/[0.03] px-6 py-4 rounded-xl border border-white/5 w-32 shadow-inner">
                            <span className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">
                              <TranslateText language={translationLanguage}>Passing Score</TranslateText>
                            </span>
                            <span className="text-2xl font-bold text-white block mt-1">
                              {selectedLesson.quiz.passingScore}%
                            </span>
                          </div>
                          <div className="bg-white/[0.03] px-6 py-4 rounded-xl border border-white/5 w-32 shadow-inner">
                            <span className="block text-xs text-gray-500 font-semibold uppercase tracking-wider">
                              <TranslateText language={translationLanguage}>Attempt No</TranslateText>
                            </span>
                            <span className="text-2xl font-bold text-white block mt-1">
                              {selectedLesson.quizAttempt.attemptNumber}
                            </span>
                          </div>
                        </div>

                        {selectedLesson.quizAttempt.passed ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="h-4 w-4" /> <TranslateText language={translationLanguage}>Completed</TranslateText>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-semibold">
                            <AlertCircle className="h-4 w-4" /> <TranslateText language={translationLanguage}>Verification Incomplete</TranslateText>
                          </div>
                        )}

                        <div className="pt-4">
                          <Button onClick={() => setRetryMode(true)} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
                            {selectedLesson.quizAttempt.passed ? (
                              <TranslateText language={translationLanguage}>Retake Quiz</TranslateText>
                            ) : (
                              <TranslateText language={translationLanguage}>Try Again</TranslateText>
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="border-b border-white/10 pb-4">
                          <h3 className="text-xl font-bold text-white">
                            <TranslateText language={translationLanguage}>Lesson Assessment</TranslateText>
                          </h3>
                          <p className="text-sm text-gray-400 mt-1">
                            <TranslateText language={translationLanguage}>Answer the questions below to verify your learning. You need at least</TranslateText> {selectedLesson.quiz.passingScore}% <TranslateText language={translationLanguage}>to pass.</TranslateText>
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
                                    <h4 className="font-semibold text-white leading-snug">
                                      <TranslateText language={translationLanguage}>{question.questionText}</TranslateText>
                                    </h4>
                                    <p className="text-xs text-gray-500 font-medium">
                                      {question.type === 'single_choice' && <TranslateText language={translationLanguage}>Select single choice option</TranslateText>}
                                      {question.type === 'true_false' && <TranslateText language={translationLanguage}>Select True or False</TranslateText>}
                                      {question.type === 'multiple_choice' && <TranslateText language={translationLanguage}>Multiple choices allowed</TranslateText>} • {question.points} points
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
                                        <span>
                                          <TranslateText language={translationLanguage}>{option.optionText}</TranslateText>
                                        </span>
                                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-all ${
                                          question.type === 'multiple_choice' ? 'rounded-md' : 'rounded-full'
                                        } ${
                                          isSelected
                                            ? 'border-indigo-500 bg-indigo-500 text-white'
                                            : 'border-white/25'
                                        }`}>
                                          {isSelected && (
                                            question.type === 'multiple_choice' ? (
                                              <Check className="h-3.5 w-3.5" />
                                            ) : (
                                              <div className="h-2 w-2 rounded-full bg-white" />
                                            )
                                          )}
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
                            <TranslateText language={translationLanguage}>Submit Assessment</TranslateText>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="border-b border-white/10 pb-4">
                      <h2 className="text-white text-2xl font-bold">
                        <TranslateText language={translationLanguage}>{selectedLesson.title}</TranslateText>
                      </h2>
                      {selectedLesson.description && (
                        <p className="text-sm text-gray-400 mt-1">
                          <TranslateText language={translationLanguage}>{selectedLesson.description}</TranslateText>
                        </p>
                      )}
                    </div>
                    {selectedLesson.contentBlocks && selectedLesson.contentBlocks.length > 0 ? (
                      <div className="space-y-8">
                        {selectedLesson.contentBlocks.map((block) => renderContentBlock(block))}
                      </div>
                    ) : (selectedLesson.type === 'PDF' || selectedLesson.type === 'Document' || selectedLesson.content?.toLowerCase().includes('.pdf')) ? (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/10 rounded-xl shadow-lg">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 bg-red-500/10 rounded-lg flex items-center justify-center text-red-400 shrink-0">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-white font-semibold text-sm truncate">
                                <TranslateText language={translationLanguage}>{selectedLesson.title || 'Document.pdf'}</TranslateText>
                              </h4>
                              <p className="text-xs text-gray-400">
                                <TranslateText language={translationLanguage}>PDF Document Viewer</TranslateText>
                              </p>
                            </div>
                          </div>
                          {selectedLesson.content && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/20 text-white hover:bg-white/10 shrink-0"
                              onClick={() => window.open(selectedLesson.content, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              <TranslateText language={translationLanguage}>Open PDF</TranslateText>
                            </Button>
                          )}
                        </div>
                        {selectedLesson.content ? (
                          <div className="w-full h-[650px] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-white">
                            <iframe
                              src={`${selectedLesson.content}#toolbar=1`}
                              className="w-full h-full border-none"
                              title={selectedLesson.title || 'PDF Document Viewer'}
                            />
                          </div>
                        ) : (
                          <div className="p-8 text-center text-gray-400 border border-white/10 rounded-xl bg-white/[0.02]">
                            <TranslateText language={translationLanguage}>No PDF document attached to this lesson.</TranslateText>
                          </div>
                        )}
                      </div>
                    ) : selectedLesson.type === 'Video' && selectedLesson.content ? (
                      <div className="space-y-4">
                        {selectedLesson.content.includes('youtube.com') || selectedLesson.content.includes('youtu.be') ? (
                          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-xl">
                            <iframe
                              className="w-full h-full"
                              src={selectedLesson.content.replace('watch?v=', 'embed/')}
                              title="Video player"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <video
                            src={selectedLesson.content}
                            controls
                            className="w-full aspect-video rounded-xl border border-white/10 bg-black shadow-xl"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div className="text-gray-300 leading-relaxed">
                          <MarkdownPreview content={selectedLesson.content || ''} language={translationLanguage} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Show mark completed button only for non-quiz lessons */}
                {selectedLesson.type !== 'Quiz' && (
                  <div className="flex justify-between items-center pt-4 border-t border-white/10 gap-4">
                    <div>
                      {selectedLesson.completionRule === 'video' && (
                        <p className="text-xs text-indigo-400 italic">
                          <TranslateText language={translationLanguage}>This lesson will complete automatically when you watch 90% of the video / listen to 90% of the audio.</TranslateText>
                        </p>
                      )}
                    </div>
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
                      {selectedLesson.isCompleted ? (
                        <TranslateText language={translationLanguage}>Completed</TranslateText>
                      ) : (
                        <TranslateText language={translationLanguage}>Mark as Completed</TranslateText>
                      )}
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

function renderFormattedText(text: string, language: 'en' | 'si' | 'ta') {
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
          className="text-indigo-400 hover:text-indigo-300 underline font-medium break-all"
        >
          {part}
        </a>
      );
    }
    return <TranslateText key={i} language={language}>{part}</TranslateText>;
  });
}

function MarkdownPreview({ content, language }: { content: string; language: 'en' | 'si' | 'ta' }) {
  if (!content) return <p className="text-gray-400 italic text-sm">No content written yet.</p>;

  const lines = content.split('\n');
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert space-y-4">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
          return <h1 key={idx} className="text-2xl font-bold tracking-tight border-b border-white/10 pb-2 mt-6 text-white">{renderFormattedText(trimmed.slice(2), language)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx} className="text-xl font-semibold mt-5 text-white">{renderFormattedText(trimmed.slice(3), language)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={idx} className="text-lg font-semibold mt-4 text-white">{renderFormattedText(trimmed.slice(4), language)}</h3>;
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <ul key={idx} className="list-disc pl-6 space-y-1 text-gray-300">
              <li>{renderFormattedText(trimmed.slice(2), language)}</li>
            </ul>
          );
        }
        if (trimmed.startsWith('> ')) {
          return <blockquote key={idx} className="border-l-4 border-indigo-500 pl-4 italic my-2 bg-white/[0.02] py-1 rounded-r text-gray-400">{renderFormattedText(trimmed.slice(2), language)}</blockquote>;
        }
        if (trimmed.startsWith('```')) {
          if (trimmed === '```') return null;
          return <pre key={idx} className="bg-black/40 p-3 rounded-md font-mono text-xs overflow-x-auto border border-white/10 text-indigo-300">{trimmed.replace(/```/g, '')}</pre>;
        }
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }
        return <p key={idx} className="leading-relaxed text-gray-300">{renderFormattedText(trimmed, language)}</p>;
      })}
    </div>
  );
}