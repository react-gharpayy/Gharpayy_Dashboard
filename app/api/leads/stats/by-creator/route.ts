import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import PipelineStage from '@/models/PipelineStage';
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

    const leadMatch: Record<string, any> = {
      createdBy: { $ne: null },
    };

    if (zoneQuery && zoneQuery !== 'all') {
      leadMatch.zone = zoneQuery;
    }

    if (from && to && !isNaN(from.getTime()) && !isNaN(to.getTime())) {
      leadMatch.createdAt = { $gte: from, $lte: to };
    }

    const pipelineStages = await PipelineStage.find().lean();
    const branches = pipelineStages.map((stage: any) => ({
      case: { $eq: ['$status', stage.key] },
      then: (stage.order || 0) + 1,
    }));

    const rows = await Lead.aggregate([
      { $match: leadMatch },
      {
        $addFields: {
          leadScoreVal: branches.length > 0 ? {
            $switch: {
              branches,
              default: 1
            }
          } : 1
        }
      },
      {
        $group: {
          _id: {
            createdBy: '$createdBy',
            zone: {
              $cond: [{ $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$zone', ''] } } } }, 0] }, '$zone', null],
            },
          },
          count: { $sum: 1 },
          score: { $sum: '$leadScoreVal' }
        },
      },
      {
        $group: {
          _id: '$_id.createdBy',
          leadsCreated: { $sum: '$count' },
          score: { $sum: '$score' },
          zones: {
            $push: {
              zone: '$_id.zone',
              count: '$count',
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
          score: 1,
          leadsCreated: 1,
          zones: {
            $filter: {
              input: '$zones',
              as: 'z',
              cond: { $ne: ['$$z.zone', null] },
            },
          },
        },
      },
      { $sort: { score: -1, leadsCreated: -1, name: 1, userId: 1 } },
    ]);

    const rankings = rows.map((row: any, idx: number) => ({
      rank: idx + 1,
      userId: row.userId,
      name: row.name || 'Unknown User',
      role: row.role,
      score: row.score || 0,
      leadsCreated: row.leadsCreated,
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
