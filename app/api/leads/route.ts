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
    const q = (url.searchParams.get('q') || '').trim();
    const duplicate = url.searchParams.get('duplicate');
    const sort = url.searchParams.get('sort');
    const period = url.searchParams.get('period');
    const fromQuery = url.searchParams.get('from');
    const toQuery = url.searchParams.get('to');
    const sortQuery: Record<string, 1 | -1> = sort === 'alphabetical'
      ? { name: 1, createdAt: -1 }
      : { createdAt: sort === 'oldest' ? 1 : -1 };

    const query: any = {};
    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Members can only see leads currently assigned to them
    if (authUser.role === 'member') {
      query.assignedMemberId = authUser.id;
    }

    // Optional status filter
    if (status) {
      query.status = status;
    }

    if (source) {
      query.source = source;
    }

    if (zone) {
      query.zone = zone;
    }

    if (q) {
      const safe = escapeRegex(q);
      query.$or = [
        { name: { $regex: safe, $options: 'i' } },
        { phone: { $regex: safe, $options: 'i' } },
      ];
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

    const leadData = {
      ...body,
      zone: String(body.zone || '').trim(),
      preferredLocation: body.preferred_location || body.preferredLocation,
      assignedMemberId: assignedMemberId || (authUser.role === 'member' ? authUser.id : null),
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
    } catch (e) { console.error('Failed to log lead creation', e); }

    return NextResponse.json(lead, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

