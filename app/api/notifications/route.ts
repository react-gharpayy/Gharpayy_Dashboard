import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Notification from '@/models/Notification';
import { getAuthUserFromCookie } from '@/lib/auth';

export async function GET() {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectToDatabase();
    const notifications = await Notification.find({ userId: authUser.id })
      .sort({ createdAt: -1 })
      .limit(50);

    const transformed = notifications.map((n: any) => ({
      id: n._id.toString(),
      title: n.title,
      body: n.message,
      type: n.type,
      is_read: Boolean(n.isRead),
      action_status: n.actionStatus || 'completed',
      metadata: n.metadata || null,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
    }));

    return NextResponse.json(transformed);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const all = searchParams.get('all');
    
    await connectToDatabase();
    
    if (all === 'true') {
      await Notification.updateMany({ userId: authUser.id, isRead: false }, { isRead: true });
      return NextResponse.json({ success: true });
    }
    
    if (id) {
      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId: authUser.id },
        { isRead: true },
        { new: true }
      );
      if (!notification) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      return NextResponse.json({
        id: notification._id.toString(),
        title: notification.title,
        body: notification.message,
        type: notification.type,
        is_read: Boolean(notification.isRead),
        action_status: notification.actionStatus || 'completed',
        metadata: notification.metadata || null,
        created_at: notification.createdAt,
        updated_at: notification.updatedAt,
      });
    }
    
    return NextResponse.json({ error: 'ID or all=true required' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
