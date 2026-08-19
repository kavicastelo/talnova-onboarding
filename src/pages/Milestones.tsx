import React, { useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Award,
  UserCheck,
  Star,
  Plus,
  Send,
  Building2,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import {
  useMyMilestones,
  useTeamMilestones,
  useMilestoneTemplates,
  useSubmitSelfCheckin,
  useSubmitManagerReview,
  useCreateMilestoneTemplate
} from '../hooks/useMilestones';
import { useRole } from '../context/RoleContext';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
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

export const Milestones: React.FC = () => {
  const { role } = useRole();
  const isAdmin = role === 'admin' || role === 'owner';
  const isManager = role === 'manager' || isAdmin;

  const [activeTab, setActiveTab] = useState<'my' | 'team' | 'templates'>(isManager ? 'team' : 'my');

  // Modals state
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isSelfCheckinOpen, setIsSelfCheckinOpen] = useState(false);
  const [isManagerReviewOpen, setIsManagerReviewOpen] = useState(false);
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);

  // Self Check-in Form
  const [answers, setAnswers] = useState<{ [qId: string]: string }>({});
  const [confidenceRating, setConfidenceRating] = useState(5);
  const [selfComments, setSelfComments] = useState('');
  const [completedGoals, setCompletedGoals] = useState<string[]>([]);

  // Manager Review Form
  const [managerRating, setManagerRating] = useState(5);
  const [managerFeedback, setManagerFeedback] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'needs_action'>('approved');

  // Create Template Form
  const [newTitle, setNewTitle] = useState('');
  const [newTargetDay, setNewTargetDay] = useState<30 | 60 | 90>(30);
  const [newGoal, setNewGoal] = useState('');
  const [templateGoals, setTemplateGoals] = useState<string[]>([]);

  const { data: myMilestones, isLoading: myLoading, refetch: refetchMy } = useMyMilestones();
  const { data: teamMilestones, isLoading: teamLoading, refetch: refetchTeam } = useTeamMilestones();
  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useMilestoneTemplates();

  const submitSelfCheckinMutation = useSubmitSelfCheckin();
  const submitManagerReviewMutation = useSubmitManagerReview();
  const createTemplateMutation = useCreateMilestoneTemplate();

  const handleSelfCheckinSubmit = () => {
    if (!selectedMilestone) return;

    const responses = (selectedMilestone.templateId?.checkinQuestions || [
      { _id: 'q1', question: 'What were your key wins?' },
      { _id: 'q2', question: 'Do you need additional support?' }
    ]).map((q: any) => ({
      questionId: q._id || 'q1',
      question: q.question,
      answer: answers[q._id || 'q1'] || 'Completed check-in objectives.',
    }));

    submitSelfCheckinMutation.mutate(
      {
        id: selectedMilestone._id,
        payload: {
          responses,
          confidenceRating,
          comments: selfComments,
          goalsCompletedTitles: completedGoals,
        },
      },
      {
        onSuccess: () => {
          toast.success('Self check-in submitted successfully!');
          setIsSelfCheckinOpen(false);
          setSelectedMilestone(null);
          refetchMy();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to submit check-in');
        }
      }
    );
  };

  const handleManagerReviewSubmit = () => {
    if (!selectedMilestone) return;

    submitManagerReviewMutation.mutate(
      {
        id: selectedMilestone._id,
        payload: {
          approvalStatus,
          performanceRating: managerRating,
          feedback: managerFeedback,
        },
      },
      {
        onSuccess: () => {
          toast.success('Manager review & rating submitted successfully!');
          setIsManagerReviewOpen(false);
          setSelectedMilestone(null);
          refetchTeam();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to submit review');
        }
      }
    );
  };

  const handleCreateTemplate = () => {
    if (!newTitle.trim()) {
      toast.error('Please enter a milestone program title.');
      return;
    }

    createTemplateMutation.mutate(
      {
        title: newTitle,
        targetDay: newTargetDay,
        goals: templateGoals.map((title) => ({ title })),
        checkinQuestions: [
          { question: `What were your key accomplishments during your Day ${newTargetDay} milestone?`, type: 'text', required: true },
          { question: 'Rate your confidence in independent job execution', type: 'rating', required: true },
        ],
        audience: { autoAssignNewHires: true },
      },
      {
        onSuccess: () => {
          toast.success('Milestone template created!');
          setIsCreateTemplateOpen(false);
          setNewTitle('');
          setTemplateGoals([]);
          refetchTemplates();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || 'Failed to create template');
        }
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarCheck className="h-7 w-7 text-indigo-600" />
            30 / 60 / 90-Day Milestones & Check-Ins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track early onboarding progression, conduct structured self-evaluations, and receive manager performance reviews.
          </p>
        </div>
        {isAdmin && (
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setIsCreateTemplateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Milestone Program
          </Button>
        )}
      </div>

      {/* Program Summary Banner Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-sky-500 bg-sky-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-sky-700">
              <Clock className="h-4 w-4" /> Day 30 — Fast-Start & Orientation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Complete team introductions, initial IT setup, security training, and first learning journey.
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-700">
              <Award className="h-4 w-4" /> Day 60 — Execution & Autonomy
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Deliver independent project contributions, shadow senior mentors, and master core workflow tools.
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Day 90 — Full Integration & Graduation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Achieve full operational productivity, conduct comprehensive probation review, and set quarterly goals.
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b text-sm font-medium">
        <button
          className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'my'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('my')}
        >
          <CalendarCheck className="h-4 w-4" /> My Milestones ({myMilestones?.length || 0})
        </button>
        {isManager && (
          <button
            className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'team'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('team')}
          >
            <UserCheck className="h-4 w-4" /> Team Milestones ({teamMilestones?.length || 0})
          </button>
        )}
        {isAdmin && (
          <button
            className={`py-3 px-6 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('templates')}
          >
            <Building2 className="h-4 w-4" /> Milestone Templates ({templates?.length || 0})
          </button>
        )}
      </div>

      {/* Tab 1: My Milestones Timeline */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {myLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading your milestones...</div>
          ) : (myMilestones || []).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
              No 30/60/90-day milestones assigned yet. Automatic schedule will calculate upon onboarding initiation.
            </div>
          ) : (
            <div className="space-y-6">
              {myMilestones?.map((m) => {
                const completedGoalsCount = m.goalsProgress?.filter((g) => g.completed).length || 0;
                const totalGoalsCount = m.goalsProgress?.length || 1;
                const progressPct = Math.round((completedGoalsCount / totalGoalsCount) * 100);

                return (
                  <Card key={m._id} className="hover:border-indigo-500/40 transition-all">
                    <CardHeader className="pb-3 border-b">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-indigo-600 text-white font-bold px-3 py-1 text-sm">
                            Day {m.targetDay}
                          </Badge>
                          <div>
                            <CardTitle className="text-base font-semibold">{m.milestoneTitle}</CardTitle>
                            <CardDescription className="text-xs">
                              Target Due Date: {new Date(m.dueDate).toLocaleDateString()}
                            </CardDescription>
                          </div>
                        </div>

                        <div>
                          {m.status === 'completed' && (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Milestone Completed & Approved
                            </Badge>
                          )}
                          {m.status === 'in_review' && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <Clock className="h-3.5 w-3.5 mr-1" /> Pending Manager Review
                            </Badge>
                          )}
                          {m.status === 'pending' && (
                            <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
                              In Progress
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 space-y-6">
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span>Milestone Goals Progress</span>
                          <span>
                            {completedGoalsCount} of {totalGoalsCount} Goals ({progressPct}%)
                          </span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                      </div>

                      {/* Goals List */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Key Objectives & Goals</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {m.goalsProgress?.map((g, idx) => (
                            <div key={idx} className="p-2.5 border rounded-md text-xs flex items-center justify-between bg-card">
                              <span>{g.goalTitle}</span>
                              {g.completed ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : (
                                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Manager Feedback section if completed */}
                      {m.managerReview && m.managerReview.feedback && (
                        <div className="p-4 border rounded-lg bg-indigo-50/20 text-xs space-y-1">
                          <span className="font-semibold text-indigo-700 flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /> Manager Feedback (Rating: {m.managerReview.performanceRating || 5}/5):
                          </span>
                          <p className="text-slate-700 italic">"{m.managerReview.feedback}"</p>
                        </div>
                      )}

                      {/* Action Button */}
                      {m.status === 'pending' && (
                        <div className="flex justify-end pt-2">
                          <Button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                            onClick={() => {
                              setSelectedMilestone(m);
                              setIsSelfCheckinOpen(true);
                            }}
                          >
                            <FileCheck className="h-4 w-4 mr-1.5" /> Complete Self Check-In
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Team Milestones (Manager View) */}
      {activeTab === 'team' && isManager && (
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Direct Report 30/60/90 Check-Ins</CardTitle>
            <CardDescription>Review self-assessments and approve onboarding milestones for team members.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {teamLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading team milestones...</div>
            ) : (teamMilestones || []).length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No direct report milestones requiring review.</div>
            ) : (
              <div className="divide-y">
                {teamMilestones?.map((m) => {
                  const empName = m.employeeId?.profile
                    ? `${m.employeeId.profile.firstName || ''} ${m.employeeId.profile.lastName || ''}`
                    : 'Employee';

                  return (
                    <div key={m._id} className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm">{empName}</h4>
                          <Badge className="bg-indigo-100 text-indigo-800 text-[10px]">
                            Day {m.targetDay}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {m.milestoneTitle} | Target Due: {new Date(m.dueDate).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {m.status === 'completed' ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Approved (Rating: {m.managerReview?.performanceRating || 5}/5)
                          </Badge>
                        ) : m.status === 'in_review' ? (
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                            onClick={() => {
                              setSelectedMilestone(m);
                              setIsManagerReviewOpen(true);
                            }}
                          >
                            Review & Approve Check-In
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Self Check-in Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Milestone Templates (Admin View) */}
      {activeTab === 'templates' && isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templatesLoading ? (
            <div className="col-span-full p-8 text-center text-muted-foreground">Loading templates...</div>
          ) : (
            templates?.map((t) => (
              <Card key={t._id}>
                <CardHeader>
                  <Badge className="w-fit bg-indigo-600 text-white text-[10px]">Day {t.targetDay}</Badge>
                  <CardTitle className="text-base font-semibold mt-2">{t.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <div>Goals Count: {t.goals?.length || 0}</div>
                  <div>Questions Count: {t.checkinQuestions?.length || 0}</div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal: Employee Self Check-In */}
      <Dialog open={isSelfCheckinOpen} onOpenChange={setIsSelfCheckinOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Day {selectedMilestone?.targetDay} Self Check-In</DialogTitle>
            <DialogDescription>Evaluate your progress and submit feedback for your manager.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-2">Check-off Completed Goals:</label>
              <div className="space-y-2">
                {selectedMilestone?.goalsProgress?.map((g: any, idx: number) => (
                  <label key={idx} className="flex items-center gap-2 text-xs cursor-pointer p-2 border rounded hover:bg-muted/20">
                    <input
                      type="checkbox"
                      checked={completedGoals.includes(g.goalTitle)}
                      onChange={(e) => {
                        if (e.target.checked) setCompletedGoals([...completedGoals, g.goalTitle]);
                        else setCompletedGoals(completedGoals.filter((title) => title !== g.goalTitle));
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{g.goalTitle}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Confidence & Satisfaction Rating (1 to 5):</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setConfidenceRating(star)}
                    className={`p-2 rounded border flex items-center justify-center transition-colors ${
                      confidenceRating >= star ? 'bg-amber-100 border-amber-400 text-amber-600' : 'bg-background'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Self-Assessment Summary & Key Wins:</label>
              <textarea
                className="w-full min-h-[90px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Share your accomplishments, challenges, or support needed..."
                value={selfComments}
                onChange={(e) => setSelfComments(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSelfCheckinOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSelfCheckinSubmit}>
              Submit Check-In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Manager Review & Approval */}
      <Dialog open={isManagerReviewOpen} onOpenChange={setIsManagerReviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Day {selectedMilestone?.targetDay} Milestone Check-In</DialogTitle>
            <DialogDescription>
              Review direct report's self-assessment and record manager sign-off.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Approval Status:</label>
              <select
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                value={approvalStatus}
                onChange={(e: any) => setApprovalStatus(e.target.value)}
              >
                <option value="approved">Approved & Complete</option>
                <option value="needs_action">Needs Follow-Up / Action</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Performance Rating (1 to 5 Stars):</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setManagerRating(star)}
                    className={`p-2 rounded border flex items-center justify-center transition-colors ${
                      managerRating >= star ? 'bg-amber-100 border-amber-400 text-amber-600' : 'bg-background'
                    }`}
                  >
                    <Star className="h-4 w-4 fill-current" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Manager Feedback & Encouragement:</label>
              <textarea
                className="w-full min-h-[90px] text-sm p-2.5 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="Leave feedback notes for your direct report..."
                value={managerFeedback}
                onChange={(e) => setManagerFeedback(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManagerReviewOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleManagerReviewSubmit}>
              Submit Manager Sign-Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Milestones;
