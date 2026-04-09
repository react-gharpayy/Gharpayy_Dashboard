import { Zone, TeamMember, Tour, HeatmapData } from './types';

export const zones: Zone[] = [
  { id: 'z1', name: 'Zone A — Koramangala', area: 'Koramangala' },
  { id: 'z2', name: 'Zone B — HSR Layout', area: 'HSR Layout' },
  { id: 'z3', name: 'Zone C — Indiranagar', area: 'Indiranagar' },
  { id: 'z4', name: 'Zone D — Whitefield', area: 'Whitefield' },
  { id: 'z5', name: 'Zone E — BTM Layout', area: 'BTM Layout' },
  { id: 'z6', name: 'Zone F — Electronic City', area: 'Electronic City' },
  { id: 'z7', name: 'Zone G — Marathahalli', area: 'Marathahalli' },
];

const names = [
  'Rahul Sharma','Priya Patel','Amit Kumar','Sneha Reddy','Vikram Singh',
  'Ananya Das','Karthik Nair','Divya Joshi','Rohan Gupta','Meera Iyer',
  'Arjun Rao','Pooja Verma','Nikhil Bhat','Swati Mishra','Aditya Menon',
  'Kavita Shetty','Sanjay Pillai','Ritu Agarwal','Deepak Hegde','Nisha Kulkarni',
  'Rajesh Mohan','Anjali Desai','Suresh Babu','Lakshmi Narayan','Manoj Tiwari',
  'Pallavi Deshpande','Harish Gowda','Sunita Yadav','Venkat Raman','Rekha Chandra',
  'Ashwin Pai','Geeta Saxena','Prakash Jain','Vandana Kapoor','Tarun Malhotra',
  'Shruti Bansal','Ravi Prasad','Kamala Devi','Sunil Patil','Uma Shankar',
  'Girish Srinivas','Bhavna Thakur',
];

export const teamMembers: TeamMember[] = names.map((name, i) => {
  const zoneIndex = Math.floor(i / 6);
  const zoneId = zones[Math.min(zoneIndex, 6)].id;
  const membersInZone = names.filter((_, j) => Math.floor(j / 6) === zoneIndex);
  const posInZone = membersInZone.indexOf(name);
  const role = posInZone < Math.ceil(membersInZone.length * 0.7) ? 'flow-ops' as const : 'tcm' as const;
  return {
    id: `m${i + 1}`,
    name,
    role,
    zoneId,
    phone: `+91 ${9800000000 + i}`,
  };
});

const properties = [
  'Prestige Lakeside','Brigade Meadows','Sobha Dream Acres','Godrej Splendour',
  'Mantri Serenity','Puravankara Zenium','Salarpuria Sattva','Embassy Springs',
  'Total Environment','Raheja Residency','Adarsh Palm Retreat','Shriram Greenfield',
];

const today = new Date().toISOString().split('T')[0];

const statuses: Tour['status'][] = ['scheduled','confirmed','completed','no-show','cancelled'];
const outcomes: Tour['outcome'][] = ['draft','follow-up','rejected', null];
const sources: Tour['bookingSource'][] = ['call','whatsapp','referral','walk-in'];

export const tours: Tour[] = Array.from({ length: 80 }, (_, i) => {
  const tcms = teamMembers.filter(m => m.role === 'tcm');
  const flowOps = teamMembers.filter(m => m.role === 'flow-ops');
  const assignee = tcms[i % tcms.length];
  const scheduler = flowOps[i % flowOps.length];
  const zone = zones.find(z => z.id === assignee.zoneId)!;
  const hour = 10 + (i % 11);
  const status = i < 20 ? 'completed' : i < 35 ? 'confirmed' : i < 50 ? 'scheduled' : i < 65 ? 'no-show' : 'cancelled';
  const showUp = status === 'completed' ? true : status === 'no-show' ? false : null;
  const outcome = status === 'completed' ? outcomes[i % 3]! : null;

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
    tourTime: `${hour.toString().padStart(2, '0')}:${(i % 2 === 0 ? '00' : '30')}`,
    bookingSource: sources[i % sources.length],
    scheduledBy: scheduler.id,
    scheduledByName: scheduler.name,
    leadType: i % 3 === 0 ? 'urgent' : 'future',
    status,
    showUp,
    outcome,
    remarks: status === 'completed' ? (outcome === 'draft' ? 'Ready to sign' : outcome === 'follow-up' ? 'Needs another visit' : 'Budget mismatch') : '',
    budget: 7000 + (i % 20) * 500,
    createdAt: new Date().toISOString(),
  };
});

export const heatmapData: HeatmapData[] = [
  { hour: '10 AM', tours: 12, showUps: 9, drafts: 3 },
  { hour: '11 AM', tours: 15, showUps: 11, drafts: 4 },
  { hour: '12 PM', tours: 10, showUps: 7, drafts: 2 },
  { hour: '1 PM', tours: 8, showUps: 5, drafts: 1 },
  { hour: '2 PM', tours: 14, showUps: 10, drafts: 3 },
  { hour: '3 PM', tours: 11, showUps: 8, drafts: 3 },
  { hour: '4 PM', tours: 16, showUps: 13, drafts: 5 },
  { hour: '5 PM', tours: 13, showUps: 9, drafts: 2 },
  { hour: '6 PM', tours: 9, showUps: 7, drafts: 2 },
  { hour: '7 PM', tours: 6, showUps: 4, drafts: 1 },
  { hour: '8 PM', tours: 4, showUps: 3, drafts: 1 },
];

export function getZonePerformance(tourList: Tour[]) {
  return zones.map(zone => {
    const zoneTours = tourList.filter(t => t.zoneId === zone.id);
    const completed = zoneTours.filter(t => t.status === 'completed');
    const showed = zoneTours.filter(t => t.showUp === true);
    const drafts = zoneTours.filter(t => t.outcome === 'draft');
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      toursScheduled: zoneTours.length,
      toursCompleted: completed.length,
      showUpRate: zoneTours.length > 0 ? Math.round((showed.length / zoneTours.length) * 100) : 0,
      drafts: drafts.length,
      closures: Math.floor(drafts.length * 0.4),
    };
  });
}

export function getMemberPerformance(tourList: Tour[]) {
  return teamMembers.map(member => {
    const memberTours = member.role === 'tcm'
      ? tourList.filter(t => t.assignedTo === member.id)
      : tourList.filter(t => t.scheduledBy === member.id);
    const completed = memberTours.filter(t => t.status === 'completed');
    const showed = memberTours.filter(t => t.showUp === true);
    const drafts = memberTours.filter(t => t.outcome === 'draft');
    const zone = zones.find(z => z.id === member.zoneId);
    return {
      memberId: member.id,
      name: member.name,
      role: member.role,
      zoneName: zone?.name || '',
      leadsAdded: memberTours.length + Math.floor(Math.random() * 5),
      toursScheduled: memberTours.length,
      toursCompleted: completed.length,
      showUpRate: memberTours.length > 0 ? Math.round((showed.length / memberTours.length) * 100) : 0,
      drafts: drafts.length,
      closures: Math.floor(drafts.length * 0.4),
      sameDayRate: Math.round(40 + Math.random() * 40),
    };
  });
}
