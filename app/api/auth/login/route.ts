import { NextResponse } from 'next/server';
import { issueAuthCookie, normalizeUsername, ensureDefaultCEO } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';
import LoginActivity from '@/models/LoginActivity';

export async function POST(req: Request) {
  try {
    // Ensure Super Admin exists in database
    await ensureDefaultCEO();

    const body = await req.json();
    const username = normalizeUsername(body.username || body.email);
    const password = body.password;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findOne({ username });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // All users authenticate with hashed DB password
    const isValidPassword = await bcrypt.compare(String(password), String(user.password));

    if (!isValidPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await issueAuthCookie({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role as any,
      zones: user.zones,
    });

    try {
      await LoginActivity.create({
        userId: user._id,
        name: user.fullName,
        role: user.role,
        actionType: 'login'
      });
    } catch (e) {
      console.error('Failed to log login activity', e);
    }

    return NextResponse.json({
      message: 'Logged in successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        zones: user.zones,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
