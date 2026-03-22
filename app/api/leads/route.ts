import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import LeadActivity from '@/models/LeadActivity';
import { getAuthUserFromCookie } from '@/lib/auth';

function normalizePhone(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

async function validateAgentAssignment(authUser: any, agentId?: string | null) {
  if (!agentId) return null;

  const member = await User.findOne({ _id: agentId, role: 'member' }).select('_id adminId');
  if (!member) return 'Selected member not found';

  if (authUser.role === 'admin' && String(member.adminId || '') !== String(authUser.id)) {
    return 'Admins can assign leads only to members under them';
  }

  if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
    return 'Only Super Admin, manager, admin, and member can assign leads';
  }

  return null;
}

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const query: any = {};
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const leads = await Lead.find(query)
      .populate('propertyId', '_id name')
      .sort({ createdAt: -1 });

    const assignedMemberIds = Array.from(
      new Set(
        leads
          .map((l: any) => l.assignedMemberId?.toString?.())
          .filter(Boolean)
      )
    );

    const assignedAgents = assignedMemberIds.length
      ? await User.find({ _id: { $in: assignedMemberIds }, role: 'member' }).select('_id fullName')
      : [];

    const assignedAgentMap = new Map(
      assignedAgents.map((a: any) => [a._id.toString(), { id: a._id.toString(), name: a.fullName }])
    );

    const phoneCounts = new Map<string, number>();
    for (const lead of leads) {
      const normalizedPhone = normalizePhone((lead as any).phone);
      if (!normalizedPhone) continue;
      phoneCounts.set(normalizedPhone, (phoneCounts.get(normalizedPhone) || 0) + 1);
    }

    // Transform to match frontend structure
    const transformedLeads = leads.map(l => ({
      ...l.toObject(),
      id: l._id.toString(),
      assignedMemberId: l.assignedMemberId?.toString?.(),
      duplicateCount: phoneCounts.get(normalizePhone((l as any).phone)) || 0,
      isDuplicate: (phoneCounts.get(normalizePhone((l as any).phone)) || 0) > 1,
      members: l.assignedMemberId ? assignedAgentMap.get(l.assignedMemberId.toString()) || null : null,
      properties:
        l.propertyId && typeof l.propertyId === 'object' && '_id' in l.propertyId
          ? {
              id: (l.propertyId as any)._id.toString(),
              name: (l.propertyId as any).name,
            }
          : null,
    }));

    return NextResponse.json(transformedLeads);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Only Super Admin, managers, admins, and members can create leads' }, { status: 403 });
    }

    const body = await req.json();
    await connectToDatabase();

    const assignedMemberId = body.assignedMemberId || body.assigned_member_id || null;
    const assignmentError = await validateAgentAssignment(authUser, assignedMemberId);
    if (assignmentError) {
      return NextResponse.json({ error: assignmentError }, { status: 403 });
    }

    // Map snake_case from form to camelCase for model
    const leadData = {
      ...body,
      preferredLocation: body.preferred_location || body.preferredLocation,
      assignedMemberId,
      moveInDate: body.move_in_date || body.moveInDate,
      roomType: body.room_type || body.roomType,
      needPreference: body.need_preference || body.needPreference,
      specialRequests: body.special_requests || body.specialRequests,
      profession: body.profession,
      notes: body.notes,
      parsedMetadata: body.parsed_metadata || body.parsedMetadata,
    };

    const lead = await Lead.create(leadData);

    try {
      await LeadActivity.create({
        leadId: lead._id.toString(),
        leadName: lead.name,
        userId: authUser.id,
        userName: authUser.fullName,
        userRole: authUser.role,
        actionType: 'added',
        details: { source: lead.source, status: lead.status }
      });
    } catch (e) { console.error('Failed to log lead creation', e); }

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

