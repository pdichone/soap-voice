import { NextResponse } from 'next/server';
import { getAdminUser, setImpersonationCookies, clearImpersonationCookies } from '@/lib/admin-auth';
import {
  getPractitionerById,
  createImpersonationSession,
  endImpersonationSession,
  logAdminEvent,
} from '@/lib/db/admin-queries';
import { headers } from 'next/headers';

// POST /api/admin/impersonate - Start impersonation
export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { practitioner_id } = await request.json();

    if (!practitioner_id) {
      return NextResponse.json(
        { error: 'Practitioner ID is required' },
        { status: 400 }
      );
    }

    // Get practitioner details
    const practitioner = await getPractitionerById(practitioner_id);
    if (!practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Get request metadata
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for') || 'unknown';
    const userAgent = headersList.get('user-agent') || undefined;

    // Create impersonation session
    const session = await createImpersonationSession(
      admin.id,
      practitioner_id,
      ipAddress,
      userAgent
    );

    // Log the event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.impersonation_started',
      practitionerId: practitioner_id,
      workspaceId: practitioner.workspace_id,
      description: `Started impersonating ${practitioner.name} (${practitioner.email})`,
    });

    // Create response with impersonation cookies
    const response = NextResponse.json({
      success: true,
      redirect: '/dashboard',
    });

    setImpersonationCookies(response, {
      workspaceId: practitioner.workspace_id,
      sessionId: session.id,
      practitionerName: practitioner.name,
      practitionerId: practitioner.id,
      adminReturnUrl: `/admin/practitioners/${practitioner.id}`,
    });

    return response;
  } catch (error) {
    console.error('Error starting impersonation:', error);
    return NextResponse.json(
      { error: 'Failed to start impersonation' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/impersonate - End impersonation
export async function DELETE(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (sessionId) {
      // End the impersonation session in database
      await endImpersonationSession(sessionId);

      // Log the event
      await logAdminEvent({
        actorType: 'admin',
        actorId: admin.id,
        actorEmail: admin.email,
        eventType: 'admin.impersonation_ended',
        description: 'Ended impersonation session',
      });
    }

    // Create response and clear cookies
    const response = NextResponse.json({
      success: true,
      redirect: '/admin',
    });

    clearImpersonationCookies(response);

    return response;
  } catch (error) {
    console.error('Error ending impersonation:', error);
    return NextResponse.json(
      { error: 'Failed to end impersonation' },
      { status: 500 }
    );
  }
}
