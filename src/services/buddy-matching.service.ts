import { Employee } from '../types';

export interface IBuddyCompatibilityCriteria {
  departmentScore: number; // 0.0 - 1.0 (weight 0.35)
  locationScore: number;   // 0.0 - 1.0 (weight 0.25)
  languageScore: number;   // 0.0 - 1.0 (weight 0.20)
  capacityScore: number;   // 0.0 - 1.0 (weight 0.15)
  skillsScore: number;     // 0.0 - 1.0 (weight 0.05)
}

export interface IBuddyCandidateMatch {
  buddy: any;
  score: number; // 0.0 - 1.0 (composite)
  scorePercent: number; // 0 - 100
  criteria: IBuddyCompatibilityCriteria;
  matchTier: 'optimal' | 'strong' | 'moderate' | 'low';
  reasons: string[];
}

/**
 * Client-side multi-factor compatibility calculator mirroring server/src/modules/buddy/services/buddy.service.ts
 * Weights: Dept: 0.35, Loc/Tz: 0.25, Lang: 0.20, Capacity: 0.15, Skills: 0.05
 */
export function calculateClientCompatibilityScore(
  newHire: Partial<Employee> | any,
  candidateBuddy: any
): IBuddyCandidateMatch {
  const hireDept = (newHire?.department || newHire?.employment?.department || '').trim().toLowerCase();
  const candDept = (
    candidateBuddy?.department ||
    candidateBuddy?.userId?.employment?.department ||
    ''
  ).trim().toLowerCase();

  // 1. Department Score (0.35)
  let departmentScore = 0.1;
  const deptReasons: string[] = [];
  if (hireDept && candDept && hireDept === candDept) {
    departmentScore = 1.0;
    deptReasons.push(`Exact department match (${newHire.department || 'Shared'})`);
  } else {
    const techDepts = ['engineering', 'product', 'design', 'qa', 'devops'];
    const businessDepts = ['sales', 'marketing', 'customer success', 'partnerships'];
    if (techDepts.includes(hireDept) && techDepts.includes(candDept)) {
      departmentScore = 0.6;
      deptReasons.push('Cross-functional tech alignment');
    } else if (businessDepts.includes(hireDept) && businessDepts.includes(candDept)) {
      departmentScore = 0.6;
      deptReasons.push('Business operations alignment');
    } else {
      deptReasons.push('Cross-department cultural mentor');
    }
  }

  // 2. Location & Timezone Score (0.25)
  let locationScore = 0.5;
  const hireLoc = (newHire?.location || newHire?.profile?.location || '').trim().toLowerCase();
  const candLoc = (
    candidateBuddy?.userId?.profile?.location ||
    candidateBuddy?.location ||
    ''
  ).trim().toLowerCase();

  if (hireLoc && candLoc && hireLoc === candLoc) {
    locationScore = 1.0;
    deptReasons.push(`Same physical office (${newHire.location})`);
  } else {
    locationScore = 0.7; // Default reasonable timezone overlap
  }

  // 3. Language Score (0.20)
  const hireLang = (newHire?.rawUser?.preferences?.language || 'en').trim().toLowerCase();
  const candLanguages: string[] = (
    candidateBuddy?.languages?.length
      ? candidateBuddy.languages
      : [candidateBuddy?.userId?.preferences?.language || 'en']
  ).map((l: string) => l.trim().toLowerCase());

  const hasSharedLang = candLanguages.some(
    (l) => l === hireLang || l.startsWith(hireLang) || hireLang.startsWith(l)
  );
  const languageScore = hasSharedLang ? 1.0 : 0.4;
  if (hasSharedLang) {
    deptReasons.push('Shared working language');
  }

  // 4. Capacity Score (0.15)
  const maxMentees = Math.max(1, candidateBuddy?.maxMentees || 3);
  const currentMentees = candidateBuddy?.currentMenteeCount || 0;
  const availableCapacity = Math.max(0, maxMentees - currentMentees);
  const capacityScore = Math.min(1.0, availableCapacity / maxMentees);
  if (capacityScore >= 0.6) {
    deptReasons.push(`High mentor availability (${availableCapacity}/${maxMentees} slots)`);
  }

  // 5. Skills Overlap (0.05)
  const candSkills: string[] = (candidateBuddy?.skills || []).map((s: string) => s.trim().toLowerCase());
  const hireRole = (newHire?.designation || newHire?.role || '').trim().toLowerCase();
  let skillsScore = 0.5;
  if (candSkills.length > 0 && hireRole) {
    const hasRoleMatch = candSkills.some((s) => hireRole.includes(s) || s.includes(hireRole));
    skillsScore = hasRoleMatch ? 1.0 : 0.6;
    if (hasRoleMatch) deptReasons.push('Domain skill overlap');
  }

  // Composite Score
  const composite =
    0.35 * departmentScore +
    0.25 * locationScore +
    0.20 * languageScore +
    0.15 * capacityScore +
    0.05 * skillsScore;

  const finalScore = Math.round(composite * 100) / 100;
  const scorePercent = Math.round(finalScore * 100);

  let matchTier: 'optimal' | 'strong' | 'moderate' | 'low' = 'low';
  if (scorePercent >= 85) matchTier = 'optimal';
  else if (scorePercent >= 70) matchTier = 'strong';
  else if (scorePercent >= 55) matchTier = 'moderate';

  return {
    buddy: candidateBuddy,
    score: finalScore,
    scorePercent,
    criteria: {
      departmentScore: Math.round(departmentScore * 100) / 100,
      locationScore: Math.round(locationScore * 100) / 100,
      languageScore: Math.round(languageScore * 100) / 100,
      capacityScore: Math.round(capacityScore * 100) / 100,
      skillsScore: Math.round(skillsScore * 100) / 100,
    },
    matchTier,
    reasons: deptReasons,
  };
}

export const buddyMatchingService = {
  rankBuddyCandidates: (newHire: any, availableBuddies: any[]): IBuddyCandidateMatch[] => {
    return availableBuddies
      .map((b) => calculateClientCompatibilityScore(newHire, b))
      .sort((a, b) => b.score - a.score);
  },
};
