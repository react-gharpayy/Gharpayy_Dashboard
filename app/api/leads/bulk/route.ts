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

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leads } = await req.json();
    if (!Array.isArray(leads)) return NextResponse.json({ error: 'Leads array required' }, { status: 400 });

    // Validate that all leads have an explicit non-empty zone
    const leadsWithoutZone = leads.filter(l => !String(l.zone || '').trim());
    if (leadsWithoutZone.length > 0) {
      return NextResponse.json(
        { error: `${leadsWithoutZone.length} lead(s) missing zone. All leads must have a zone assigned.` },
        { status: 400 }
      );
    }

    await connectToDatabase();
    
    // Transform leads to match MongoDB schema
    const transformedLeads = leads.map(l => {
      const resolvedAssignedMemberId = l.assigned_member_id || l.assignedMemberId || (authUser.role === 'member' ? authUser.id : undefined);
      const isPendingAssignment = Boolean(resolvedAssignedMemberId) && String(resolvedAssignedMemberId) !== String(authUser.id);

      return {
        ...l,
        zone: String(l.zone || '').trim(),
        preferredLocation: l.preferred_location || l.preferredLocation,
        assignedMemberId: resolvedAssignedMemberId,
        assignmentStatus: isPendingAssignment ? 'pending' : 'accepted',
        assignmentRequestedById: isPendingAssignment ? authUser.id : undefined,
        assignmentRequestedAt: isPendingAssignment ? new Date() : undefined,
        assignmentAcceptedAt: resolvedAssignedMemberId && !isPendingAssignment ? new Date() : undefined,
        createdBy: authUser.id,
        firstResponseTimeMin: l.first_response_time_min || l.firstResponseTimeMin,
      };
    });

    const result = await Lead.insertMany(transformedLeads);

    try {
      const activityLogs = result.map((insertedLead) => ({
        leadId: insertedLead._id.toString(),
        leadName: insertedLead.name,
        userId: authUser.id,
        userName: authUser.fullName,
        userRole: authUser.role,
        actionType: 'added',
        details: { source: insertedLead.source, status: insertedLead.status }
      }));
      if (activityLogs.length > 0) {
        await LeadActivity.insertMany(activityLogs);
      }
    } catch (e) { console.error('Failed to log bulk lead creation', e); }

    return NextResponse.json({ count: result.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { ids, updates } = await req.json();
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'IDs array required' }, { status: 400 });

    await connectToDatabase();
    
    // Map snake_case updates to camelCase for MongoDB
    const mappedUpdates: any = { ...updates };
    if (updates.assigned_member_id !== undefined) {
      mappedUpdates.assignedMemberId = updates.assigned_member_id === 'unassigned' ? null : updates.assigned_member_id;
      delete mappedUpdates.assigned_member_id;
    }
    if (updates.preferred_location) mappedUpdates.preferredLocation = updates.preferred_location;

    if (authUser.role === 'member' && mappedUpdates.assignedMemberId !== undefined) {
      return NextResponse.json(
        { error: 'Members can only pass leads through notification actions' },
        { status: 403 }
      );
    }

    // Assignment permission checks
    if (mappedUpdates.assignedMemberId) {
      const member = await User.findOne({ _id: mappedUpdates.assignedMemberId, role: 'member' }).select('_id adminId');
      if (!member) {
        return NextResponse.json({ error: 'Selected member not found' }, { status: 400 });
      }
      if (authUser.role === 'admin' && String(member.adminId || '') !== String(authUser.id)) {
        return NextResponse.json(
          { error: 'Admins can assign leads only to members under them' },
          { status: 403 }
        );
      }
    }

    const updateScope = authUser.role === 'member'
      ? { _id: { $in: ids }, assignedMemberId: authUser.id }
      : { _id: { $in: ids } };

    const leadsToUpdate = await Lead.find(updateScope);

    let result: { modifiedCount: number } = { modifiedCount: 0 };
    if (mappedUpdates.assignedMemberId !== undefined) {
      const mutableEntries = Object.entries(mappedUpdates).filter(([key]) => key !== 'assignedMemberId');
      const bulkOps = leadsToUpdate.map((oldLead: any) => {
        const setDoc: Record<string, any> = Object.fromEntries(mutableEntries);
        setDoc.assignedMemberId = mappedUpdates.assignedMemberId;

        const assigneeChanged = String(oldLead.assignedMemberId || '') !== String(mappedUpdates.assignedMemberId || '');
        if (assigneeChanged) {
          if (mappedUpdates.assignedMemberId) {
            const pendingForAnotherUser = String(mappedUpdates.assignedMemberId) !== String(authUser.id);
            setDoc.assignmentStatus = pendingForAnotherUser ? 'pending' : 'accepted';
            setDoc.assignmentRequestedById = authUser.id;
            setDoc.assignmentRequestedAt = new Date();
            setDoc.assignmentAcceptedAt = pendingForAnotherUser ? null : new Date();
          } else {
            setDoc.assignmentStatus = 'accepted';
            setDoc.assignmentRequestedById = null;
            setDoc.assignmentRequestedAt = null;
            setDoc.assignmentAcceptedAt = null;
          }
        }

        return {
          updateOne: {
            filter: { _id: oldLead._id },
            update: { $set: setDoc },
          },
        };
      });

      const writeResult = bulkOps.length ? await Lead.bulkWrite(bulkOps) : { modifiedCount: 0 };
      result = { modifiedCount: writeResult.modifiedCount || 0 };
    } else {
      const updateResult = await Lead.updateMany(
        updateScope,
        { $set: mappedUpdates }
      );
      result = { modifiedCount: updateResult.modifiedCount };
    }

    try {
      const activityLogs: any[] = [];
      const now = new Date();
      
      const memberIdsToLookup = new Set<string>();
      if (mappedUpdates.assignedMemberId) memberIdsToLookup.add(mappedUpdates.assignedMemberId.toString());
      for (const oldLead of leadsToUpdate) {
        if (oldLead.assignedMemberId) memberIdsToLookup.add(oldLead.assignedMemberId.toString());
      }
      
      const memberDocs = await User.find({ _id: { $in: Array.from(memberIdsToLookup) } }).select('fullName');
      const memberNameMap: Record<string, string> = {};
      memberDocs.forEach((m: any) => { memberNameMap[m._id.toString()] = m.fullName; });

      for (const oldLead of leadsToUpdate) {
        if (mappedUpdates.status !== undefined && oldLead.status !== mappedUpdates.status) {
          activityLogs.push({
            leadId: oldLead._id.toString(),
            leadName: oldLead.name,
            userId: authUser.id,
            userName: authUser.fullName,
            userRole: authUser.role,
            actionType: 'status_changed',
            details: { from: oldLead.status, to: mappedUpdates.status },
            createdAt: now
          });
        }
        if (mappedUpdates.assignedMemberId !== undefined && String(oldLead.assignedMemberId || '') !== String(mappedUpdates.assignedMemberId || '')) {
          const fromName = oldLead.assignedMemberId ? (memberNameMap[oldLead.assignedMemberId.toString()] || 'unassigned') : 'unassigned';
          const toName = mappedUpdates.assignedMemberId ? (memberNameMap[mappedUpdates.assignedMemberId.toString()] || 'unassigned') : 'unassigned';

          activityLogs.push({
            leadId: oldLead._id.toString(),
            leadName: oldLead.name,
            userId: authUser.id,
            userName: authUser.fullName,
            userRole: authUser.role,
            actionType: 'assigned',
            details: { from: fromName, to: toName },
            createdAt: now
          });

          if (mappedUpdates.assignedMemberId) {
            activityLogs.push({
              leadId: oldLead._id.toString(),
              leadName: oldLead.name,
              userId: authUser.id,
              userName: authUser.fullName,
              userRole: authUser.role,
              actionType: 'assignment_offered',
              details: { from: fromName, to: toName },
              createdAt: now,
            });

            await createAssignmentNotification({
              assigneeId: mappedUpdates.assignedMemberId.toString(),
              assignedById: authUser.id,
              assignedByName: authUser.fullName,
              lead: oldLead,
            });
          }
        }
      }
      if (activityLogs.length > 0) {
        await LeadActivity.insertMany(activityLogs);
      }
    } catch (e) { console.error('Failed to log bulk modification', e); }

    return NextResponse.json({ count: result.modifiedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Lead deletion is disabled for all users' }, { status: 403 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
