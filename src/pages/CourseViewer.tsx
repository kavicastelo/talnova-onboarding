import { useState } from 'react';
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
  Award
} from
  'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ScrollArea } from '../components/ScrollArea';
import { Separator } from '../components/Separator';
import { useCourse, useUpdateLessonCompletion } from '../hooks/useCourses';
import { Skeleton } from '../components/Skeleton';

export function CourseViewer() {
  const { id } = useParams();
  const { data: course, isLoading, isError, error, refetch } = useCourse(id || '');
  const updateLessonCompletion = useUpdateLessonCompletion();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const allLessons = course?.modules.flatMap((m) => m.lessons) || [];
  const selectedLesson =
    allLessons.find((l) => l.id === selectedLessonId) || allLessons[0];

  const selectedIndex = allLessons.findIndex((l) => l.id === (selectedLesson?.id));

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
    <div className="flex h-screen w-full bg-background">
      <div className="w-80 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-muted-foreground"
            asChild>
            <Link to="/employee">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          <h2 className="font-semibold text-lg leading-tight mb-2">
            {course.title}
          </h2>
          <div className="flex items-center gap-2 mb-1">
            <Progress value={course.progress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground font-medium">
              {course.progress}%
            </span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {course.modules.map((module, mIdx) => (
              <div key={module.id}>
                {mIdx > 0 && <Separator className="my-4" />}
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">
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
                        className={`w-full flex items-start gap-3 p-2 rounded-md transition-colors text-left ${isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                          }`}>
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        ) : lesson.type === 'Video' ? (
                          <PlayCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        ) : lesson.type === 'Quiz' ? (
                          <Award className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        ) : (
                          <FileText className={`h-5 w-5 shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        )}
                        <div>
                          <p className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                            {lesson.title}
                          </p>
                          <p className={`text-xs ${isSelected ? 'text-primary/70' : 'text-muted-foreground'}`}>
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

      <div className="flex-1 flex flex-col min-w-0">
        {selectedLesson ? (
          <>
            <header className="h-14 border-b flex items-center justify-between px-6">
              <h1 className="font-medium">{selectedLesson.title}</h1>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  disabled={selectedIndex <= 0}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  disabled={selectedIndex >= allLessons.length - 1}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </header>
            <main className="flex-1 p-8 overflow-auto flex justify-center">
              <div className="max-w-3xl w-full space-y-8">
                {selectedLesson.type === 'Video' && (
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center text-white/50 relative overflow-hidden">
                    <PlayCircle className="h-16 w-16 absolute z-10 cursor-pointer hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-muted/20" />
                    <p className="z-10 mt-24">Video Player Placeholder</p>
                  </div>
                )}

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h2>{selectedLesson.title}</h2>
                  <p>
                    {selectedLesson.content ||
                      'Learn the core concepts of this topic. Review all details carefully.'}
                  </p>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button
                    variant={selectedLesson.isCompleted ? 'outline' : 'default'}
                    onClick={toggleCompletion}
                    disabled={updateLessonCompletion.isPending}>
                    {updateLessonCompletion.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : selectedLesson.isCompleted ? (
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                    ) : null}
                    {selectedLesson.isCompleted ? 'Completed' : 'Mark as Completed'}
                  </Button>
                </div>
              </div>
            </main>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a topic to start learning.
          </div>
        )}
      </div>
    </div>
  );
}