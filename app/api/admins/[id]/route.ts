import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUserFromCookie, normalizeUsername } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import Zone from '@/models/Zone';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can access admin details' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const admin = await User.findById(id)
      .select('-password')
      .populate('adminIds', '-password')
      .populate('managerId', 'fullName email username');

    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: admin._id,
      username: admin.username,
      fullName: admin.fullName,
      email: admin.email,
      phone: admin.phone,
      zones: admin.zones || [],
      role: admin.role,
      managerId: admin.managerId,
      members: admin.adminIds?.map((member: any) => ({
        id: member._id,
        name: member.fullName,
        email: member.email,
        phone: member.phone,
        username: member.username,
        zones: member.zones || [],
      })) || [],
      createdAt: admin.createdAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can update admins' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    await connectToDatabase();

    const admin = await User.findById(id);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const username = body.username ? normalizeUsername(body.username) : undefined;
    const email = body.email?.trim().toLowerCase();

    if (username) {
      const existingWithUsername = await User.findOne({ username, _id: { $ne: admin._id } });
      if (existingWithUsername) {
        return NextResponse.json({ error: 'Username is already in use' }, { status: 400 });
      }
      admin.username = username;
    }

    if (email) {
      const existingWithEmail = await User.findOne({ email, _id: { $ne: admin._id } });
      if (existingWithEmail) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
      }
      admin.email = email;
      // Auto-update username when email is changed
      admin.username = normalizeUsername(email);
    }

    if (Array.isArray(body.zones)) {
      const zoneDocs = await Zone.find({ isActive: true }).select('name');
      const zoneNames = new Set(zoneDocs.map((z: any) => String(z.name).trim().toLowerCase()));
      
      for (const z of body.zones) {
        if (!zoneNames.has(String(z).trim().toLowerCase())) {
          try { await Zone.create({ name: String(z).trim(), isActive: true }); } catch (e) {}
        }
      }
      admin.zones = body.zones;
    }

    // Update allowed fields
    if (body.fullName) admin.fullName = body.fullName;
    if (body.phone) admin.phone = body.phone;

    // Update password if provided
    if (body.password) {
      admin.password = await bcrypt.hash(body.password, 12);
    }

    // Update member assignments if provided
    if (Array.isArray(body.adminIds)) {
      const oldAgentIds = admin.adminIds || [];
      const newAgentIds = body.adminIds;

      // Remove admin reference from old members not in new list
      for (const oldAgentId of oldAgentIds) {
        if (!newAgentIds.includes(oldAgentId.toString())) {
          await User.findByIdAndUpdate(oldAgentId, { adminId: undefined });
        }
      }

      // Add admin reference to new members
      for (const newAgentId of newAgentIds) {
        if (!oldAgentIds.some((id: any) => id.toString() === newAgentId)) {
          await User.findByIdAndUpdate(newAgentId, { adminId: admin._id });
        }
      }

      admin.adminIds = newAgentIds.map((id: string) => new Types.ObjectId(id));
    }

    await admin.save();
    await admin.populate('adminIds', '-password');

    return NextResponse.json({
      message: 'Admin updated successfully',
      admin: {
        id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        phone: admin.phone,
        zones: admin.zones || [],
        members: admin.adminIds?.map((member: any) => ({
          id: member._id,
          name: member.fullName,
          email: member.email,
          phone: member.phone,
          username: member.username,
          zones: member.zones || [],
        })) || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can reset admin password' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    if (!body.password || String(body.password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    await connectToDatabase();

    const admin = await User.findById(id);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(String(body.password), 12);
    await User.findByIdAndUpdate(id, { password: hashedPassword });

    return NextResponse.json({ message: 'Admin password reset successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can delete admins' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const admin = await User.findById(id);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Remove admin reference from members
    if (admin.adminIds && admin.adminIds.length > 0) {
      await User.updateMany(
        { _id: { $in: admin.adminIds } },
        { adminId: undefined }
      );
    }

    // Remove from manager's adminIds list
    if (admin.managerId) {
      await User.findByIdAndUpdate(admin.managerId, {
        $pull: { adminIds: admin._id }
      });
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Admin deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

