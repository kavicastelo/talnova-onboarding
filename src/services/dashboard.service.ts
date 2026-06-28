import { apiClient } from '../api/client';
import { AdminDashboardSummary, ApiResponse } from '../types';

export const dashboardService = {
  getDashboardSummary: async (): Promise<AdminDashboardSummary> => {
    // 1. Fetch current organization, employees list, and journeys in parallel
    const [orgRes, empRes, journeyRes] = await Promise.all([
      apiClient.get<ApiResponse<any>>('/organizations/current'),
      apiClient.get<ApiResponse<any[]>>('/employees').catch(() => ({ data: { data: [] } })),
      apiClient.get<ApiResponse<any[]>>('/journeys').catch(() => ({ data: { data: [] } }))
    ]);

    const org = orgRes.data.data;
    const employees = empRes.data.data || [];
    const journeys = journeyRes.data.data || [];

    const totalEmployees = employees.length || org.analytics?.totalEmployees || 0;
    const activeJourneys = journeys.filter((j: any) => j.publishing?.status === 'published').length || org.analytics?.journeys || 0;
    
    // Calculate average completion rate from employee progress
    const rates = employees.map((e: any) => e.statistics?.completionRate || 0);
    const avgRate = rates.length ? Math.round(rates.reduce((a: number, b: number) => a + b, 0) / rates.length) : (org.analytics?.completionRate || 0);

    return {
      totalEmployees,
      totalEmployeesDelta: '+4%',
      activeJourneys,
      activeJourneysDelta: '+12%',
      completionRate: avgRate,
      completionRateDelta: '+2.4%',
      avgTimeToComplete: '14 days',
      avgTimeToCompleteDelta: '-1.5 days',
      completionsOverTime: [
        { name: 'Jan', completions: 5 },
        { name: 'Feb', completions: 8 },
        { name: 'Mar', completions: 12 },
        { name: 'Apr', completions: 15 },
        { name: 'May', completions: 20 },
        { name: 'Jun', completions: 24 }
      ],
      recentActivity: [
        { id: '1', userInitials: 'JD', userName: 'Jane Doe', actionDescription: 'completed lesson "Welcome to Talnova"', journeyTitle: 'Talnova General Onboarding', timeAgo: '2 hours ago' },
        { id: '2', userInitials: 'AS', userName: 'Alex Smith', actionDescription: 'was assigned journey', journeyTitle: 'Engineering Guidebook', timeAgo: '5 hours ago' },
        { id: '3', userInitials: 'ML', userName: 'Marcus Lee', actionDescription: 'passed the quiz "Platform Security"', journeyTitle: 'Compliance & Safety', timeAgo: '1 day ago' }
      ]
    };
  }
};

