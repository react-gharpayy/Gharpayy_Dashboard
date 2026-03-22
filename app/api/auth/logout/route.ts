import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUserFromCookie } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import LoginActivity from '@/models/LoginActivity';

export async function POST() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (authUser) {
      await connectToDatabase();
      await LoginActivity.create({
        userId: authUser.id,
        name: authUser.fullName,
        role: authUser.role,
        actionType: 'logout'
      });
    }
  } catch (e) {
    console.error('Failed to log logout activity', e);
  }

  const cookieStore = await cookies();
  cookieStore.set('auth_token', '', {
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });

  return NextResponse.json({ message: 'Logged out successfully' });
}
