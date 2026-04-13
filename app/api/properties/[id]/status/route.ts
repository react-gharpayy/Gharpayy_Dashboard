import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Property from '@/models/Property';
import { getAuthUserFromCookie } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Auth
    let authUser = null;
    try {
      authUser = await getAuthUserFromCookie();
    } catch (authError: any) {
      return NextResponse.json({ error: 'Auth check failed: ' + authError?.message }, { status: 401 });
    }
    if (!authUser)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['super_admin', 'admin', 'manager'].includes(authUser.role))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Body
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body.isActive !== 'boolean')
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });

    // Update
    const { id } = await params;
    const pgId = parseInt(id, 10);
    if (isNaN(pgId))
      return NextResponse.json({ error: 'Invalid PG ID — must be numeric' }, { status: 400 });

    await connectToDatabase();

    const property = await Property.findOneAndUpdate(
      { pgId },                                          // match by sheet numeric ID
      { $set: { isActive: body.isActive } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      message: `Property ${body.isActive ? 'enabled' : 'disabled'} successfully`,
      pgId,
      isActive: property.isActive,
    });

  } catch (error: any) {
    console.error('[status] Unexpected error:', error?.message);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}