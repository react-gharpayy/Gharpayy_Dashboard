import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import LeadActivity from '@/models/LeadActivity';
import Notification from '@/models/Notification';
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

async function createAssignmentNotification({
  assigneeId,
  assignedById,
  assignedByName,
  lead,
}: {
  assigneeId: string;
  assignedById: string;
  assignedByName: string;
  lead: any;
}) {
  await Notification.create({
    userId: assigneeId,
    title: 'Lead assigned to you',
    message: `${lead.name} (${lead.phone}) was assigned by ${assignedByName}`,
    type: 'lead_assignment_request',
    actionStatus: 'pending',
    metadata: {
      leadId: lead._id.toString(),
      assignedById,
      assignedByName,
    },
  });
}

async function serializeLead(lead: any) {
  const assignedAgent = lead.assignedMemberId
    ? await User.findOne({ _id: lead.assignedMemberId, role: 'member' }).select('_id fullName')
    : null;

  return {
    ...lead.toObject(),
    id: lead._id.toString(),
    assignedMemberId: lead.assignedMemberId?.toString?.(),
    assignmentStatus: lead.assignmentStatus || 'accepted',
    assignmentRequestedById: lead.assignmentRequestedById?.toString?.(),
    assignmentRequestedAt: lead.assignmentRequestedAt || null,
    assignmentAcceptedAt: lead.assignmentAcceptedAt || null,
    members: assignedAgent ? { id: assignedAgent._id.toString(), name: assignedAgent.fullName } : null,
    properties:
      lead.propertyId && typeof lead.propertyId === 'object' && '_id' in lead.propertyId
        ? { id: (lead.propertyId as any)._id.toString(), name: (lead.propertyId as any).name }
        : null,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();

    const lead = await Lead.findById(id).populate('propertyId', '_id name');
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (authUser.role === 'member') {
      const isAssigned = String(lead.assignedMemberId || '') === authUser.id;
      if (!isAssigned) return NextResponse.json({ error: 'You can only view leads assigned to you' }, { status: 403 });
    }

    return NextResponse.json(await serializeLead(lead));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
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

    // Members can only edit leads currently assigned to them
    if (authUser.role === 'member') {
      const isAssigned = String(lead.assignedMemberId || '') === authUser.id;
      if (!isAssigned) return NextResponse.json({ error: 'You can only modify leads assigned to you' }, { status: 403 });
      if ((lead as any).assignmentStatus === 'pending') {
        return NextResponse.json(
          { error: 'Pending lead assignments must be accepted or passed on from notifications' },
          { status: 403 }
        );
      }
    }

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
    delete updates.assignmentStatus;
    delete updates.assignmentRequestedById;
    delete updates.assignmentRequestedAt;
    delete updates.assignmentAcceptedAt;

    const isAgentReassignAttempt = updates.assignedMemberId !== undefined;
    if (isAgentReassignAttempt) {
      const assignmentError = await validateAgentAssignment(authUser, updates.assignedMemberId || null);
      if (assignmentError) {
        return NextResponse.json({ error: assignmentError }, { status: 403 });
      }

      const currentAssigned = String(lead.assignedMemberId || '');
      const nextAssigned = String(updates.assignedMemberId || '');
      if (currentAssigned !== nextAssigned) {
        if (updates.assignedMemberId) {
          const pendingForAnotherUser = String(updates.assignedMemberId) !== String(authUser.id);
          updates.assignmentStatus = pendingForAnotherUser ? 'pending' : 'accepted';
          updates.assignmentRequestedById = authUser.id;
          updates.assignmentRequestedAt = new Date();
          updates.assignmentAcceptedAt = pendingForAnotherUser ? null : new Date();
        } else {
          updates.assignmentStatus = 'accepted';
          updates.assignmentRequestedById = null;
          updates.assignmentRequestedAt = null;
          updates.assignmentAcceptedAt = null;
        }
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

        if ((updated as any).assignmentStatus === 'pending' && updated.assignedMemberId) {
          await LeadActivity.create({
            leadId: updated._id.toString(),
            leadName: updated.name,
            userId: authUser.id,
            userName: authUser.fullName,
            userRole: authUser.role,
            actionType: 'assignment_offered',
            details: {
              from: oldAssignedAgent?.fullName || authUser.fullName,
              to: newAssignedAgent?.fullName || 'unassigned',
            },
          });

          await createAssignmentNotification({
            assigneeId: updated.assignedMemberId.toString(),
            assignedById: authUser.id,
            assignedByName: authUser.fullName,
            lead: updated,
          });
        }
      }
    } catch (e) { console.error('Failed to log lead modification', e); }

    return NextResponse.json(await serializeLead(updated));
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
