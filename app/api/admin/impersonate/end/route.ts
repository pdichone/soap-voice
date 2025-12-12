import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminUser, clearImpersonationCookies } from '@/lib/admin-auth';
import { endImpersonationSession, logAdminEvent } from '@/lib/db/admin-queries';

// POST /api/admin/impersonate/end - End impersonation session
export async function POST() {
  try {
    // Get the session ID from cookies before clearing
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('impersonation_session_id')?.value;
    const practitionerId = cookieStore.get('impersonating_practitioner_id')?.value;

    // Try to get admin user (may fail if not logged in as admin)
    const admin = await getAdminUser();

    if (sessionId) {
      // End the impersonation session in database
      await endImpersonationSession(sessionId);

      // Log the event if we have admin context
      if (admin) {
        await logAdminEvent({
          actorType: 'admin',
          actorId: admin.id,
          actorEmail: admin.email,
          eventType: 'admin.impersonation_ended',
          practitionerId: practitionerId || undefined,
          description: 'Ended impersonation session',
        });
      }
    }

    // Create response and clear cookies
    const response = NextResponse.json({
      success: true,
      redirect: '/admin/practitioners',
    });

    clearImpersonationCookies(response);

    return response;
  } catch (error) {
    console.error('Error ending impersonation:', error);

    // Even on error, try to clear the cookies
    const response = NextResponse.json(
      { error: 'Failed to end impersonation', success: false },
      { status: 500 }
    );

    clearImpersonationCookies(response);

    return response;
  }
}
