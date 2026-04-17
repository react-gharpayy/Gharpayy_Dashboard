import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import Visit from '@/models/Visit';
import User from '@/models/User';
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

async function getScopedMemberIdsForAdmin(adminId: string) {
  const adminUser = await User.findById(adminId).select('zones');
  const adminZones = new Set(
    (adminUser?.zones || []).map((zone: any) => String(zone).trim().toLowerCase()).filter(Boolean)
  );

  if (adminZones.size === 0) return [] as string[];

  const allMembers = await User.find({ role: 'member', status: { $in: ['active', 'inactive'] } })
    .select('_id zones')
    .lean();

  return allMembers
    .filter((member: any) => {
      const memberZones = Array.isArray(member.zones)
        ? member.zones.map((zone: any) => String(zone).trim().toLowerCase()).filter(Boolean)
        : [];
      return memberZones.some((zone: string) => adminZones.has(zone));
    })
    .map((member: any) => String(member._id));
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();

    const url = new URL(req.url);
    const { selectedDate, dayStart, dayEnd } = buildIstDayRange(url.searchParams.get('date'));

    let members: any[] = [];

    if (authUser.role === 'member') {
      const me = await User.findById(authUser.id)
        .select('_id fullName zones')
        .lean();
      members = me ? [me] : [];
    } else if (authUser.role === 'admin') {
      const scopedMemberIds = await getScopedMemberIdsForAdmin(authUser.id);
      if (scopedMemberIds.length === 0) {
        return NextResponse.json({
          date: selectedDate,
          members: [],
          goals: GOALS,
          thresholds: GOALS,
        });
      }

      members = await User.find({
        _id: { $in: scopedMemberIds },
        role: 'member',
        status: { $in: ['active', 'inactive'] },
      })
        .select('_id fullName zones')
        .lean();
    } else {
      members = await User.find({ role: 'member', status: { $in: ['active', 'inactive'] } })
        .select('_id fullName zones')
        .lean();
    }

    if (!members.length) {
      return NextResponse.json({
        date: selectedDate,
        members: [],
        goals: GOALS,
        thresholds: GOALS,
      });
    }

    const memberIds = members.map((m: any) => m._id);

    const leadsAgg = await Lead.aggregate([
      {
        $match: {
          createdBy: { $in: memberIds },
          createdAt: { $gte: dayStart, $lte: dayEnd },
        },
      },
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
    ]);

    const toursAgg = await Visit.aggregate([
      {
        $match: {
          assignedStaffId: { $in: memberIds },
          createdAt: { $gte: dayStart, $lte: dayEnd },
        },
      },
      { $group: { _id: '$assignedStaffId', count: { $sum: 1 } } },
    ]);

    const leadsMap = new Map(leadsAgg.map((x: any) => [x._id.toString(), x.count]));
    const toursMap = new Map(toursAgg.map((x: any) => [x._id.toString(), x.count]));

    const result = members.map((member: any) => {
      const id = member._id.toString();
      const leadsAdded = leadsMap.get(id) ?? 0;
      const toursScheduled = toursMap.get(id) ?? 0;
      const leadsDone = leadsAdded >= GOALS.leadsAdded;
      const toursDone = toursScheduled >= GOALS.toursScheduled;

      return {
        id,
        name: member.fullName,
        zones: member.zones || [],
        leadsAdded,
        toursScheduled,
        leadsDone,
        toursDone,
        allDone: leadsDone && toursDone,
        // Backward-compatible fields for older UI consumers.
        newLeads: leadsAdded,
        visitConfirmed: toursScheduled,
      };
    });

    result.sort((a, b) => {
      if (a.allDone !== b.allDone) return a.allDone ? -1 : 1;
      if (b.toursScheduled !== a.toursScheduled) return b.toursScheduled - a.toursScheduled;
      if (b.leadsAdded !== a.leadsAdded) return b.leadsAdded - a.leadsAdded;
      return String(a.name).localeCompare(String(b.name));
    });

    return NextResponse.json({
      date: selectedDate,
      members: result,
      goals: GOALS,
      thresholds: GOALS,
      // Backward-compatible keys.
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
