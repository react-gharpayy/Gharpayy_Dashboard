import { nb } from "./npMap";

export function Qc(pg: any, lead: any) {
  let score = 0;

  const query = (lead.preferredLocation || "").toLowerCase();
  const area = (pg.area || "").toLowerCase();

  // LOCATION
  if (query === area) score += 40;
  else if (nb[area]?.some(k => query.includes(k))) score += 32;
  else if (query.includes(area)) score += 25;
  else if (pg.locality?.toLowerCase().includes(query)) score += 20;

  // GENDER
  if (!lead.gender || lead.gender === pg.gender) score += 25;
  else if (pg.gender === "Co-live") score += 15;

  // BUDGET
  const minPrice = Math.min(
    pg.singlePrice || Infinity,
    pg.doublePrice || Infinity,
    pg.triplePrice || Infinity
  );

  if (!lead.budget || minPrice <= lead.budget) score += 20;
  else if (minPrice <= lead.budget * 1.2) score += 8;

  // FOOD
  if (!lead.food || pg.food?.toLowerCase().includes(lead.food.toLowerCase()))
    score += 10;
  else if (pg.food === "both") score += 7;

  // PROPERTY TYPE
  if (!lead.propertyType || lead.propertyType === pg.propertyType)
    score += 5;

  return Math.min(100, score);
}