import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const baseUrl = process.env.ATTENDANCE_BASE_URL || '';
    if (!baseUrl) return NextResponse.json({ error: 'ATTENDANCE_BASE_URL is not set' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === 'string' ? body.email : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/integrations/attendance/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    const data = await res.json();
    if (!res.ok || !data?.loginToken) {
      return NextResponse.json({ error: data?.error || 'Login failed' }, { status: res.status || 401 });
    }

    const redirectUrl = `${baseUrl.replace(/\/$/, '')}/api/integrations/attendance/exchange?token=${encodeURIComponent(data.loginToken)}`;
    return NextResponse.json({ ok: true, redirectUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
