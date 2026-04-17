import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Lead from '@/models/Lead';
import User from '@/models/User';
import LeadActivity from '@/models/LeadActivity';
import Notification from '@/models/Notification';
import { getAuthUserFromCookie } from '@/lib/auth';

function normalizePhone(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

async function getScopedMemberIdsForAdmin(adminId: string) {
  const adminUser = await User.findById(adminId).select('zones');
  const adminZones = new Set(
    (adminUser?.zones || []).map((zone: any) => String(zone).trim().toLowerCase()).filter(Boolean)
  );

  if (adminZones.size === 0) return [] as string[];

  const allMembers = await User.find({ role: 'member', status: { $in: ['active', 'inactive'] } })
    .select('_id zones')
    .lean();

  return allMembers
    .filter((member: any) => {
      const memberZones = Array.isArray(member.zones)
        ? member.zones.map((zone: any) => String(zone).trim().toLowerCase()).filter(Boolean)
        : [];
      return memberZones.some((zone: string) => adminZones.has(zone));
    })
    .map((member: any) => String(member._id));
}

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();

    const url = new URL(req.url);
    const skip = Math.max(0, parseInt(url.searchParams.get('skip') || '0'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const status = url.searchParams.get('status');
    const source = url.searchParams.get('source');
    const zone = url.searchParams.get('zone');
    const assignedMemberId = url.searchParams.get('assignedMemberId');
    const q = (url.searchParams.get('q') || '').trim();
    const duplicate = url.searchParams.get('duplicate');
    const sort = url.searchParams.get('sort');
    const period = url.searchParams.get('period');
    const fromQuery = url.searchParams.get('from');
    const toQuery = url.searchParams.get('to');
    const sortQuery: Record<string, 1 | -1> = sort === 'alphabetical'
      ? { name: 1, createdAt: -1, _id: 1 }
      : { createdAt: sort === 'oldest' ? 1 : -1, _id: sort === 'oldest' ? 1 : -1 };
    const memberAssignmentFilterMode =
      authUser.role === 'member' && (zone === 'assigned_by_me' || zone === 'assigned_to_me')
        ? zone
        : null;
    const memberAllLeadsMode = authUser.role === 'member' && zone === 'all';

    const query: any = {};
    const andFilters: any[] = [];
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Member default list: only accepted leads assigned to self.
    if (authUser.role === 'member') {
      if (memberAssignmentFilterMode === 'assigned_by_me') {
        andFilters.push({ assignmentRequestedById: authUser.id });
        andFilters.push({ assignedMemberId: { $ne: authUser.id } });
      } else if (memberAssignmentFilterMode === 'assigned_to_me') {
        andFilters.push({ assignedMemberId: authUser.id });
        andFilters.push({ assignmentRequestedById: { $exists: true, $ne: authUser.id } });
        andFilters.push({
          $or: [
            { assignmentStatus: { $exists: false } },
            { assignmentStatus: { $ne: 'pending' } },
          ],
        });
      } else if (!memberAllLeadsMode) {
        // Default member scope remains "my assigned leads" unless All Leads is selected.
        andFilters.push({ assignedMemberId: authUser.id });
        andFilters.push({
          $or: [
            { assignmentStatus: { $exists: false } },
            { assignmentStatus: { $ne: 'pending' } },
          ],
        });
      }
    }

    if (authUser.role === 'admin') {
      const scopedMemberIds = await getScopedMemberIdsForAdmin(authUser.id);
      if (scopedMemberIds.length === 0) {
        return NextResponse.json({ leads: [], total: 0 });
      }

      andFilters.push({ assignedMemberId: { $in: scopedMemberIds } });
    }

    // Optional status filter
    if (status) {
      query.status = status;
    }

    if (source) {
      query.source = source;
    }

    if (zone) {
      if ((zone === 'my_zones' || zone === 'other_zones') && ['admin', 'member'].includes(authUser.role)) {
        const authUserDoc = await User.findById(authUser.id).select('zones').lean();
        const authZones = Array.isArray((authUserDoc as any)?.zones)
          ? (authUserDoc as any).zones
            .map((value: any) => String(value).trim())
            .filter(Boolean)
          : [];

        if (zone === 'my_zones') {
          if (authZones.length === 0) {
            andFilters.push({ _id: null });
          } else {
            andFilters.push({
              $or: authZones.map((z) => ({ zone: { $regex: `^${escapeRegex(z)}$`, $options: 'i' } })),
            });
          }
        }

        if (zone === 'other_zones') {
          if (authZones.length > 0) {
            andFilters.push({
              $nor: authZones.map((z) => ({ zone: { $regex: `^${escapeRegex(z)}$`, $options: 'i' } })),
            });
          }
        }
      } else if (zone === 'assigned_by_me' || zone === 'assigned_to_me') {
        // Member assignment modes are handled above in role filters.
      } else if (zone !== 'all') {
        query.zone = zone;
      }
    }

    if (q) {
      const safe = escapeRegex(q);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { phone: { $regex: safe, $options: 'i' } },
      ];
    }

    if (assignedMemberId && assignedMemberId !== 'all') {
      andFilters.push({ assignedMemberId });
    }

    if (andFilters.length > 0) {
      query.$and = [...(query.$and || []), ...andFilters];
    }

    if (period === 'today') {
      const now = new Date();
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      query.createdAt = { $gte: from, $lte: now };
    } else if (period === 'custom' && fromQuery && toQuery) {
      const from = new Date(fromQuery);
      const to = new Date(toQuery);
      if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
        to.setUTCHours(23, 59, 59, 999);
        query.createdAt = { $gte: from, $lte: to };
      }
    }

    // Duplicate/unique filtering must be done before pagination.
    if (duplicate === 'duplicate' || duplicate === 'unique') {
      const candidates = await Lead.find(query)
        .select('_id phone')
        .sort(sortQuery)
        .lean();

      const phoneCounts = new Map<string, number>();
      for (const lead of candidates) {
        const normalizedPhone = normalizePhone((lead as any).phone);
        if (!normalizedPhone) continue;
        phoneCounts.set(normalizedPhone, (phoneCounts.get(normalizedPhone) || 0) + 1);
      }

      const matchingIds = candidates
        .filter((lead: any) => {
          const normalizedPhone = normalizePhone(lead.phone);
          const count = normalizedPhone ? (phoneCounts.get(normalizedPhone) || 0) : 0;
          return duplicate === 'duplicate' ? count > 1 : count <= 1;
        })
        .map((lead: any) => lead._id.toString());

      const total = matchingIds.length;
      const pagedIds = matchingIds.slice(skip, skip + limit);

      if (pagedIds.length === 0) {
        return NextResponse.json({ leads: [], total });
      }

      const leadsUnsorted = await Lead.find({ _id: { $in: pagedIds } })
        .populate('propertyId', '_id name');

      const order = new Map(pagedIds.map((id, index) => [id, index]));
      const leads = leadsUnsorted.sort((a: any, b: any) => {
        const ai = order.get(a._id.toString()) ?? 0;
        const bi = order.get(b._id.toString()) ?? 0;
        return ai - bi;
      });

      const assignedMemberIds = Array.from(
        new Set(leads.map((l: any) => l.assignedMemberId?.toString()).filter(Boolean))
      );
      const createdByIds = Array.from(
        new Set(leads.map((l: any) => l.createdBy?.toString()).filter(Boolean))
      );

      const allUserIdsToFetch = Array.from(new Set([...assignedMemberIds, ...createdByIds]));
      const fetchedUsers = allUserIdsToFetch.length
        ? await User.find({ _id: { $in: allUserIdsToFetch } }).select('_id fullName phone')
        : [];

      const userMap = new Map(
        fetchedUsers.map((u: any) => [u._id.toString(), { id: u._id.toString(), name: u.fullName, phone: u.phone }])
      );

      const transformedLeads = leads.map(l => {
        const normalizedPhone = normalizePhone((l as any).phone);
        const duplicateCount = normalizedPhone ? (phoneCounts.get(normalizedPhone) || 0) : 0;
        return {
          ...l.toObject(),
          id: l._id.toString(),
          assignedMemberId: l.assignedMemberId?.toString?.(),
          assignmentStatus: (l as any).assignmentStatus || 'accepted',
          assignmentRequestedById: (l as any).assignmentRequestedById?.toString?.(),
          assignmentRequestedAt: (l as any).assignmentRequestedAt || null,
          assignmentAcceptedAt: (l as any).assignmentAcceptedAt || null,
          duplicateCount,
          isDuplicate: duplicateCount > 1,
          members: l.assignedMemberId ? userMap.get(l.assignedMemberId.toString()) || null : null,
          creator: l.createdBy ? userMap.get(l.createdBy.toString()) || null : null,
          properties:
            l.propertyId && typeof l.propertyId === 'object' && '_id' in l.propertyId
              ? {
                  id: (l.propertyId as any)._id.toString(),
                  name: (l.propertyId as any).name,
                }
              : null,
        };
      });

      return NextResponse.json({ leads: transformedLeads, total });
    }

    // Get total count for pagination
    const total = await Lead.countDocuments(query);

    // Fetch paginated leads
    const leads = await Lead.find(query)
      .populate('propertyId', '_id name')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const assignedMemberIds = Array.from(
      new Set(leads.map((l: any) => l.assignedMemberId?.toString()).filter(Boolean))
    );
    const createdByIds = Array.from(
      new Set(leads.map((l: any) => l.createdBy?.toString()).filter(Boolean))
    );
    
    const allUserIdsToFetch = Array.from(new Set([...assignedMemberIds, ...createdByIds]));

    const fetchedUsers = allUserIdsToFetch.length
      ? await User.find({ _id: { $in: allUserIdsToFetch } }).select('_id fullName phone')
      : [];

    const userMap = new Map(
      fetchedUsers.map((u: any) => [u._id.toString(), { id: u._id.toString(), name: u.fullName, phone: u.phone }])
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
      assignmentStatus: (l as any).assignmentStatus || 'accepted',
      assignmentRequestedById: (l as any).assignmentRequestedById?.toString?.(),
      assignmentRequestedAt: (l as any).assignmentRequestedAt || null,
      assignmentAcceptedAt: (l as any).assignmentAcceptedAt || null,
      duplicateCount: phoneCounts.get(normalizePhone((l as any).phone)) || 0,
      isDuplicate: (phoneCounts.get(normalizePhone((l as any).phone)) || 0) > 1,
      members: l.assignedMemberId ? userMap.get(l.assignedMemberId.toString()) || null : null,
      creator: l.createdBy ? userMap.get(l.createdBy.toString()) || null : null,
      properties:
        l.propertyId && typeof l.propertyId === 'object' && '_id' in l.propertyId
          ? {
              id: (l.propertyId as any)._id.toString(),
              name: (l.propertyId as any).name,
            }
          : null,
    }));

    return NextResponse.json({ leads: transformedLeads, total });
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

    // Zone must be explicitly selected by user
    if (!String(body.zone || '').trim()) {
      return NextResponse.json({ error: 'Zone is required' }, { status: 400 });
    }

    const assignedMemberId = body.assignedMemberId || body.assigned_member_id || null;
    const assignmentError = await validateAgentAssignment(authUser, assignedMemberId);
    if (assignmentError) {
      return NextResponse.json({ error: assignmentError }, { status: 403 });
    }

    const resolvedAssignedMemberId = assignedMemberId || (authUser.role === 'member' ? authUser.id : null);
    const isPendingAssignment = Boolean(resolvedAssignedMemberId) && String(resolvedAssignedMemberId) !== String(authUser.id);

    const leadData = {
      ...body,
      zone: String(body.zone || '').trim(),
      preferredLocation: body.preferred_location || body.preferredLocation,
      assignedMemberId: resolvedAssignedMemberId,
      assignmentStatus: isPendingAssignment ? 'pending' : 'accepted',
      assignmentRequestedById: isPendingAssignment ? authUser.id : undefined,
      assignmentRequestedAt: isPendingAssignment ? new Date() : undefined,
      assignmentAcceptedAt: resolvedAssignedMemberId && !isPendingAssignment ? new Date() : undefined,
      createdBy: authUser.id,
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

      if (isPendingAssignment && resolvedAssignedMemberId) {
        await LeadActivity.create({
          leadId: lead._id.toString(),
          leadName: lead.name,
          userId: authUser.id,
          userName: authUser.fullName,
          userRole: authUser.role,
          actionType: 'assignment_offered',
          details: {
            from: authUser.fullName,
            to: resolvedAssignedMemberId,
            assignedById: authUser.id,
          },
        });

        await createAssignmentNotification({
          assigneeId: String(resolvedAssignedMemberId),
          assignedById: authUser.id,
          assignedByName: authUser.fullName,
          lead,
        });
      }
    } catch (e) { console.error('Failed to log lead creation', e); }

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

