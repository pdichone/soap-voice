import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, getAdminUser } from '@/lib/admin-auth';
import { logAdminEvent } from '@/lib/db/admin-queries';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

// Use service role for admin operations
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    await requireAdmin();
    const admin = await getAdminUser();

    const { id } = await params;

    // Get practitioner details
    const { data: practitioner, error: fetchError } = await supabaseAdmin
      .from('practitioners')
      .select('id, email, name, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Get the site URL for the redirect
    // Priority: NEXT_PUBLIC_APP_URL > NEXT_PUBLIC_SITE_URL > localhost
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Use Supabase Admin to send magic link
    // inviteUserByEmail creates the user AND sends the email
    // Use /auth/callback (server-side) instead of /auth/confirm (client-side)
    // because callback properly handles the code/token_hash from query params
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      practitioner.email,
      {
        redirectTo: `${siteUrl}/auth/callback`,
        data: {
          practitioner_id: practitioner.id,
          name: practitioner.name,
        },
      }
    );

    // If user already exists, use generateLink instead
    if (inviteError?.message?.includes('already been registered')) {
      // User exists, send a magic link instead
      const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: practitioner.email,
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (linkError) {
        console.error('Error generating magic link:', linkError);
        return NextResponse.json(
          { error: 'Failed to send magic link' },
          { status: 500 }
        );
      }

      // Also manually send the email via signInWithOtp (since generateLink doesn't send)
      // We need to use a client-side supabase instance for this, or configure email templates
      // For now, let's use the admin API to send the invite which will send the email

      // Alternative: Use the admin API's sendRecoveryEmail or similar
      // Since generateLink doesn't send the email, we'll use a different approach

      // Let's try using the regular auth signInWithOtp which sends the email
      const { createServerClient } = await import('@supabase/ssr');
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();

      const supabase = createServerClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Ignore
              }
            },
          },
        }
      );

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: practitioner.email,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (otpError) {
        console.error('Error sending OTP:', otpError);

        // Handle rate limiting
        if (otpError.message?.includes('security purposes') || otpError.code === 'over_email_send_rate_limit') {
          return NextResponse.json(
            { error: 'Please wait 60 seconds before sending another magic link' },
            { status: 429 }
          );
        }

        return NextResponse.json(
          { error: 'Failed to send magic link email' },
          { status: 500 }
        );
      }
    } else if (inviteError) {
      console.error('Error inviting user:', inviteError);
      return NextResponse.json(
        { error: inviteError.message || 'Failed to send magic link' },
        { status: 500 }
      );
    }

    // Log the admin event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin?.id,
      actorEmail: admin?.email,
      eventType: 'admin.magic_link_sent',
      practitionerId: practitioner.id,
      description: `Magic link sent to ${practitioner.email}`,
    });

    return NextResponse.json({
      success: true,
      message: `Magic link sent to ${practitioner.email}`
    });
  } catch (error) {
    console.error('Error in send-magic-link:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
