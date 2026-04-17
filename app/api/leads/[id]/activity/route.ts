import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import { getAuthUserFromCookie } from '@/lib/auth';
import { ACTIVITY_TYPE_KEYS } from '@/lib/leadsActivityAndPriority';

type RouteParams = { params: Promise<{ id: string }> };

function isTerminalStage(stage?: string | null) {
  return ['lost', 'booked', 'check_in'].includes(String(stage || ''));
}

function dateOrNull(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function objectIdLike() {
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.padEnd(24, '0').slice(0, 24);
}

async function serializeLead(lead: any) {
  const assignedAgent = lead.assignedMemberId
    ? await User.findOne({ _id: lead.assignedMemberId, role: 'member' }).select('_id fullName phone')
    : null;

  const creator = lead.createdBy
    ? await User.findById(lead.createdBy).select('_id fullName phone')
    : null;

  return {
    ...lead.toObject(),
    id: lead._id.toString(),
    assignedMemberId: lead.assignedMemberId?.toString?.(),
    assignmentStatus: lead.assignmentStatus || 'accepted',
    assignmentRequestedById: lead.assignmentRequestedById?.toString?.(),
    assignmentRequestedAt: lead.assignmentRequestedAt || null,
    assignmentAcceptedAt: lead.assignmentAcceptedAt || null,
    members: assignedAgent
      ? { id: assignedAgent._id.toString(), name: assignedAgent.fullName, phone: assignedAgent.phone }
      : null,
    creator: creator ? { id: creator._id.toString(), name: creator.fullName, phone: creator.phone } : null,
    properties:
      lead.propertyId && typeof lead.propertyId === 'object' && '_id' in lead.propertyId
        ? { id: (lead.propertyId as any)._id.toString(), name: (lead.propertyId as any).name }
        : null,
  };
}

function isOwnerOrAssignee(lead: any, userId: string) {
  return String(lead.assignedMemberId || '') === userId || String(lead.createdBy || '') === userId;
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();

    const lead = await Lead.findById(id).select('_id assignedMemberId createdBy activity');
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    if (authUser.role === 'member' && !isOwnerOrAssignee(lead, authUser.id)) {
      return NextResponse.json({ error: 'You can only view activity for your own or assigned leads' }, { status: 403 });
    }

    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const activity = Array.isArray((lead as any).activity) ? [...(lead as any).activity] : [];
    activity.sort((a: any, b: any) => new Date(b.on).getTime() - new Date(a.on).getTime());
    return NextResponse.json(activity);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const type = String(body.type || '').trim();
    const note = String(body.note || '').trim();
    const nextAction = String(body.nextAction || '').trim();
    const newStage = String(body.newStage || '').trim();
    const lostReason = String(body.lostReason || '').trim();
    const nextDateRaw = String(body.nextDate || '').trim();
    const visitDateRaw = String(body.visitDate || '').trim();

    if (!ACTIVITY_TYPE_KEYS.has(type)) {
      return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 });
    }

    if (!note) {
      return NextResponse.json({ error: 'Notes are required' }, { status: 400 });
    }

    if (!newStage) {
      return NextResponse.json({ error: 'Stage after this action is required' }, { status: 400 });
    }

    if (!nextAction) {
      return NextResponse.json({ error: 'Next action is required' }, { status: 400 });
    }

    if (!nextDateRaw) {
      return NextResponse.json({ error: 'Next follow-up date is required' }, { status: 400 });
    }

    await connectToDatabase();

    const lead = await Lead.findById(id).populate('propertyId', '_id name');
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const resolvedNewStage = newStage;

    const canMarkLost =
      authUser.role === 'super_admin' ||
      authUser.role === 'manager' ||
      authUser.role === 'admin' ||
      isOwnerOrAssignee(lead, authUser.id);

    if (resolvedNewStage === 'lost') {
      if (!canMarkLost) {
        return NextResponse.json({ error: 'Only lead owner or admin roles can mark lead as lost' }, { status: 403 });
      }
    }

    const nextDate = dateOrNull(nextDateRaw);
    if (nextDateRaw && !nextDate) {
      return NextResponse.json({ error: 'Invalid nextDate' }, { status: 400 });
    }

    const visitDate = dateOrNull(visitDateRaw);
    if (visitDateRaw && !visitDate) {
      return NextResponse.json({ error: 'Invalid visitDate' }, { status: 400 });
    }

    const now = new Date();
    const finalNote = note;

    const entry = {
      id: objectIdLike(),
      on: now,
      by: authUser.fullName,
      type,
      note: finalNote,
    };

    const updates: Record<string, any> = {
      $push: { activity: entry },
      $inc: { touches: 1 },
      $set: {
        lastOn: now,
      },
    };

    if (nextAction) {
      updates.$set.nextAction = nextAction;
    }

    if (resolvedNewStage) {
      updates.$set.status = resolvedNewStage;
      updates.$set.stageOn = now;
    }

    if (nextDate) {
      updates.$set.nextOn = nextDate;
    } else if (resolvedNewStage && isTerminalStage(resolvedNewStage)) {
      updates.$set.nextOn = null;
    }

    if (type === 'visit_sched' && visitDate) {
      updates.$set.visitOn = visitDate;
    }

    if (type === 'visit_done') {
      updates.$set.visitDoneOn = now;
    }

    if (resolvedNewStage === 'booked') {
      updates.$set.bookingOn = now;
    }

    await Lead.updateOne({ _id: id }, updates);

    const updatedLead = await Lead.findById(id).populate('propertyId', '_id name');
    if (!updatedLead) return NextResponse.json({ error: 'Lead not found after update' }, { status: 404 });

    return NextResponse.json(await serializeLead(updatedLead));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
