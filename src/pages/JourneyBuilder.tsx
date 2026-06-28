import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import {
  Card,
  CardContent
} from
  '../components/Card';
import { Badge } from '../components/Badge';
import { ScrollArea } from '../components/ScrollArea';
import { Separator } from '../components/Separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from
  '../components/Select';
import {
  ChevronLeft,
  GripVertical,
  Plus,
  Users,
  FileText,
  Video,
  HelpCircle,
  AlertCircle,
  RefreshCw
} from
  'lucide-react';
import { useJourney, useUpdateJourney, useCreateJourney } from '../hooks/useJourneys';
import { useCourse } from '../hooks/useCourses';
import { Skeleton } from '../components/Skeleton';
import { toast } from 'sonner';

export function JourneyBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const { data: journey, isLoading: journeyLoading, isError, error, refetch } = useJourney(isNew ? '' : (id || ''));
  const updateJourney = useUpdateJourney();
  const createJourney = useCreateJourney();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('engineering');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Sync state with loaded journey
  useEffect(() => {
    if (journey) {
      setTitle(journey.title || '');
      setDescription(journey.description || '');
      setCategory(journey.category || 'engineering');
    }
  }, [journey]);

  const isLoading = !isNew && journeyLoading;

  const handleSave = () => {
    if (isNew) {
      createJourney.mutate(
        { title, description, category, status: 'Draft', enrolled: 0, completion: 0, lastUpdated: 'Just now' },
        {
          onSuccess: (newJourney) => {
            toast.success('Journey created successfully!');
            navigate(`/journeys/${newJourney.id}`);
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to create journey.');
          },
        }
      );
    } else if (id) {
      updateJourney.mutate(
        { id, journey: { title, description, category } },
        {
          onSuccess: () => {
            toast.success('Journey saved successfully!');
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to save journey.');
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
            toast.success('Journey published successfully!');
          },
          onError: (err: any) => {
            toast.error(err?.message || 'Failed to publish journey.');
          },
        }
      );
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
        <h2 className="text-xl font-bold">Failed to Load Journey Builder</h2>
        <p className="text-muted-foreground">{(error as any)?.message || 'The requested journey details could not be retrieved.'}</p>
        <Button onClick={() => refetch()} className="mx-auto">
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  const allLessons = journey?.modules?.flatMap((m) => m.lessons) || [];
  const selectedLesson = allLessons.find((l) => l.id === selectedLessonId) || allLessons[0];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-6">
      <header className="flex-none border-b bg-background px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/journeys">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{isNew ? (title || 'New Journey') : (journey?.title || 'Engineering Onboarding')}</h1>
              <Badge variant={journey?.status === 'Active' ? 'default' : 'secondary'}>
                {journey?.status || 'Draft'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isNew ? 'Not saved yet' : `Last saved ${journey?.lastUpdated || 'just now'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSave} disabled={updateJourney.isPending || createJourney.isPending}>
            {(updateJourney.isPending || createJourney.isPending) && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
          {!isNew && journey?.status !== 'Active' && (
            <Button onClick={handlePublish} disabled={updateJourney.isPending}>
              Publish
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="builder" className="h-full flex flex-col">
          <div className="px-6 border-b">
            <TabsList className="h-12 bg-transparent">
              <TabsTrigger
                value="builder"
                className="data-[state=active]:bg-muted">
                Builder
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-muted">
                Settings
              </TabsTrigger>
              <TabsTrigger
                value="assignments"
                className="data-[state=active]:bg-muted">
                Assignments
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="builder"
            className="flex-1 flex overflow-hidden m-0 data-[state=active]:flex">

            {/* Left Sidebar - Outline */}
            <div className="w-80 border-r bg-muted/10 flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-medium">Curriculum</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {isNew || !journey?.modules || journey.modules.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground p-4">
                      Add your first module to get started building curriculum.
                    </div>
                  ) : (
                    journey.modules.map((module, mIdx) => (
                      <div key={module.id}>
                        {mIdx > 0 && <Separator className="my-2" />}
                        <div>
                          <div className="flex items-center gap-2 mb-2 group">
                            <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                            <h4 className="text-sm font-semibold">{mIdx + 1}. {module.title}</h4>
                          </div>
                          <div className="space-y-1 pl-6">
                            {module.lessons.map((lesson) => {
                              const isSelected = selectedLesson?.id === lesson.id;
                              return (
                                <div
                                  key={lesson.id}
                                  onClick={() => setSelectedLessonId(lesson.id)}
                                  className={`flex items-center gap-2 p-2 rounded-md text-sm cursor-pointer ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                                    }`}>
                                  {lesson.type === 'Video' ? (
                                    <Video className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                  ) : lesson.type === 'Quiz' ? (
                                    <HelpCircle className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                  ) : (
                                    <FileText className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                  )}
                                  <span>{lesson.title}</span>
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

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-background overflow-auto">
              {selectedLesson ? (
                <div className="max-w-3xl mx-auto w-full p-8 space-y-8">
                  <div>
                    <Input
                      defaultValue={selectedLesson.title}
                      className="text-3xl font-bold h-auto py-2 px-0 border-0 focus-visible:ring-0 rounded-none bg-transparent"
                    />
                    <p className="text-muted-foreground mt-2">
                      {selectedLesson.type} Lesson • {selectedLesson.duration}
                    </p>
                  </div>

                  <Card>
                    <CardContent className="p-0">
                      {selectedLesson.type === 'Video' ? (
                        <div className="aspect-video bg-muted flex flex-col items-center justify-center text-muted-foreground border-b">
                          <Video className="h-12 w-12 mb-4 opacity-50" />
                          <p>Upload or embed a video</p>
                          <Button variant="outline" className="mt-4">
                            Select Video
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 border-b bg-muted/20 min-h-[150px] flex items-center justify-center text-muted-foreground text-sm">
                          {selectedLesson.type} Content editor placeholder.
                        </div>
                      )}
                      <div className="p-4">
                        <Input
                          placeholder="Add a description or transcript..."
                          className="border-0 focus-visible:ring-0 px-0 bg-transparent"
                          defaultValue={selectedLesson.description || ''}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Select a lesson in the curriculum sidebar to edit content.
                </div>
              )}
            </div>

            {/* Right Sidebar - Settings */}
            <div className="w-80 border-l bg-muted/10 flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-medium">Lesson Settings</h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {selectedLesson ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estimated Time</label>
                      <div className="flex items-center gap-2">
                        <Input type="number" defaultValue={selectedLesson.estimatedTime || 5} className="w-20" />
                        <span className="text-sm text-muted-foreground">minutes</span>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Completion Rule</label>
                      <Select defaultValue={selectedLesson.completionRule || 'video'}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="video">Watch 90% of video</SelectItem>
                          <SelectItem value="button">Click complete button</SelectItem>
                          <SelectItem value="quiz">Pass attached quiz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    Select a lesson to configure settings.
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent
            value="settings"
            className="flex-1 p-8 m-0 overflow-auto">

            <div className="max-w-2xl mx-auto space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-4">Journey Settings</h2>
                <Card>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Journey Title</label>
                      <Input value={title} onChange={(e: any) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Description</label>
                      <Input value={description} onChange={(e: any) => setDescription(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="engineering">Engineering</SelectItem>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="general">General</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="assignments"
            className="flex-1 p-8 m-0 overflow-auto">

            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Assignments</h2>
                <Button>Assign Journey</Button>
              </div>
              <Card>
                <CardContent className="p-0">
                  <div className="p-8 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No one is assigned to this journey yet.</p>
                    <p className="text-sm mt-1">
                      Assign this journey to employees, teams, or departments.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}