import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUserFromCookie, normalizeUsername } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can update users' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    await connectToDatabase();
    const user = await User.findById(id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (body.fullName) user.fullName = body.fullName.trim();
    if (body.email) {
      const newEmail = body.email.trim().toLowerCase();
      user.email = newEmail;
      // Auto-update username when email is changed
      user.username = normalizeUsername(newEmail);
    }
    if (body.phone) user.phone = body.phone.trim();
    if (body.zones) user.zones = body.zones;

    await user.save();

    return NextResponse.json({ message: 'User updated', id: user._id.toString() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can reset passwords' }, { status: 403 });
    }

    const { id } = await params;
    const { password } = await req.json();

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    user.password = await bcrypt.hash(password, 12);
    await user.save();

    return NextResponse.json({ message: 'Password updated' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can delete users' }, { status: 403 });
    }

    const { id } = await params;
    await connectToDatabase();

    const user = await User.findById(id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Remove from parent references
    if (user.managerId) {
      await User.findByIdAndUpdate(user.managerId, { $pull: { adminIds: user._id } });
    }
    if (user.adminId) {
      await User.findByIdAndUpdate(user.adminId, { $pull: { adminIds: user._id } });
    }

    // Hard delete for invited users (cancel invitation)
    if (user.status === 'invited') {
      await User.findByIdAndDelete(id);
      return NextResponse.json({ message: 'Invitation cancelled and user removed' });
    }

    // For non-invited: hard delete as well since we already have status-based soft delete
    await User.findByIdAndDelete(id);
    return NextResponse.json({ message: 'User deleted' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
