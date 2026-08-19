import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface UnlockedBadge {
  badgeId: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
}

export interface PointHistoryItem {
  action: string;
  points: number;
  description: string;
  timestamp: string;
}

export interface GamificationProfileData {
  _id: string;
  userId: string;
  points: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate?: string;
  unlockedBadges: UnlockedBadge[];
  pointHistory: PointHistoryItem[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  email: string;
  department: string;
  points: number;
  level: number;
  currentStreak: number;
  badgesCount: number;
  badges: UnlockedBadge[];
}

export const gamificationService = {
  getProfile: async (): Promise<GamificationProfileData> => {
    const response = await apiClient.get<ApiResponse<GamificationProfileData>>('/gamification/profile');
    return response.data.data;
  },

  awardPoints: async (action: string, points: number, description: string): Promise<GamificationProfileData> => {
    const response = await apiClient.post<ApiResponse<GamificationProfileData>>('/gamification/award-points', {
      action,
      points,
      description,
    });
    return response.data.data;
  },

  recordStreak: async (): Promise<GamificationProfileData> => {
    const response = await apiClient.post<ApiResponse<GamificationProfileData>>('/gamification/streak');
    return response.data.data;
  },

  getLeaderboard: async (): Promise<LeaderboardEntry[]> => {
    const response = await apiClient.get<ApiResponse<LeaderboardEntry[]>>('/gamification/leaderboard');
    return response.data.data || [];
  },
};

export default gamificationService;
