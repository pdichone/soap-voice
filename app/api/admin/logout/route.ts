import { NextResponse } from 'next/server';
import { clearAdminSessionCookie, getAdminUser } from '@/lib/admin-auth';
import { logAdminEvent } from '@/lib/db/admin-queries';

export async function POST() {
  try {
    // Log the logout event before clearing the session
    const admin = await getAdminUser();
    if (admin) {
      await logAdminEvent({
        actorType: 'admin',
        actorId: admin.id,
        actorEmail: admin.email,
        eventType: 'admin.logout',
        description: `Admin ${admin.name} logged out`,
      });
    }

    const response = NextResponse.json({ success: true });
    clearAdminSessionCookie(response);
    return response;
  } catch (error) {
    console.error('Admin logout error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
