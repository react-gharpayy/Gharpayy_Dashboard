import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Member from '@/models/User';
import User from '@/models/User';
import { getAuthUserFromCookie, normalizeUsername } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import Zone from '@/models/Zone';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await connectToDatabase();

    const member = await User.findById(id)
      .select('-password')
      .populate('adminId', 'fullName email username');

    if (!member || member.role !== 'member') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Super Admin can see all members, admin can only see their own members
    if (authUser.role !== 'super_admin' && authUser.id !== member.adminId?.toString()) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      id: member._id,
      name: member.fullName,
      email: member.email,
      phone: member.phone,
      username: member.username,
      zones: member.zones || [],
      adminId: member.adminId,
      createdAt: member.createdAt,
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
      return NextResponse.json({ error: 'Only Super Admin can update members' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    await connectToDatabase();

    const member = await User.findById(id);
    if (!member || member.role !== 'member') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const username = body.username ? normalizeUsername(body.username) : undefined;
    const email = body.email?.trim().toLowerCase();

    if (username) {
      const existingWithUsername = await User.findOne({ username, _id: { $ne: member._id } });
      if (existingWithUsername) {
        return NextResponse.json({ error: 'Username is already in use' }, { status: 400 });
      }
      member.username = username;
    }

    if (email) {
      const existingWithEmail = await User.findOne({ email, _id: { $ne: member._id } });
      if (existingWithEmail) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
      }
      member.email = email;
      // Auto-update username when email is changed
      member.username = normalizeUsername(email);
    }

    if (Array.isArray(body.zones)) {
      const zoneDocs = await Zone.find({ isActive: true }).select('name');
      const zoneNames = new Set(zoneDocs.map((z: any) => String(z.name).trim().toLowerCase()));
      
      for (const z of body.zones) {
        if (!zoneNames.has(String(z).trim().toLowerCase())) {
          try { await Zone.create({ name: String(z).trim(), isActive: true }); } catch (e) {}
        }
      }
      member.zones = body.zones;
    }

    // Update allowed fields
    if (body.fullName) member.fullName = body.fullName;
    if (body.phone) member.phone = body.phone;

    // Update password if provided
    if (body.password) {
      member.password = await bcrypt.hash(body.password, 12);
    }

    // Update admin assignment if provided
    if (body.adminId !== undefined) {
      const oldAdminId = member.adminId;

      // Remove member from old admin's list
      if (oldAdminId) {
        await User.findByIdAndUpdate(oldAdminId, {
          $pull: { adminIds: member._id }
        });
      }

      // Add member to new admin's list
      if (body.adminId) {
        member.adminId = new Types.ObjectId(body.adminId);
        await User.findByIdAndUpdate(body.adminId, {
          $push: { adminIds: member._id }
        });
      } else {
        member.adminId = undefined;
      }
    }

    await member.save();

    return NextResponse.json({
      message: 'Member updated successfully',
      member: {
        id: member._id,
        name: member.fullName,
        email: member.email,
        phone: member.phone,
        username: member.username,
        zones: member.zones || [],
        adminId: member.adminId,
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
      return NextResponse.json({ error: 'Only Super Admin can reset member password' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    if (!body.password || String(body.password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    await connectToDatabase();

    const member = await User.findById(id);
    if (!member || member.role !== 'member') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(String(body.password), 12);
    await User.findByIdAndUpdate(id, { password: hashedPassword });

    return NextResponse.json({ message: 'Member password reset successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can delete members' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const member = await User.findById(id);
    if (!member || member.role !== 'member') {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Remove member from admin's list
    if (member.adminId) {
      await User.findByIdAndUpdate(member.adminId, {
        $pull: { adminIds: member._id }
      });
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Member deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
