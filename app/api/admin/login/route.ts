import { NextResponse } from 'next/server';
import { adminLogin, setAdminSessionCookie } from '@/lib/admin-auth';
import { logAdminEvent } from '@/lib/db/admin-queries';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await adminLogin(email, password);

    if (!result.success || !result.admin) {
      return NextResponse.json(
        { error: result.error || 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Log the login event
    await logAdminEvent({
      actorType: 'admin',
      actorId: result.admin.id,
      actorEmail: result.admin.email,
      eventType: 'admin.login',
      description: `Admin ${result.admin.name} logged in`,
    });

    // Create response and set session cookie
    const response = NextResponse.json({ success: true });
    setAdminSessionCookie(response, result.admin);

    return response;
  } catch (error) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
