import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import PipelineStage from '@/models/PipelineStage';
import { getAuthUserFromCookie } from '@/lib/auth';

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['super_admin', 'manager'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();

    // Today's date range (IST midnight to midnight)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    istTime.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(istTime.getTime() - istOffset);
    istTime.setUTCHours(23, 59, 59, 999);
    const todayEnd = new Date(istTime.getTime() - istOffset);

    // Get the 4th pipeline stage dynamically
    const stages = await PipelineStage.find({}).sort({ order: 1 }).lean();
    const visitStageKey = stages.length >= 4 ? (stages[3] as any).key : 'visit_scheduled';
    const visitStageLabel = stages.length >= 4 ? (stages[3] as any).label : 'Visit Scheduled';

    // Get all active members
    const members = await User.find({ role: 'member', status: 'active' })
      .select('_id fullName zones')
      .lean();

    if (!members.length) {
      return NextResponse.json({
        members: [],
        visitStageLabel,
        targets: { newLeads: 40, visitConfirmed: 10 },
      });
    }

    const memberIds = members.map((m: any) => m._id);

    // Aggregate new leads created today per member
    const newLeadsAgg = await Lead.aggregate([
      {
        $match: {
          createdBy: { $in: memberIds },
          createdAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
    ]);

    // Aggregate visit-confirmed leads updated today per member (assigned to them)
    const visitAgg = await Lead.aggregate([
      {
        $match: {
          assignedMemberId: { $in: memberIds },
          status: visitStageKey,
          updatedAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: '$assignedMemberId', count: { $sum: 1 } } },
    ]);

    const newMap = new Map(newLeadsAgg.map((x: any) => [x._id.toString(), x.count]));
    const visitMap = new Map(visitAgg.map((x: any) => [x._id.toString(), x.count]));

    const result = members.map((m: any) => {
      const id = m._id.toString();
      const newLeads = newMap.get(id) ?? 0;
      const visitConfirmed = visitMap.get(id) ?? 0;
      return {
        id,
        name: m.fullName,
        zones: m.zones || [],
        newLeads,
        visitConfirmed,
      };
    });

    // Sort: members with most activity first
    result.sort((a, b) => (b.newLeads + b.visitConfirmed * 2) - (a.newLeads + a.visitConfirmed * 2));

    return NextResponse.json({
      members: result,
      visitStageLabel,
      targets: { newLeads: 40, visitConfirmed: 10 },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
