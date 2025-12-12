import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';

// GET /api/auth/me - Get the effective current user (real or impersonated)
export async function GET() {
  try {
    // Check for impersonation first
    const impersonation = await getImpersonationContext();

    if (impersonation.isImpersonating && impersonation.practitionerId) {
      // Get the practitioner's user_id from the database
      const adminClient = createServiceRoleClient();
      const { data: practitioner } = await adminClient
        .from('practitioners')
        .select('user_id, name, email')
        .eq('id', impersonation.practitionerId)
        .single();

      if (practitioner?.user_id) {
        return NextResponse.json({
          user: {
            id: practitioner.user_id,
            email: practitioner.email,
          },
          isImpersonating: true,
          practitionerName: impersonation.practitionerName,
          adminReturnUrl: impersonation.adminReturnUrl,
        });
      }
    }

    // Not impersonating - get real user from Supabase auth
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null, isImpersonating: false });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      isImpersonating: false,
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    return NextResponse.json(
      { error: 'Failed to get current user' },
      { status: 500 }
    );
  }
}
