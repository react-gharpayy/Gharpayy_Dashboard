import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import LeadActivity from '@/models/LeadActivity';
import Lead from '@/models/Lead'; // Needed if we want to join full lead details later, but not strictly req
import { getAuthUserFromCookie } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    await connectToDatabase();

    const [activities, total] = await Promise.all([
      LeadActivity.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LeadActivity.countDocuments({})
    ]);

    return NextResponse.json({ 
      activities, 
      total, 
      hasMore: skip + activities.length < total 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
