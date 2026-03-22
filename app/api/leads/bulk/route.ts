import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import LeadActivity from '@/models/LeadActivity';
import { getAuthUserFromCookie } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { leads } = await req.json();
    if (!Array.isArray(leads)) return NextResponse.json({ error: 'Leads array required' }, { status: 400 });

    await connectToDatabase();
    
    // Transform leads to match MongoDB schema
    const transformedLeads = leads.map(l => ({
      ...l,
      preferredLocation: l.preferred_location || l.preferredLocation,
      assignedMemberId: l.assigned_member_id || l.assignedMemberId,
      firstResponseTimeMin: l.first_response_time_min || l.firstResponseTimeMin,
    }));

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

    const leadsToUpdate = await Lead.find({ _id: { $in: ids } });

    const result = await Lead.updateMany(
      { _id: { $in: ids } },
      { $set: mappedUpdates }
    );

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
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idsString = searchParams.get('ids');
    let ids: string[] = [];
    
    if (idsString) {
      ids = idsString.split(',').filter(Boolean);
    } else {
      const body = await req.json().catch(() => ({}));
      ids = body.ids || [];
    }

    if (!ids || ids.length === 0) return NextResponse.json({ error: 'IDs required' }, { status: 400 });

    await connectToDatabase();
    
    // Fetch leads before deletion to preserve names in logs
    const leadsToDelete = await Lead.find({ _id: { $in: ids } }, '_id name');
    
    const result = await Lead.deleteMany({ _id: { $in: ids } });

    try {
      if (leadsToDelete.length > 0) {
        const activityLogs = leadsToDelete.map((doc: any) => ({
          leadId: doc._id.toString(),
          leadName: doc.name,
          userId: authUser.id,
          userName: authUser.fullName,
          userRole: authUser.role,
          actionType: 'deleted',
          createdAt: new Date()
        }));
        await LeadActivity.insertMany(activityLogs);
      } else {
        // Fallback: If Lead was already gone, try to create a name-less log at least, 
        // or skip if we only want named logs. For now, we try to at least log the IDs.
        const activityLogs = ids.map((id: string) => ({
          leadId: id,
          userId: authUser.id,
          userName: authUser.fullName,
          userRole: authUser.role,
          actionType: 'deleted',
          createdAt: new Date()
        }));
        await LeadActivity.insertMany(activityLogs);
      }
    } catch (e) { console.error('Failed to log bulk deletion', e); }

    return NextResponse.json({ count: result.deletedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
