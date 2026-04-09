import type { TeamMember, Tour, Zone } from '@/features/tours/types';

export const zones: Zone[] = [
  { id: 'z1', name: 'Zone A - Koramangala', area: 'Koramangala' },
  { id: 'z2', name: 'Zone B - HSR Layout', area: 'HSR Layout' },
  { id: 'z3', name: 'Zone C - Indiranagar', area: 'Indiranagar' },
  { id: 'z4', name: 'Zone D - Whitefield', area: 'Whitefield' },
  { id: 'z5', name: 'Zone E - BTM Layout', area: 'BTM Layout' },
  { id: 'z6', name: 'Zone F - Electronic City', area: 'Electronic City' },
  { id: 'z7', name: 'Zone G - Marathahalli', area: 'Marathahalli' },
];

const names = [
  'Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Sneha Reddy', 'Vikram Singh',
  'Ananya Das', 'Karthik Nair', 'Divya Joshi', 'Rohan Gupta', 'Meera Iyer',
  'Arjun Rao', 'Pooja Verma', 'Nikhil Bhat', 'Swati Mishra', 'Aditya Menon',
  'Kavita Shetty', 'Sanjay Pillai', 'Ritu Agarwal', 'Deepak Hegde', 'Nisha Kulkarni',
  'Rajesh Mohan', 'Anjali Desai', 'Suresh Babu', 'Lakshmi Narayan', 'Manoj Tiwari',
  'Pallavi Deshpande', 'Harish Gowda', 'Sunita Yadav', 'Venkat Raman', 'Rekha Chandra',
  'Ashwin Pai', 'Geeta Saxena', 'Prakash Jain', 'Vandana Kapoor', 'Tarun Malhotra',
  'Shruti Bansal', 'Ravi Prasad', 'Kamala Devi', 'Sunil Patil', 'Uma Shankar',
  'Girish Srinivas', 'Bhavna Thakur',
];

export const teamMembers: TeamMember[] = names.map((name, i) => {
  const zoneIndex = Math.floor(i / 6);
  const zoneId = zones[Math.min(zoneIndex, 6)].id;
  const role = i % 10 < 7 ? 'flow-ops' : 'tcm';

  return {
    id: `m${i + 1}`,
    name,
    role,
    zoneId,
    phone: `+91 ${9800000000 + i}`,
  };
});

const properties = [
  'Prestige Lakeside', 'Brigade Meadows', 'Sobha Dream Acres', 'Godrej Splendour',
  'Mantri Serenity', 'Puravankara Zenium', 'Salarpuria Sattva', 'Embassy Springs',
  'Total Environment', 'Raheja Residency', 'Adarsh Palm Retreat', 'Shriram Greenfield',
];

const statuses: Tour['status'][] = ['scheduled', 'confirmed', 'completed', 'no-show', 'cancelled'];
const outcomes: Exclude<Tour['outcome'], null>[] = ['draft', 'follow-up', 'rejected'];
const sources: Tour['bookingSource'][] = ['call', 'whatsapp', 'referral', 'walk-in'];

const today = new Date().toISOString().split('T')[0];

export const initialTours: Tour[] = Array.from({ length: 80 }, (_, i) => {
  const tcms = teamMembers.filter((m) => m.role === 'tcm');
  const flowOps = teamMembers.filter((m) => m.role === 'flow-ops');
  const assignee = tcms[i % tcms.length];
  const scheduler = flowOps[i % flowOps.length];
  const zone = zones.find((z) => z.id === assignee.zoneId)!;
  const hour = 10 + (i % 11);

  const status: Tour['status'] = i < 20
    ? 'completed'
    : i < 35
      ? 'confirmed'
      : i < 50
        ? 'scheduled'
        : i < 65
          ? 'no-show'
          : 'cancelled';

  const showUp = status === 'completed' ? true : status === 'no-show' ? false : null;
  const outcome = status === 'completed' ? outcomes[i % outcomes.length] : null;

  return {
    id: `t${i + 1}`,
    leadName: `Lead ${i + 1}`,
    phone: `+91 ${9700000000 + i}`,
    assignedTo: assignee.id,
    assignedToName: assignee.name,
    propertyName: properties[i % properties.length],
    area: zone.area,
    zoneId: zone.id,
    tourDate: today,
    tourTime: `${String(hour).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`,
    bookingSource: sources[i % sources.length],
    scheduledBy: scheduler.id,
    scheduledByName: scheduler.name,
    leadType: i % 3 === 0 ? 'urgent' : 'future',
    status,
    showUp,
    outcome,
    remarks: status === 'completed'
      ? (outcome === 'draft' ? 'Ready to sign' : outcome === 'follow-up' ? 'Needs another visit' : 'Budget mismatch')
      : '',
    budget: 7000 + (i % 20) * 500,
    createdAt: new Date().toISOString(),
  };
});
