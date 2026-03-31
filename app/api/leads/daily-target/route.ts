import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import PipelineStage from '@/models/PipelineStage';
import { getAuthUserFromCookie } from '@/lib/auth';

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'member') return NextResponse.json({ error: 'Members only' }, { status: 403 });

    await connectToDatabase();

    // Today's date range (IST midnight to midnight)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    istTime.setUTCHours(0, 0, 0, 0);
    const todayStart = new Date(istTime.getTime() - istOffset);
    istTime.setUTCHours(23, 59, 59, 999);
    const todayEnd = new Date(istTime.getTime() - istOffset);

    // Get pipeline stages sorted by order to find the 4th stage
    const stages = await PipelineStage.find({}).sort({ order: 1 }).lean();

    // Fallback: if no DB stages, use static
    const STATIC_STAGES = [
      'new', 'contacted', 'requirement_collected', 'property_suggested',
      'visit_scheduled', 'visit_completed', 'booked', 'lost',
    ];

    let visitStageKey = 'visit_scheduled'; // fallback (4th in static list)
    let newLeadKey = 'new';

    if (stages && stages.length >= 4) {
      // 1st stage = new leads, 4th stage = visit confirmed
      newLeadKey = (stages[0] as any).key;
      visitStageKey = (stages[3] as any).key;
    } else {
      visitStageKey = STATIC_STAGES[4]; // visit_scheduled
    }

    const memberId = authUser.id;

    // Count: leads CREATED by this member today with status = 1st stage (new)
    const newLeadsToday = await Lead.countDocuments({
      createdBy: memberId,
      status: newLeadKey,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    // Also count all new leads created today (regardless of current status)
    // because newly added leads start as "new"
    const allNewLeadsToday = await Lead.countDocuments({
      createdBy: memberId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    // Count: leads moved to the 4th stage (visit confirmed) by this member today
    // We check leads assigned to this member whose status is visitStageKey AND
    // their last status update happened today
    const visitConfirmedToday = await Lead.countDocuments({
      assignedMemberId: memberId,
      status: visitStageKey,
      updatedAt: { $gte: todayStart, $lte: todayEnd },
    });

    return NextResponse.json({
      newLeadsToday: allNewLeadsToday,
      visitConfirmedToday,
      visitStageKey,
      visitStageLabel: stages.length >= 4 ? (stages[3] as any).label : 'Visit Scheduled',
      newLeadKey,
      targets: {
        newLeads: 40,
        visitConfirmed: 10,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
