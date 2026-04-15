import { Qc } from "./qc";

export function getBestPGsForLead(lead: any, pgs: any[]) {
  const scored = pgs.map(pg => ({
    ...pg,
    score: Qc(pg, lead),
  }));

  const sorted = scored
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    top3: sorted.slice(0, 3),
    next3: sorted.slice(3, 6),
  };
}