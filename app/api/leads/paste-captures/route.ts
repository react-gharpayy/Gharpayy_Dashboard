import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getAuthUserFromCookie } from '@/lib/auth';
import LeadPasteCapture from '@/models/LeadPasteCapture';

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['super_admin', 'manager', 'admin', 'member'].includes(authUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const rawText = typeof body.rawText === 'string' ? body.rawText : '';

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
    }

    await connectToDatabase();

    const capture = await LeadPasteCapture.create({
      rawText,
      source: typeof body.source === 'string' ? body.source : 'unknown',
      page: typeof body.page === 'string' ? body.page : null,
      createdBy: authUser.id,
      createdByName: authUser.fullName,
      createdByRole: authUser.role,
    });

    return NextResponse.json({ id: capture._id.toString() }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
