import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Visit from '@/models/Visit';
import { getAuthUserFromCookie } from '@/lib/auth';

type LeaderboardPeriod = 'this_month' | 'all_time' | 'today' | 'last_30_days' | 'custom';

function getPeriodBounds(period: LeaderboardPeriod) {
  const now = new Date();

  if (period === 'all_time') {
    return { from: null as Date | null, to: null as Date | null };
  }

  if (period === 'today') {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    return { from, to: now };
  }

  if (period === 'last_30_days') {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 30);
    from.setUTCHours(0, 0, 0, 0);
    return { from, to: now };
  }

  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  return { from, to: now };
}

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const periodQuery = req.nextUrl.searchParams.get('period') as LeaderboardPeriod | null;
    const period: LeaderboardPeriod = periodQuery && ['this_month', 'all_time', 'today', 'last_30_days', 'custom'].includes(periodQuery)
      ? periodQuery
      : 'this_month';

    const fromQuery = req.nextUrl.searchParams.get('from');
    const toQuery = req.nextUrl.searchParams.get('to');
    const zoneQuery = req.nextUrl.searchParams.get('zone');

    let from: Date | null = null;
    let to: Date | null = null;

    if (period === 'custom' && fromQuery && toQuery) {
      from = new Date(fromQuery);
      to = new Date(toQuery);
      if (!isNaN(to.getTime())) {
        to.setUTCHours(23, 59, 59, 999);
      }
    } else if (period !== 'custom') {
      const bounds = getPeriodBounds(period as 'this_month' | 'all_time' | 'today' | 'last_30_days');
      from = bounds.from;
      to = bounds.to;
    }

    const visitMatch: Record<string, any> = {
      assignedStaffId: { $ne: null },
    };

    if (from && to && !isNaN(from.getTime()) && !isNaN(to.getTime())) {
      visitMatch.scheduledAt = { $gte: from, $lte: to };
    }

    const rows = await Visit.aggregate([
      { $match: visitMatch },
      {
        $lookup: {
          from: 'leads',
          localField: 'leadId',
          foreignField: '_id',
          as: 'lead',
        },
      },
      {
        $unwind: {
          path: '$lead',
          preserveNullAndEmptyArrays: true,
        },
      },
      ...(zoneQuery && zoneQuery !== 'all' ? [{ $match: { 'lead.zone': zoneQuery } }] : []),
      {
        $group: {
          _id: {
            memberId: '$assignedStaffId',
            zone: {
              $cond: [{ $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$lead.zone', ''] } } } }, 0] }, '$lead.zone', null],
            },
          },
          toursCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.memberId',
          toursCount: { $sum: '$toursCount' },
          zones: {
            $push: {
              zone: '$_id.zone',
              count: '$toursCount',
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $match: {
          'user.role': { $in: ['manager', 'admin', 'member'] },
          'user.status': { $ne: 'deleted' },
        },
      },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          name: {
            $ifNull: ['$user.fullName', '$user.username'],
          },
          role: '$user.role',
          toursCount: 1,
          zones: {
            $filter: {
              input: '$zones',
              as: 'z',
              cond: { $ne: ['$$z.zone', null] },
            },
          },
        },
      },
      { $sort: { toursCount: -1, name: 1, userId: 1 } },
    ]);

    const rankings = rows.map((row: any, idx: number) => ({
      rank: idx + 1,
      userId: row.userId,
      name: row.name || 'Unknown User',
      role: row.role,
      toursCount: row.toursCount || 0,
      zones: (row.zones || []).sort((a: any, b: any) => {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.zone).localeCompare(String(b.zone));
      }),
    }));

    return NextResponse.json({
      period,
      from: from ? from.toISOString() : null,
      to: to ? to.toISOString() : null,
      generatedAt: new Date().toISOString(),
      rankings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
