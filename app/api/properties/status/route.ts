import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Property from '@/models/Property';

export async function GET() {
  try {
    await connectToDatabase();
    const properties = await Property.find(
      { pgId: { $exists: true, $ne: null } },
      { pgId: 1, isActive: 1, _id: 0 }
    );

    const statusMap: Record<number, boolean> = {};
    for (const p of properties) {
      statusMap[p.pgId] = p.isActive;
    }

    return NextResponse.json(statusMap);

  } catch (error: any) {
    console.error('[properties/status] Error:', error?.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}