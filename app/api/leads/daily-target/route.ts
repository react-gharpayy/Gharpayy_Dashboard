import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import Visit from '@/models/Visit';
import { getAuthUserFromCookie } from '@/lib/auth';

const GOALS = {
  leadsAdded: 40,
  toursScheduled: 10,
};

function buildIstDayRange(dateInput?: string | null) {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;

  let selectedDate = '';
  if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    selectedDate = dateInput;
  } else {
    const now = new Date();
    selectedDate = new Date(now.getTime() + istOffsetMs).toISOString().slice(0, 10);
  }

  const [year, month, day] = selectedDate.split('-').map((val) => parseInt(val, 10));
  const utcMidnightForIstDay = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - istOffsetMs;
  const dayStart = new Date(utcMidnightForIstDay);
  const dayEnd = new Date(utcMidnightForIstDay + 24 * 60 * 60 * 1000 - 1);

  return {
    selectedDate,
    dayStart,
    dayEnd,
  };
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'member') return NextResponse.json({ error: 'Members only' }, { status: 403 });

    await connectToDatabase();

    const url = new URL(req.url);
    const { selectedDate, dayStart, dayEnd } = buildIstDayRange(url.searchParams.get('date'));

    const memberId = authUser.id;

    const leadsAdded = await Lead.countDocuments({
      createdBy: memberId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    });

    const toursScheduled = await Visit.countDocuments({
      assignedStaffId: memberId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    });

    const leadsDone = leadsAdded >= GOALS.leadsAdded;
    const toursDone = toursScheduled >= GOALS.toursScheduled;

    return NextResponse.json({
      date: selectedDate,
      leadsAdded,
      toursScheduled,
      leadsDone,
      toursDone,
      allDone: leadsDone && toursDone,
      goals: GOALS,
      thresholds: GOALS,
      // Backward-compatible keys for legacy consumers.
      newLeadsToday: leadsAdded,
      visitConfirmedToday: toursScheduled,
      visitStageLabel: 'Tours Scheduled',
      targets: {
        newLeads: GOALS.leadsAdded,
        visitConfirmed: GOALS.toursScheduled,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
