import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import connectToDatabase from '@/lib/mongodb';
import IntegrationKey from '@/models/IntegrationKey';
import { getAuthUserFromCookie } from '@/lib/auth';

function generateKey() {
  const raw = randomBytes(24).toString('hex');
  return `ghp_${raw}`;
}

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser || authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    let keyDoc = await IntegrationKey.findOne().sort({ createdAt: -1 });
    if (!keyDoc) {
      keyDoc = await IntegrationKey.create({ key: generateKey(), createdBy: authUser.id });
    }

    return NextResponse.json({ ok: true, key: keyDoc.key, rotatedAt: keyDoc.rotatedAt || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser || authUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rotate = Boolean(body?.rotate);

    await connectToDatabase();
    let keyDoc = await IntegrationKey.findOne().sort({ createdAt: -1 });
    if (!keyDoc) {
      keyDoc = await IntegrationKey.create({ key: generateKey(), createdBy: authUser.id });
    } else if (rotate) {
      keyDoc.key = generateKey();
      keyDoc.rotatedAt = new Date();
      keyDoc.createdBy = authUser.id;
      await keyDoc.save();
    }

    return NextResponse.json({ ok: true, key: keyDoc.key, rotatedAt: keyDoc.rotatedAt || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
