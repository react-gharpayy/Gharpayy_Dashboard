import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Visit from '@/models/Visit';
import Lead from '@/models/Lead';
import Property from '@/models/Property';
import Member from '@/models/Member';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await connectToDatabase();
    // Ensure mongoose models referenced by Visit.populate refs are registered.
    void Lead;
    void Property;
    void Member;
    const visit = await Visit.findById(id)
      .populate('leadId')
      .populate('propertyId')
      .populate('assignedStaffId');

    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const transformedVisit = {
      ...visit.toObject(),
      id: visit._id,
      leads: (visit as any).leadId,
      properties: (visit as any).propertyId,
      members: (visit as any).assignedStaffId,
    };

    return NextResponse.json(transformedVisit);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await connectToDatabase();
    const visit = await Visit.findByIdAndUpdate(id, body, { new: true });
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    return NextResponse.json(visit);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
