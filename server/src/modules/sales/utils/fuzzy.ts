/**
 * Fuzzy matching utilities for lead deduplication
 */

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

export function stringSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const maxLen = Math.max(s1.length, s2.length);
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - distance / maxLen);
}

export function cleanCompanyName(company: string): string {
  if (!company) return "";
  return company
    .toLowerCase()
    .replace(/[,\.\-\_]/g, " ")
    .replace(
      /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|gmbh|sa|pvt|group|holdings|enterprises)\b/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanContactName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[,\.\-\_]/g, " ")
    .replace(/\b(mr|mrs|ms|dr|prof)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameSimilarity(a: string, b: string): number {
  const cleanA = cleanContactName(a);
  const cleanB = cleanContactName(b);
  if (cleanA === cleanB) return 1;
  if (!cleanA || !cleanB) return 0;

  const tokensA = cleanA.split(" ").filter(Boolean);
  const tokensB = cleanB.split(" ").filter(Boolean);

  // If last names match exactly
  if (tokensA.length > 1 && tokensB.length > 1) {
    const lastA = tokensA[tokensA.length - 1];
    const lastB = tokensB[tokensB.length - 1];

    if (lastA === lastB) {
      const firstA = tokensA[0];
      const firstB = tokensB[0];
      // Common abbreviation/prefix: e.g. John / Jonathan, Rob / Robert, Dan / Daniel
      if (firstA.startsWith(firstB) || firstB.startsWith(firstA)) {
        return 0.88;
      }
      const firstSim = stringSimilarity(firstA, firstB);
      return Math.round((0.5 + firstSim * 0.5) * 100) / 100;
    }
  }

  return stringSimilarity(cleanA, cleanB);
}
