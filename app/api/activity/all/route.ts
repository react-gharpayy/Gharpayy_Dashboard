import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import { getAuthUserFromCookie } from '@/lib/auth';
import { ACTIVITY_TYPE_KEYS } from '@/lib/leadsActivityAndPriority';

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['super_admin', 'manager', 'admin'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const userId = String(searchParams.get('userId') || '').trim();
    const type = String(searchParams.get('type') || '').trim();
    const dateFrom = String(searchParams.get('dateFrom') || '').trim();
    const dateTo = String(searchParams.get('dateTo') || '').trim();

    const activityMatch: Record<string, any> = {};

    if (type) {
      if (!ACTIVITY_TYPE_KEYS.has(type)) {
        return NextResponse.json({ error: 'Invalid activity type filter' }, { status: 400 });
      }
      activityMatch['activity.type'] = type;
    }

    if (dateFrom || dateTo) {
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo) : null;
      if (from && Number.isNaN(from.getTime())) {
        return NextResponse.json({ error: 'Invalid dateFrom' }, { status: 400 });
      }
      if (to && Number.isNaN(to.getTime())) {
        return NextResponse.json({ error: 'Invalid dateTo' }, { status: 400 });
      }

      activityMatch['activity.on'] = {};
      if (from) activityMatch['activity.on'].$gte = from;
      if (to) {
        to.setHours(23, 59, 59, 999);
        activityMatch['activity.on'].$lte = to;
      }
    }

    if (userId) {
      const user = await User.findById(userId).select('fullName').lean();
      if (user?.fullName) {
        activityMatch['activity.by'] = { $in: [userId, user.fullName] };
      } else {
        activityMatch['activity.by'] = userId;
      }
    }

    const pipeline = [
      { $match: { activity: { $exists: true, $ne: [] } } },
      { $unwind: '$activity' },
      Object.keys(activityMatch).length > 0 ? { $match: activityMatch } : null,
      {
        $project: {
          _id: 0,
          leadId: { $toString: '$_id' },
          leadName: '$name',
          phone: '$phone',
          status: '$status',
          activity: '$activity',
        },
      },
      { $sort: { 'activity.on': -1 } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ].filter(Boolean) as any[];

    const [result] = await Lead.aggregate(pipeline);
    const rows = (result?.rows || []).map((item: any) => ({
      ...item.activity,
      leadId: item.leadId,
      leadName: item.leadName,
      leadPhone: item.phone,
      leadStage: item.status,
    }));
    const total = result?.total?.[0]?.count || 0;

    return NextResponse.json({
      rows,
      total,
      page,
      limit,
      hasMore: skip + rows.length < total,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
