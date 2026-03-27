export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  status: PipelineStage;
  assignedAgent: string;
  zone?: string;
  createdAt: string;
  lastActivity: string;
  firstResponseTime?: number; // in minutes
  budget?: string;
  preferredLocation?: string;
  moveInDate?: string;
  profession?: string;
  roomType?: string;
  needPreference?: string;
  specialRequests?: string;
  notes?: string;
  nextFollowUp?: string;
  visitDate?: string;
  visitOutcome?: VisitOutcome;
  property?: string;
}

export type LeadSource = 'whatsapp' | 'website' | 'instagram' | 'facebook' | 'phone' | 'landing_page';

export type PipelineStage = string;

export type PipelineStageConfig = {
  key: string;
  label: string;
  color: string;
};

export type VisitOutcome = 'booked' | 'considering' | 'not_interested';

export interface Member {
  id: string;
  name: string;
  avatar?: string;
  activeLeads: number;
  totalLeads: number;
  avgResponseTime: number;
  conversions: number;
  visitsScheduled: number;
}

export interface Visit {
  id: string;
  leadId: string;
  leadName: string;
  property: string;
  dateTime: string;
  assignedStaff: string;
  confirmed: boolean;
  outcome?: VisitOutcome;
}

export const PIPELINE_STAGES: PipelineStageConfig[] = [
  { key: 'new', label: 'New Lead', color: 'bg-pipeline-new' },
  { key: 'contacted', label: 'Contacted', color: 'bg-pipeline-contacted' },
  { key: 'requirement_collected', label: 'Requirement Collected', color: 'bg-pipeline-requirement' },
  { key: 'property_suggested', label: 'Property Suggested', color: 'bg-pipeline-suggested' },
  { key: 'visit_scheduled', label: 'Visit Scheduled', color: 'bg-pipeline-visit-scheduled' },
  { key: 'visit_completed', label: 'Visit Completed', color: 'bg-pipeline-visit-completed' },
  { key: 'booked', label: 'Booked', color: 'bg-pipeline-booked' },
  { key: 'lost', label: 'Lost', color: 'bg-pipeline-lost' },
];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: 'WhatsApp',
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  phone: 'Phone Call',
  landing_page: 'Landing Page',
};
