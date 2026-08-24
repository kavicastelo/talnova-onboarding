import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { Progress } from '../components/Progress';
import { Skeleton } from '../components/Skeleton';
import {
  Trophy,
  Flame,
  Award,
  Star,
  Sparkles
} from 'lucide-react';
import {
  useGamificationProfile,
  useLeaderboard,
  useAwardPoints
} from '../hooks/useGamification';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { usePagination } from '../hooks/usePagination';

export function Leaderboard() {
  const { data: profile, isLoading: isProfileLoading } = useGamificationProfile();
  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard();
  const awardPointsMutation = useAwardPoints();

  const leaderboardPagination = usePagination({ data: leaderboard || [], initialPageSize: 10 });

  const currentLevel = profile?.level || 1;
  const currentPoints = profile?.points || 0;
  const levelProgress = Math.min(100, Math.round(((currentPoints % 100) / 100) * 100));

  const handleTestAwardPoints = () => {
    awardPointsMutation.mutate(
      {
        action: 'quiz_completion',
        points: 25,
        description: 'Completed onboarding practice quiz',
      },
      {
        onSuccess: () => {
          toast.success('+25 XP Awarded! Keep up the great work!');
        },
      }
    );
  };

  if (isProfileLoading || isLeaderboardLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const top3 = (leaderboard || []).slice(0, 3);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Trophy className="h-7 w-7 text-amber-500" />
            Gamification & Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Earn XP points, unlock micro-credential badges, and maintain learning streaks across your onboarding journey.
          </p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleTestAwardPoints}>
          <Sparkles className="h-4 w-4 mr-2" /> Claim Practice +25 XP
        </Button>
      </div>

      {/* Profile XP & Badges Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Level & XP */}
        <Card className="p-5 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background border border-indigo-500/20 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Your Progress</span>
            <Badge className="bg-indigo-600 text-white">Level {currentLevel}</Badge>
          </div>
          <div className="text-3xl font-extrabold mt-3">{currentPoints} <span className="text-sm font-medium text-muted-foreground">XP</span></div>
          <div className="space-y-1.5 mt-3">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Level Progress</span>
              <span>{levelProgress}%</span>
            </div>
            <Progress value={levelProgress} className="h-2 bg-indigo-100" />
          </div>
        </Card>

        {/* Streaks */}
        <Card className="p-5 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-background border border-amber-500/20 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Active Streak</span>
            <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
          </div>
          <div className="text-3xl font-extrabold mt-3">{profile?.currentStreak || 1} <span className="text-sm font-medium text-muted-foreground">Days</span></div>
          <p className="text-xs text-muted-foreground mt-2">
            Longest Streak: <span className="font-semibold text-foreground">{profile?.longestStreak || 1} days</span>
          </p>
        </Card>

        {/* Badges Unlocked */}
        <Card className="p-5 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-background border border-emerald-500/20 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Micro-Credentials</span>
            <Award className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold mt-3">{(profile?.unlockedBadges || []).length} <span className="text-sm font-medium text-muted-foreground">Badges</span></div>
          <p className="text-xs text-muted-foreground mt-2">Unlocked micro-credentials</p>
        </Card>
      </div>

      {/* Badges Showcase Grid */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Unlocked Badges & Achievements
          </CardTitle>
          <CardDescription>Earn badges as you complete onboarding tasks, milestones, and quizzes.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {(profile?.unlockedBadges || []).length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-xs">
              No badges unlocked yet. Complete onboarding modules to earn your first badge!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {profile?.unlockedBadges.map((b) => (
                <div key={b.badgeId} className="p-3.5 bg-muted/20 border rounded-lg flex items-center gap-3">
                  <div className="text-3xl">{b.icon}</div>
                  <div>
                    <div className="font-semibold text-xs text-foreground">{b.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{b.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Leaderboard Section */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Organization Leaderboard
          </CardTitle>
          <CardDescription>Top onboarding learners across your organization.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Top 3 Podium */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b">
              {top3.map((entry) => (
                <div
                  key={entry.userId}
                  className={`p-4 rounded-xl border text-center relative ${
                    entry.rank === 1
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : entry.rank === 2
                      ? 'bg-slate-500/10 border-slate-500/30'
                      : 'bg-amber-700/10 border-amber-700/30'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                  </div>
                  <div className="font-bold text-sm text-foreground">{entry.name}</div>
                  <div className="text-xs text-muted-foreground">{entry.department}</div>
                  <div className="text-lg font-extrabold text-indigo-600 mt-2">{entry.points} XP</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Level {entry.level} • 🔥 {entry.currentStreak}d Streak</div>
                </div>
              ))}
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Employee</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Level</th>
                  <th className="py-2.5 px-3">Streak</th>
                  <th className="py-2.5 px-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leaderboardPagination.paginatedData.map((row) => (
                  <tr key={row.userId} className="hover:bg-muted/20">
                    <td className="py-3 px-3 font-bold text-muted-foreground">#{row.rank}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-foreground">{row.name}</div>
                      <div className="text-muted-foreground text-[11px]">{row.email}</div>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">{row.department}</td>
                    <td className="py-3 px-3">
                      <Badge variant="outline">Lvl {row.level}</Badge>
                    </td>
                    <td className="py-3 px-3 font-medium text-orange-600 flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5 fill-orange-500" /> {row.currentStreak}d
                    </td>
                    <td className="py-3 px-3 font-extrabold text-indigo-600 text-right text-sm">
                      {row.points} XP
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 border-t">
            <SimplePagination
              currentPage={leaderboardPagination.page}
              totalPages={leaderboardPagination.totalPages}
              totalItems={leaderboardPagination.totalItems}
              startIndex={leaderboardPagination.startIndex}
              endIndex={leaderboardPagination.endIndex}
              pageSize={leaderboardPagination.pageSize}
              onPageChange={leaderboardPagination.setPage}
              onPageSizeChange={leaderboardPagination.setPageSize}
              itemLabel="learners"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Leaderboard;
