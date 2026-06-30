import { apiClient } from '../api/client';
import { AdminDashboardSummary, ApiResponse } from '../types';

export const dashboardService = {
  getDashboardSummary: async (): Promise<AdminDashboardSummary> => {
    // Fetch all dashboard requirements in parallel
    const [orgRes, empRes, journeyRes, analyticsRes, auditRes] = await Promise.all([
      apiClient.get<ApiResponse<any>>('/organizations/current'),
      apiClient.get<ApiResponse<any[]>>('/employees').catch(() => ({ data: { data: [] } })),
      apiClient.get<ApiResponse<any[]>>('/journeys').catch(() => ({ data: { data: [] } })),
      apiClient.get<ApiResponse<any>>('/analytics/summary').catch(() => ({ data: { data: null } })),
      apiClient.get<ApiResponse<any>>('/audit-logs?limit=10').catch(() => ({ data: { data: [] } }))
    ]);

    const org = orgRes.data.data;
    const employees = empRes.data.data || [];
    const journeys = journeyRes.data.data || [];
    const analytics = analyticsRes.data?.data;

    const totalEmployees = employees.length || org.analytics?.totalEmployees || 0;
    const activeJourneys = journeys.filter((j: any) => j.publishing?.status === 'published').length || org.analytics?.journeys || 0;
    
    // Map completions trend over time
    const completionsOverTime = analytics?.completionTrend
      ? analytics.completionTrend.map((t: any) => ({
          name: t.name,
          completions: t.rate || 0
        }))
      : [
          { name: 'Jan', completions: 0 },
          { name: 'Feb', completions: 0 },
          { name: 'Mar', completions: 0 },
          { name: 'Apr', completions: 0 },
          { name: 'May', completions: 0 },
          { name: 'Jun', completions: 0 }
        ];

    // Map recent audit log activities
    const recentActivity = (auditRes.data?.data || []).map((log: any) => {
      const firstName = log.actorUserId?.profile?.firstName || '';
      const lastName = log.actorUserId?.profile?.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'System';
      const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'SYS';
      
      const date = new Date(log.createdAt);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHrs / 24);

      let timeAgo = 'Just now';
      if (diffDays > 0) {
        timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else if (diffHrs > 0) {
        timeAgo = `${diffHrs} hr${diffHrs > 1 ? 's' : ''} ago`;
      } else if (diffMins > 0) {
        timeAgo = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      }

      return {
        id: log._id,
        userInitials: initials,
        userName: fullName,
        actionDescription: `${log.description || ''}`,
        journeyTitle: log.metadata?.journeyTitle || '',
        timeAgo
      };
    });

    // Calculate average completion rate from employee progress
    const rates = employees.map((e: any) => e.statistics?.completionRate || 0);
    const avgRate = rates.length ? Math.round(rates.reduce((a: number, b: number) => a + b, 0) / rates.length) : (org.analytics?.completionRate || 0);

    return {
      totalEmployees,
      totalEmployeesDelta: 'Total registered',
      activeJourneys,
      activeJourneysDelta: 'Active programs',
      completionRate: avgRate,
      completionRateDelta: analytics?.avgCompletionRateDelta || '+0%',
      avgTimeToComplete: analytics?.learningHours ? `${analytics.learningHours} hours` : '0 hours',
      avgTimeToCompleteDelta: 'Total learning time',
      completionsOverTime,
      recentActivity
    };
  }
};

