import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import LeadActivity from '@/models/LeadActivity';
import Notification from '@/models/Notification';
import { getAuthUserFromCookie } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'member') {
      return NextResponse.json({ error: 'Only members can accept assignments' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { id } = await params;

    await connectToDatabase();

    const lead = await Lead.findById(id);
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const isAssigned = String(lead.assignedMemberId || '') === String(authUser.id);
    if (!isAssigned) {
      return NextResponse.json({ error: 'You can only accept leads assigned to you' }, { status: 403 });
    }

    const status = (lead as any).assignmentStatus || 'accepted';
    if (status !== 'pending') {
      return NextResponse.json({ error: 'This assignment is no longer pending' }, { status: 409 });
    }

    (lead as any).assignmentStatus = 'accepted';
    (lead as any).assignmentAcceptedAt = new Date();
    await lead.save();

    await LeadActivity.create({
      leadId: lead._id.toString(),
      leadName: lead.name,
      userId: authUser.id,
      userName: authUser.fullName,
      userRole: authUser.role,
      actionType: 'assignment_accepted',
      details: {
        acceptedBy: authUser.fullName,
      },
    });

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
