import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import LeadActivity from '@/models/LeadActivity';
import { getAuthUserFromCookie } from '@/lib/auth';

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    await connectToDatabase();

    const lead = await Lead.findById(id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });



    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updates: any = { ...body };
    if (body.assigned_member_id !== undefined && body.assignedMemberId === undefined) {
      updates.assignedMemberId = body.assigned_member_id;
    }
    if (body.preferred_location !== undefined && body.preferredLocation === undefined) {
      updates.preferredLocation = body.preferred_location;
    }
    if (body.move_in_date !== undefined && body.moveInDate === undefined) {
      updates.moveInDate = body.move_in_date;
    }
    if (body.room_type !== undefined && body.roomType === undefined) {
      updates.roomType = body.room_type;
    }
    if (body.need_preference !== undefined && body.needPreference === undefined) {
      updates.needPreference = body.need_preference;
    }
    if (body.special_requests !== undefined && body.specialRequests === undefined) {
      updates.specialRequests = body.special_requests;
    }
    if (body.parsed_metadata !== undefined && body.parsedMetadata === undefined) {
      updates.parsedMetadata = body.parsed_metadata;
    }

    const isAgentReassignAttempt = updates.assignedMemberId !== undefined;
    if (isAgentReassignAttempt) {
      const assignmentError = await validateAgentAssignment(authUser, updates.assignedMemberId || null);
      if (assignmentError) {
        return NextResponse.json({ error: assignmentError }, { status: 403 });
      }
    }

    const updated = await Lead.findByIdAndUpdate(id, updates, { new: true })
      .populate('propertyId', '_id name');

    if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    try {
      if (lead.status !== updated.status) {
        await LeadActivity.create({
          leadId: updated._id.toString(),
          leadName: updated.name,
          userId: authUser.id,
          userName: authUser.fullName,
          userRole: authUser.role,
          actionType: 'status_changed',
          details: { from: lead.status, to: updated.status }
        });
      }
      if (String(lead.assignedMemberId || '') !== String(updated.assignedMemberId || '')) {
        const oldAssignedAgent = lead.assignedMemberId
          ? await User.findOne({ _id: lead.assignedMemberId }).select('fullName')
          : null;
        const newAssignedAgent = updated.assignedMemberId
          ? await User.findOne({ _id: updated.assignedMemberId }).select('fullName')
          : null;

        await LeadActivity.create({
          leadId: updated._id.toString(),
          leadName: updated.name,
          userId: authUser.id,
          userName: authUser.fullName,
          userRole: authUser.role,
          actionType: 'assigned',
          details: { 
            from: oldAssignedAgent?.fullName || 'unassigned', 
            to: newAssignedAgent?.fullName || 'unassigned' 
          }
        });
      }
    } catch (e) { console.error('Failed to log lead modification', e); }

    const assignedAgent = updated.assignedMemberId
      ? await User.findOne({ _id: updated.assignedMemberId, role: 'member' }).select('_id fullName')
      : null;

    return NextResponse.json({
      ...updated.toObject(),
      id: updated._id.toString(),
      assignedMemberId: updated.assignedMemberId?.toString?.(),
      members: assignedAgent ? { id: assignedAgent._id.toString(), name: assignedAgent.fullName } : null,
      properties:
        updated.propertyId && typeof updated.propertyId === 'object' && '_id' in updated.propertyId
          ? { id: (updated.propertyId as any)._id.toString(), name: (updated.propertyId as any).name }
          : null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
