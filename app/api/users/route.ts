import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import { getAuthUserFromCookie, normalizeUsername } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can access users' }, { status: 403 });
    }

    await connectToDatabase();

    const url = new URL(req.url);
    const status = url.searchParams.get('status');

    const query: any = { role: { $ne: 'super_admin' } };
    if (status && ['active', 'inactive', 'invited', 'deleted'].includes(status)) {
      query.status = status;
    }

    const users = await User.find(query)
      .select('-password')
      .populate('adminId', 'fullName email username')
      .populate('managerId', 'fullName email username')
      .sort({ createdAt: -1 });

    const mapped = users.map((u) => ({
      id: u._id.toString(),
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      username: u.username,
      role: u.role,
      status: u.status || 'active',
      zones: u.zones || [],
      adminId: u.adminId,
      managerId: u.managerId,
      invitedAt: u.invitedAt,
      deletedAt: u.deletedAt,
      createdAt: u.createdAt,
    }));

    return NextResponse.json(mapped);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only Super Admin can add users' }, { status: 403 });
    }

    const body = await req.json();
    const { fullName, email, phone, role, password, managerId, adminId } = body;

    if (!fullName || !email || !phone || !role || !password) {
      return NextResponse.json(
        { error: 'Name, email, phone, role and password are required' },
        { status: 400 }
      );
    }

    if (!['manager', 'admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Role must be manager, admin, or member' }, { status: 400 });
    }

    await connectToDatabase();

    const username = normalizeUsername(email);
    const existingUser = await User.findOne({ $or: [{ username }, { email: email.trim().toLowerCase() }] });
    if (existingUser) {
      return NextResponse.json({ error: 'User already exists with this email' }, { status: 400 });
    }

    // Validate parent relationships
    if (managerId) {
      const manager = await User.findOne({ _id: managerId, role: 'manager' });
      if (!manager) {
        return NextResponse.json({ error: 'Invalid manager' }, { status: 400 });
      }
    }

    if (adminId) {
      const admin = await User.findOne({ _id: adminId, role: 'admin' });
      if (!admin) {
        return NextResponse.json({ error: 'Invalid admin' }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userData: any = {
      username,
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password: hashedPassword,
      fullName: fullName.trim(),
      role,
      status: 'active',
      zones: body.zones || [],
    };

    if (role === 'admin') {
      userData.managerId = managerId;
      userData.adminIds = [];
    }

    if (role === 'member') {
      userData.adminId = adminId;
    }

    if (role === 'manager') {
      userData.adminIds = [];
      userData.managerIds = [];
    }

    const user = await User.create(userData);

    // Update parent's reference arrays
    if (role === 'admin' && managerId) {
      await User.findByIdAndUpdate(managerId, { $push: { adminIds: user._id } });
    }

    if (role === 'member' && adminId) {
      await User.findByIdAndUpdate(adminId, { $push: { adminIds: user._id } });
    }

    return NextResponse.json(
      {
        id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        role: user.role,
        status: user.status,
        message: 'User added successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
