import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Property from '@/models/Property';
import Owner from '@/models/Owner';
import Room from '@/models/Room';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ownerId = searchParams.get('ownerId');

    await connectToDatabase();
    const { getAuthUserFromCookie } = await import('@/lib/auth');
    const authUser = await getAuthUserFromCookie();
    const isAdmin = authUser?.role === 'super_admin' || authUser?.role === 'admin' || authUser?.role === 'manager';

    const query: any = {};
    if (!isAdmin) query.isActive = true;   // users only see active PGs
    if (ownerId) query.ownerId = ownerId;
    if (ownerId) query.ownerId = ownerId;

    // Populate owner info and rooms/beds for owner portal
    const properties = await Property.find(query)
      .populate('ownerId')
      .populate({
        path: 'rooms',
        populate: { path: 'beds' }
      })
      .sort({ name: 1 });

    // Transform to match frontend expected structure
    const transformedProperties = await Promise.all(properties.map(async (p) => {
      const rooms = await Room.find({ propertyId: p._id }).populate('beds');
      return {
        ...p.toObject(),
        id: p._id,
        owners: p.ownerId,
        rooms: rooms.map((r: any) => ({
          ...r.toObject(),
          id: r._id,
          beds: (r.beds || []).map((b: any) => ({ ...b.toObject(), id: b._id })),
        })),
      };
    }));

    return NextResponse.json(transformedProperties);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectToDatabase();
    const property = await Property.create(body);
    return NextResponse.json(property, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
