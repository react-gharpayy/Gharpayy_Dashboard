import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import Visit from '@/models/Visit';
import Booking from '@/models/Booking';
import Member from '@/models/Member';
import { getAuthUserFromCookie } from '@/lib/auth';
import mongoose from 'mongoose';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function getTodayISTRange() {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const startUtc = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const leadQuery: any = {};
    const bookingQuery: any = { bookingStatus: 'booked' };

    if (authUser.role === 'member') {
      leadQuery.assignedMemberId = authUser.id;
      
      // For visits and bookings, we need to filter by associated lead or assigned agent
      // Assuming Visit has a leadId or assignedTo field (need to check models)
      // If we don't have direct filtering on visits/bookings, we might need a more complex query
    }

    const [leads] = await Promise.all([
      Lead.find(leadQuery, 'id status firstResponseTimeMin source createdAt createdBy assignedMemberId'),
    ]);

    // Re-fetch visits and bookings with filtering if member
    let visits, bookings;
    if (authUser.role === 'member') {
      const memberLeads = leads.map(l => l._id);
      visits = await Visit.find({ leadId: { $in: memberLeads } }, 'id outcome scheduledAt');
      bookings = await Booking.find({ ...bookingQuery, leadId: { $in: memberLeads } }, 'id');
    } else {
      visits = await Visit.find({}, 'id outcome scheduledAt');
      bookings = await Booking.find(bookingQuery, 'id');
    }

    const { startUtc, endUtc } = getTodayISTRange();

    const totalLeads = leads.length;
    const leadsToday = leads.filter(l => {
      const t = new Date(l.createdAt);
      return t >= startUtc && t < endUtc;
    }).length;
    const responseTimes = leads.filter(l => l.firstResponseTimeMin !== undefined && l.firstResponseTimeMin !== null).map(l => l.firstResponseTimeMin!);
    const avgResponseTime = responseTimes.length ? +(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) : 0;
    const withinSLA = responseTimes.filter(t => t <= 5).length;
    const slaCompliance = responseTimes.length ? Math.round((withinSLA / responseTimes.length) * 100) : 0;
    const slaBreaches = responseTimes.filter(t => t > 5).length;
    const bookedLeads = leads.filter(l => l.status === 'booked').length;
    const conversionRate = totalLeads ? +((bookedLeads / totalLeads) * 100).toFixed(1) : 0;
    const toursScheduledToday = visits.filter(v => {
      const t = new Date(v.scheduledAt);
      return t >= startUtc && t < endUtc;
    }).length;
    const completedVisits = visits.filter(v => v.outcome !== undefined && v.outcome !== null).length;

    const memberFilter: any = {};
    if (authUser.role === 'member') {
      memberFilter._id = new mongoose.Types.ObjectId(authUser.id);
    }
    const members = await Member.find(memberFilter).select('name zoneName isActive').lean();
    const memberIdSet = new Set(members.map(m => m._id.toString()));

    const leadMatch: any = { createdAt: { $gte: startUtc, $lt: endUtc } };
    if (authUser.role === 'member') {
      leadMatch.createdBy = new mongoose.Types.ObjectId(authUser.id);
    }
    const leadAgg = await Lead.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
    ]);

    const visitMatch: any = { scheduledAt: { $gte: startUtc, $lt: endUtc } };
    if (authUser.role === 'member') {
      visitMatch.assignedStaffId = new mongoose.Types.ObjectId(authUser.id);
    }
    const visitAgg = await Visit.aggregate([
      { $match: visitMatch },
      { $group: { _id: '$assignedStaffId', count: { $sum: 1 } } },
    ]);

    const leadMap = new Map<string, number>();
    leadAgg.forEach(r => {
      if (!r._id) return;
      leadMap.set(String(r._id), r.count || 0);
    });
    const visitMap = new Map<string, number>();
    visitAgg.forEach(r => {
      if (!r._id) return;
      visitMap.set(String(r._id), r.count || 0);
    });

    const perEmployee = members.map(m => {
      const id = m._id.toString();
      return {
        memberId: id,
        name: m.name,
        zoneName: m.zoneName || '',
        leadsToday: leadMap.get(id) || 0,
        toursToday: visitMap.get(id) || 0,
      };
    }).filter(row => memberIdSet.has(row.memberId));

    return NextResponse.json({
      totalLeads,
      newToday: leadsToday,
      leadsToday,
      avgResponseTime,
      slaCompliance,
      slaBreaches,
      conversionRate,
      visitsScheduled: toursScheduledToday,
      toursScheduledToday,
      visitsCompleted: completedVisits,
      bookingsClosed: bookedLeads,
      perEmployee,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
