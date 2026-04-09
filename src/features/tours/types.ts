export type TeamMemberRole = 'flow-ops' | 'tcm';

export type TourStatus = 'scheduled' | 'confirmed' | 'completed' | 'no-show' | 'cancelled';
export type TourOutcome = 'draft' | 'follow-up' | 'rejected' | null;

export type BookingSource = 'call' | 'whatsapp' | 'referral' | 'walk-in';
export type LeadType = 'urgent' | 'future';
export type TourMode = 'virtual' | 'physical';

export interface Zone {
  id: string;
  name: string;
  area: string;
}

export interface TeamMember {
  id: string;
  name: string;
  role: TeamMemberRole;
  zoneId: string;
  phone: string;
}

export interface Tour {
  id: string;
  leadName: string;
  phone: string;
  assignedTo: string;
  assignedToName: string;
  propertyName: string;
  area: string;
  zoneId: string;
  tourDate: string;
  tourTime: string;
  tourMode?: TourMode;
  bookingSource: BookingSource;
  scheduledBy: string;
  scheduledByName: string;
  leadType: LeadType;
  status: TourStatus;
  showUp: boolean | null;
  outcome: TourOutcome;
  remarks: string;
  budget: number;
  createdAt: string;
}
