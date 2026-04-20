import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Visit from '@/models/Visit';
import Lead from '@/models/Lead';
import Property from '@/models/Property';
import Member from '@/models/Member';

export async function GET() {
  try {
    await connectToDatabase();
    // Ensure mongoose models referenced by Visit.populate refs are registered.
    void Lead;
    void Property;
    void Member;
    
    const visits = await Visit.find({})
      .populate('leadId')
      .populate('propertyId')
      .populate('assignedStaffId')
      .sort({ scheduledAt: 1 });

    const transformedVisits = visits.map(v => ({
      ...v.toObject(),
      id: v._id,
      leads: v.leadId,
      properties: v.propertyId,
      members: v.assignedStaffId
    }));

    return NextResponse.json(transformedVisits);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectToDatabase();
    const visit = await Visit.create(body);
    return NextResponse.json(visit, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
