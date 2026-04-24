import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUserFromCookie, normalizeUsername } from '@/lib/auth';
import { Types } from 'mongoose';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can access manager details' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const manager = await User.findById(id)
      .select('-password')
      .populate('adminIds', '-password')
      .sort({ fullName: 1 });

    if (!manager || manager.role !== 'manager') {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    const mapped = {
      id: manager._id,
      username: manager.username,
      fullName: manager.fullName,
      email: manager.email,
      phone: manager.phone,
      admins: manager.adminIds?.map((admin: any) => ({
        id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        email: admin.email,
        phone: admin.phone,
        zones: admin.zones || [],
        role: admin.role,
      })) || [],
      createdAt: manager.createdAt,
    };

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can update managers' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    await connectToDatabase();

    const manager = await User.findById(id);
    if (!manager || manager.role !== 'manager') {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    const username = body.username ? normalizeUsername(body.username) : undefined;
    const email = body.email?.trim().toLowerCase();

    if (username) {
      const existingWithUsername = await User.findOne({ username, _id: { $ne: manager._id } });
      if (existingWithUsername) {
        return NextResponse.json({ error: 'Username is already in use' }, { status: 400 });
      }
      manager.username = username;
    }

    if (email) {
      const existingWithEmail = await User.findOne({ email, _id: { $ne: manager._id } });
      if (existingWithEmail) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
      }
      manager.email = email;
      // Auto-update username when email is changed
      manager.username = normalizeUsername(email);
    }

    // Update allowed fields
    if (body.fullName) manager.fullName = body.fullName;
    if (body.phone) manager.phone = body.phone;

    // Update password if provided
    if (body.password) {
      manager.password = await bcrypt.hash(body.password, 12);
    }

    // Update admin assignments if provided
    if (Array.isArray(body.adminIds)) {
      const oldAdminIds = manager.adminIds || [];
      const newAdminIds = body.adminIds;

      // Remove manager reference from old admins not in new list
      for (const oldAdminId of oldAdminIds) {
        if (!newAdminIds.includes(oldAdminId.toString())) {
          await User.findByIdAndUpdate(oldAdminId, { managerId: undefined });
        }
      }

      // Add manager reference to new admins
      for (const newAdminId of newAdminIds) {
        if (!oldAdminIds.some((id: any) => id.toString() === newAdminId)) {
          await User.findByIdAndUpdate(newAdminId, { managerId: manager._id });
        }
      }

      manager.adminIds = newAdminIds.map((id: string) => new Types.ObjectId(id));
    }

    await manager.save();
    await manager.populate('adminIds', '-password');

    return NextResponse.json({
      message: 'Manager updated successfully',
      manager: {
        id: manager._id,
        username: manager.username,
        fullName: manager.fullName,
        email: manager.email,
        phone: manager.phone,
        admins: manager.adminIds?.map((admin: any) => ({
          id: admin._id,
          username: admin.username,
          fullName: admin.fullName,
          email: admin.email,
          phone: admin.phone,
          zones: admin.zones || [],
        })) || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can delete managers' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const manager = await User.findById(id);
    if (!manager || manager.role !== 'manager') {
      return NextResponse.json({ error: 'Manager not found' }, { status: 404 });
    }

    // Remove manager reference from admins
    if (manager.adminIds && manager.adminIds.length > 0) {
      await User.updateMany(
        { _id: { $in: manager.adminIds } },
        { managerId: undefined }
      );
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: 'Manager deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
