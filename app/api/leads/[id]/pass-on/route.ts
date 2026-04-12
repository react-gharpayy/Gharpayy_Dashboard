import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import LeadActivity from '@/models/LeadActivity';
import Notification from '@/models/Notification';
import { getAuthUserFromCookie } from '@/lib/auth';

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'member') {
      return NextResponse.json({ error: 'Only members can pass on assignments' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const targetMemberId = body?.targetMemberId || body?.target_member_id;
    if (!targetMemberId) {
      return NextResponse.json({ error: 'Target member is required' }, { status: 400 });
    }

    if (String(targetMemberId) === String(authUser.id)) {
      return NextResponse.json({ error: 'Please choose another member to pass this lead' }, { status: 400 });
    }

    const { id } = await params;

    await connectToDatabase();

    const [lead, targetMember] = await Promise.all([
      Lead.findById(id),
      User.findOne({ _id: targetMemberId, role: 'member' }).select('_id fullName'),
    ]);

    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (!targetMember) return NextResponse.json({ error: 'Selected member not found' }, { status: 404 });

    const isAssigned = String(lead.assignedMemberId || '') === String(authUser.id);
    if (!isAssigned) {
      return NextResponse.json({ error: 'You can only pass on leads assigned to you' }, { status: 403 });
    }

    const status = (lead as any).assignmentStatus || 'accepted';
    if (status !== 'pending') {
      return NextResponse.json({ error: 'Only pending assignments can be passed on' }, { status: 409 });
    }

    const previousAssigneeName = authUser.fullName;
    lead.assignedMemberId = targetMember._id as any;
    (lead as any).assignmentStatus = 'pending';
    (lead as any).assignmentRequestedById = authUser.id;
    (lead as any).assignmentRequestedAt = new Date();
    (lead as any).assignmentAcceptedAt = null;
    await lead.save();

    await LeadActivity.insertMany([
      {
        leadId: lead._id.toString(),
        leadName: lead.name,
        userId: authUser.id,
        userName: authUser.fullName,
        userRole: authUser.role,
        actionType: 'assignment_passed_on',
        details: {
          from: previousAssigneeName,
          to: targetMember.fullName,
        },
      },
      {
        leadId: lead._id.toString(),
        leadName: lead.name,
        userId: authUser.id,
        userName: authUser.fullName,
        userRole: authUser.role,
        actionType: 'assignment_offered',
        details: {
          from: previousAssigneeName,
          to: targetMember.fullName,
        },
      },
    ]);

    const notificationFilter: any = {
      userId: authUser.id,
      type: 'lead_assignment_request',
      actionStatus: 'pending',
      'metadata.leadId': lead._id.toString(),
    };
    if (body?.notificationId) {
      notificationFilter._id = body.notificationId;
    }

    await Notification.updateMany(notificationFilter, {
      isRead: true,
      actionStatus: 'completed',
    });

    await createAssignmentNotification({
      assigneeId: targetMember._id.toString(),
      assignedById: authUser.id,
      assignedByName: authUser.fullName,
      lead,
    });

    return NextResponse.json({
      ...lead.toObject(),
      id: lead._id.toString(),
      assignedMemberId: lead.assignedMemberId?.toString?.(),
      assignmentStatus: (lead as any).assignmentStatus || 'accepted',
      assignmentRequestedById: (lead as any).assignmentRequestedById?.toString?.(),
      assignmentRequestedAt: (lead as any).assignmentRequestedAt || null,
      assignmentAcceptedAt: (lead as any).assignmentAcceptedAt || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
