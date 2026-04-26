import type { TCM, Property, Lead, Tour, ActivityLog, FollowUp, HandoffMessage, ActiveSequence } from "@/types/tour-module";

const now = new Date();
const iso = (d: Date) => d.toISOString();
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const addHours = (d: Date, n: number) => {
  const x = new Date(d);
  x.setHours(x.getHours() + n);
  return x;
};
const at = (d: Date, h: number, m = 0) => {
  const x = new Date(d);
  x.setHours(h, m, 0, 0);
  return x;
};

export const TCMS: TCM[] = [
  { id: "tcm-1", name: "Aarav Mehta", initials: "AM", zone: "Koramangala", conversionRate: 0.34, avgResponseMins: 4 },
  { id: "tcm-2", name: "Priya Shah", initials: "PS", zone: "Indiranagar", conversionRate: 0.28, avgResponseMins: 7 },
  { id: "tcm-3", name: "Rohan Iyer", initials: "RI", zone: "HSR Layout", conversionRate: 0.22, avgResponseMins: 12 },
  { id: "tcm-4", name: "Neha Verma", initials: "NV", zone: "Whitefield", conversionRate: 0.41, avgResponseMins: 3 },
];

export const PROPERTIES: Property[] = [
  { id: "p-1", name: "Gharpayy Koramangala 5B", area: "Koramangala", totalBeds: 24, vacantBeds: 6, daysSinceLastBooking: 4, pricePerBed: 14000 },
  { id: "p-2", name: "Gharpayy Indiranagar 100ft", area: "Indiranagar", totalBeds: 18, vacantBeds: 9, daysSinceLastBooking: 11, pricePerBed: 12500 },
  { id: "p-3", name: "Gharpayy HSR Sector 2", area: "HSR Layout", totalBeds: 12, vacantBeds: 2, daysSinceLastBooking: 1, pricePerBed: 11000 },
  { id: "p-4", name: "Gharpayy Whitefield ITPL", area: "Whitefield", totalBeds: 32, vacantBeds: 14, daysSinceLastBooking: 18, pricePerBed: 10500 },
  { id: "p-5", name: "Gharpayy BTM 2nd Stage", area: "BTM", totalBeds: 16, vacantBeds: 1, daysSinceLastBooking: 0, pricePerBed: 13000 },
];

export const LEADS: Lead[] = [
  {
    id: "l-1", name: "Karthik R.", phone: "+91 98xxx 12345", source: "Instagram",
    budget: 14000, moveInDate: iso(addDays(now, 3)), preferredArea: "Koramangala",
    assignedTcmId: "tcm-1", stage: "tour-scheduled", intent: "hot", confidence: 86,
    tags: ["budget-match"], nextFollowUpAt: iso(addHours(now, 6)), responseSpeedMins: 3,
    createdAt: iso(addDays(now, -2)), updatedAt: iso(addHours(now, -1)),
  },
  {
    id: "l-2", name: "Ananya G.", phone: "+91 91xxx 55310", source: "Justdial",
    budget: 11000, moveInDate: iso(addDays(now, 7)), preferredArea: "Indiranagar",
    assignedTcmId: "tcm-2", stage: "negotiation", intent: "warm", confidence: 62,
    tags: ["price-issue"], nextFollowUpAt: iso(addDays(now, 1)), responseSpeedMins: 8,
    createdAt: iso(addDays(now, -5)), updatedAt: iso(addHours(now, -8)),
  },
  {
    id: "l-3", name: "Vikram S.", phone: "+91 99xxx 88112", source: "Referral",
    budget: 9000, moveInDate: iso(addDays(now, 14)), preferredArea: "HSR Layout",
    assignedTcmId: "tcm-3", stage: "contacted", intent: "cold", confidence: 38,
    tags: ["budget-low"], nextFollowUpAt: iso(addDays(now, -1)), responseSpeedMins: 22,
    createdAt: iso(addDays(now, -6)), updatedAt: iso(addDays(now, -2)),
  },
  {
    id: "l-4", name: "Sneha P.", phone: "+91 90xxx 24681", source: "Google",
    budget: 16000, moveInDate: iso(addDays(now, 1)), preferredArea: "Whitefield",
    assignedTcmId: "tcm-4", stage: "tour-scheduled", intent: "hot", confidence: 91,
    tags: ["urgent"], nextFollowUpAt: iso(addHours(now, 3)), responseSpeedMins: 2,
    createdAt: iso(addDays(now, -1)), updatedAt: iso(addHours(now, -2)),
  },
  {
    id: "l-5", name: "Mohit J.", phone: "+91 97xxx 99021", source: "Instagram",
    budget: 10500, moveInDate: iso(addDays(now, 5)), preferredArea: "Koramangala",
    assignedTcmId: "tcm-1", stage: "contacted", intent: "warm", confidence: 54,
    tags: [], nextFollowUpAt: iso(at(now, 18)), responseSpeedMins: 6,
    createdAt: iso(now), updatedAt: iso(now),
  },
  {
    id: "l-6", name: "Riya D.", phone: "+91 93xxx 31415", source: "Housing.com",
    budget: 13500, moveInDate: iso(addDays(now, 2)), preferredArea: "Indiranagar",
    assignedTcmId: "tcm-2", stage: "tour-done", intent: "hot", confidence: 78,
    tags: ["parents-involved"], nextFollowUpAt: null, responseSpeedMins: 5,
    createdAt: iso(addDays(now, -3)), updatedAt: iso(addDays(now, -1)),
  },
  {
    id: "l-7", name: "Arjun K.", phone: "+91 98xxx 70011", source: "Google",
    budget: 12000, moveInDate: iso(addDays(now, 10)), preferredArea: "BTM",
    assignedTcmId: "tcm-3", stage: "new", intent: "warm", confidence: 48,
    tags: [], nextFollowUpAt: iso(addHours(now, 2)), responseSpeedMins: 14,
    createdAt: iso(addHours(now, -2)), updatedAt: iso(addHours(now, -2)),
  },
  {
    id: "l-8", name: "Divya N.", phone: "+91 95xxx 22334", source: "Referral",
    budget: 15000, moveInDate: iso(addDays(now, 4)), preferredArea: "Koramangala",
    assignedTcmId: "tcm-1", stage: "tour-done", intent: "hot", confidence: 82,
    tags: ["location-mismatch"], nextFollowUpAt: iso(addDays(now, 1)), responseSpeedMins: 4,
    createdAt: iso(addDays(now, -4)), updatedAt: iso(addDays(now, -1)),
  },
];

export const TOURS: Tour[] = [
  {
    id: "t-1", leadId: "l-1", propertyId: "p-1", tcmId: "tcm-1",
    scheduledAt: iso(at(now, 11, 30)), status: "scheduled", decision: null,
    postTour: { outcome: null, confidence: 0, objection: null, objectionNote: "", expectedDecisionAt: null, nextFollowUpAt: null, filledAt: null },
    createdAt: iso(addDays(now, -1)), updatedAt: iso(addDays(now, -1)),
  },
  {
    id: "t-2", leadId: "l-4", propertyId: "p-4", tcmId: "tcm-4",
    scheduledAt: iso(at(now, 16, 0)), status: "scheduled", decision: null,
    postTour: { outcome: null, confidence: 0, objection: null, objectionNote: "", expectedDecisionAt: null, nextFollowUpAt: null, filledAt: null },
    createdAt: iso(addDays(now, -1)), updatedAt: iso(addDays(now, -1)),
  },
  {
    id: "t-3", leadId: "l-2", propertyId: "p-2", tcmId: "tcm-2",
    scheduledAt: iso(at(addDays(now, -1), 15, 0)), status: "completed", decision: "thinking",
    postTour: {
      outcome: "thinking", confidence: 55, objection: "Budget", objectionNote: "Wants 1k off",
      expectedDecisionAt: iso(addDays(now, 2)), nextFollowUpAt: iso(addDays(now, 1)), filledAt: iso(addDays(now, -1)),
    },
    createdAt: iso(addDays(now, -2)), updatedAt: iso(addDays(now, -1)),
  },
  {
    // INCOMPLETE — post-tour enforcement should flag this
    id: "t-4", leadId: "l-6", propertyId: "p-2", tcmId: "tcm-2",
    scheduledAt: iso(at(addDays(now, -1), 12, 0)), status: "completed", decision: null,
    postTour: { outcome: null, confidence: 0, objection: null, objectionNote: "", expectedDecisionAt: null, nextFollowUpAt: null, filledAt: null },
    createdAt: iso(addDays(now, -3)), updatedAt: iso(addDays(now, -1)),
  },
  {
    id: "t-5", leadId: "l-8", propertyId: "p-1", tcmId: "tcm-1",
    scheduledAt: iso(at(addDays(now, -2), 10, 0)), status: "completed", decision: "thinking",
    postTour: {
      outcome: "thinking", confidence: 70, objection: "Location", objectionNote: "Far from office",
      expectedDecisionAt: iso(addDays(now, 1)), nextFollowUpAt: iso(addDays(now, 1)), filledAt: iso(addDays(now, -2)),
    },
    createdAt: iso(addDays(now, -3)), updatedAt: iso(addDays(now, -2)),
  },
  {
    id: "t-6", leadId: "l-3", propertyId: "p-3", tcmId: "tcm-3",
    scheduledAt: iso(at(addDays(now, 1), 10, 0)), status: "scheduled", decision: null,
    postTour: { outcome: null, confidence: 0, objection: null, objectionNote: "", expectedDecisionAt: null, nextFollowUpAt: null, filledAt: null },
    createdAt: iso(now), updatedAt: iso(now),
  },
];

export const ACTIVITIES: ActivityLog[] = [
  { id: "a-1", ts: iso(addHours(now, -22)), kind: "tour_scheduled", actor: "tcm-1", leadId: "l-1", tourId: "t-1", propertyId: "p-1", text: "Tour scheduled with Karthik R. at Koramangala 5B" },
  { id: "a-2", ts: iso(addHours(now, -22)), kind: "message_sent", actor: "system", leadId: "l-1", tourId: "t-1", text: "WhatsApp confirmation sent to Karthik R." },
  { id: "a-3", ts: iso(addHours(now, -8)), kind: "tour_completed", actor: "tcm-2", leadId: "l-2", tourId: "t-3", text: "Tour completed — client liked the property" },
  { id: "a-4", ts: iso(addHours(now, -7)), kind: "decision_logged", actor: "tcm-2", leadId: "l-2", tourId: "t-3", text: "Decision: Thinking — Budget objection" },
  { id: "a-5", ts: iso(addHours(now, -3)), kind: "stale_alert", actor: "system", leadId: "l-6", tourId: "t-4", text: "Post-tour update missing for Riya D. — escalated" },
];

export const FOLLOWUPS: FollowUp[] = [
  { id: "f-1", tourId: "t-3", leadId: "l-2", tcmId: "tcm-2", dueAt: iso(addDays(now, 1)), priority: "medium", done: false, reason: "T+1 post-tour follow-up" },
  { id: "f-2", tourId: "t-4", leadId: "l-6", tcmId: "tcm-2", dueAt: iso(now), priority: "high", done: false, reason: "Post-tour update missing" },
  { id: "f-3", leadId: "l-3", tcmId: "tcm-3", dueAt: iso(addDays(now, -1)), priority: "low", done: false, reason: "Re-engagement attempt" },
  { id: "f-4", leadId: "l-7", tcmId: "tcm-3", dueAt: iso(addHours(now, 2)), priority: "medium", done: false, reason: "First contact follow-up" },
  { id: "f-5", tourId: "t-5", leadId: "l-8", tcmId: "tcm-1", dueAt: iso(addDays(now, 1)), priority: "high", done: false, reason: "Decision day approaching" },
];

export const HANDOFFS: HandoffMessage[] = [
  {
    id: "h-1", leadId: "l-1", ts: iso(addHours(now, -23)),
    from: "flow-ops", fromId: "flow-ops", to: "tcm",
    text: "Hot lead — Instagram, urgent move-in (3 days). Wants Koramangala. Budget matches. Routed to Aarav.",
    priority: "urgent", read: true,
  },
  {
    id: "h-2", leadId: "l-1", ts: iso(addHours(now, -22)),
    from: "tcm", fromId: "tcm-1", to: "flow-ops",
    text: "Got it. Tour scheduled 11:30. He confirmed on WA.",
    priority: "normal", read: true,
  },
  {
    id: "h-3", leadId: "l-6", ts: iso(addHours(now, -3)),
    from: "flow-ops", fromId: "flow-ops", to: "tcm",
    text: "Riya's post-tour form is still empty. Parents are involved — please call before EOD.",
    priority: "urgent", read: false,
  },
  {
    id: "h-4", leadId: "l-4", ts: iso(addHours(now, -5)),
    from: "tcm", fromId: "tcm-4", to: "flow-ops",
    text: "Sneha booked the slot. She's bringing dad. Block bed P4-12.",
    priority: "normal", read: false,
  },
];

export const SEQUENCES_INIT: ActiveSequence[] = [
  { id: "s-1", leadId: "l-2", kind: "post-tour", startedAt: iso(addHours(now, -8)), currentStep: 0, paused: false },
  { id: "s-2", leadId: "l-7", kind: "first-contact", startedAt: iso(addHours(now, -2)), currentStep: 0, paused: false },
  { id: "s-3", leadId: "l-8", kind: "pre-decision", startedAt: iso(addHours(now, -12)), currentStep: 1, paused: false },
];
