import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import Visit from '@/models/Visit';
import Member from '@/models/Member';
import IntegrationKey from '@/models/IntegrationKey';

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

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const incomingKey = req.headers.get('x-integration-key') || '';
    const keyDoc = await IntegrationKey.findOne({}).lean();
    if (!keyDoc?.key || keyDoc.key !== incomingKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { startUtc, endUtc } = getTodayISTRange();

    const [leads, visits] = await Promise.all([
      Lead.find({}, 'id status createdAt createdBy assignedMemberId').lean(),
      Visit.find({}, 'id outcome scheduledAt assignedStaffId').lean(),
    ]);

    const leadsToday = leads.filter((l: any) => {
      const t = new Date(l.createdAt);
      return t >= startUtc && t < endUtc;
    }).length;

    const toursScheduledToday = visits.filter((v: any) => {
      const t = new Date(v.scheduledAt);
      return t >= startUtc && t < endUtc;
    }).length;

    const members = await Member.find({}).select('name zoneName isActive').lean();
    const memberIdSet = new Set(members.map((m: any) => m._id.toString()));

    const leadAgg = await Lead.aggregate([
      { $match: { createdAt: { $gte: startUtc, $lt: endUtc } } },
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
    ]);

    const visitAgg = await Visit.aggregate([
      { $match: { scheduledAt: { $gte: startUtc, $lt: endUtc } } },
      { $group: { _id: '$assignedStaffId', count: { $sum: 1 } } },
    ]);

    const leadMap = new Map<string, number>();
    leadAgg.forEach((r: any) => {
      if (!r._id) return;
      leadMap.set(String(r._id), r.count || 0);
    });
    const visitMap = new Map<string, number>();
    visitAgg.forEach((r: any) => {
      if (!r._id) return;
      visitMap.set(String(r._id), r.count || 0);
    });

    const perEmployee = members.map((m: any) => {
      const id = m._id.toString();
      return {
        memberId: id,
        name: m.name,
        zoneName: m.zoneName || '',
        leadsToday: leadMap.get(id) || 0,
        toursToday: visitMap.get(id) || 0,
      };
    }).filter((row: any) => memberIdSet.has(row.memberId));

    return NextResponse.json({
      date: startUtc.toISOString().slice(0, 10),
      leadsToday,
      toursScheduledToday,
      perEmployee,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
