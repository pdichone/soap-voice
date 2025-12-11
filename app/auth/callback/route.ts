import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

// Service role client for linking practitioner to user
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to link practitioner record to user
async function linkPractitioner(user: User, supabase: ReturnType<typeof createServerClient>) {
  try {
    // Check if therapist profile exists, create if not (legacy support)
    const { data: therapist } = await supabase
      .from('therapists')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!therapist) {
      await supabase.from('therapists').insert({
        id: user.id,
        name: user.email?.split('@')[0] || 'Therapist',
        email: user.email,
      });
    }

    // Link practitioner record to user if exists (for admin-created accounts)
    if (user.email) {
      const userEmail = user.email.toLowerCase();

      // First, try to find an unlinked practitioner by email (admin-created)
      // Must not be deleted and must not already have a user_id
      const { data: practitioner } = await supabaseAdmin
        .from('practitioners')
        .select('id, user_id')
        .ilike('email', userEmail) // Case-insensitive match
        .is('user_id', null)
        .is('deleted_at', null) // Exclude soft-deleted practitioners
        .single();

      if (practitioner) {
        // Link the practitioner to this auth user
        await supabaseAdmin
          .from('practitioners')
          .update({
            user_id: user.id,
            email: userEmail, // Normalize email case
            status: 'active',
            last_login_at: new Date().toISOString(),
            login_count: 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', practitioner.id);

        // Log the first login event
        await supabaseAdmin.from('admin_events').insert({
          actor_type: 'practitioner',
          actor_id: user.id,
          actor_email: userEmail,
          event_type: 'practitioner.first_login',
          event_category: 'practitioner',
          practitioner_id: practitioner.id,
          description: `First login for ${userEmail}`,
          metadata: {
            linked_at: new Date().toISOString(),
          },
        });

        console.log('Linked practitioner:', practitioner.id, 'to user:', user.id);
        return; // Done - practitioner was linked
      }

      // Check if user already has a linked practitioner
      const { data: existingPractitioner } = await supabaseAdmin
        .from('practitioners')
        .select('id, login_count')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (existingPractitioner) {
        // Update last login for existing practitioner
        await supabaseAdmin
          .from('practitioners')
          .update({
            last_login_at: new Date().toISOString(),
            login_count: (existingPractitioner.login_count || 0) + 1,
          })
          .eq('id', existingPractitioner.id);

        console.log('Updated login count for practitioner:', existingPractitioner.id);
        return; // Done - existing practitioner updated
      }

      // No practitioner found - auto-create one for self-signup flow
      // This ensures all users have a practitioner record
      console.log('No practitioner found, creating new one for:', userEmail);

      const { data: newPractitioner, error: createError } = await supabaseAdmin
        .from('practitioners')
        .insert({
          user_id: user.id,
          email: userEmail,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Practitioner',
          status: 'active',
          plan_type: 'trial',
          billing_status: 'trial',
          last_login_at: new Date().toISOString(),
          login_count: 1,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating practitioner:', createError);
      } else {
        console.log('Created new practitioner:', newPractitioner?.id, 'for user:', user.id);

        // Log the signup event
        await supabaseAdmin.from('admin_events').insert({
          actor_type: 'practitioner',
          actor_id: user.id,
          actor_email: userEmail,
          event_type: 'practitioner.self_signup',
          event_category: 'practitioner',
          practitioner_id: newPractitioner?.id,
          description: `Self-signup for ${userEmail}`,
          metadata: {
            created_at: new Date().toISOString(),
          },
        });
      }
    }
  } catch (err) {
    console.error('Error in linkPractitioner:', err);
    // Don't throw - allow login to continue even if linking fails
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Log for debugging
  console.log('Auth callback received:', {
    hasCode: !!code,
    hasTokenHash: !!token_hash,
    type,
    error,
    error_description,
    searchParams: Object.fromEntries(searchParams.entries()),
  });

  // Handle errors from Supabase
  if (error) {
    console.error('Auth callback error:', error, error_description);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error_description || error)}`);
  }

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
            // Can't set cookies in edge runtime in some cases
          }
        },
      },
    }
  );

  // Handle token_hash (magic link OTP flow)
  if (token_hash && type) {
    console.log('Verifying OTP with token_hash...');

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'magiclink' | 'signup' | 'recovery',
    });

    if (verifyError) {
      console.error('OTP verification error:', verifyError);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(verifyError.message)}`);
    }

    console.log('OTP verified successfully');

    // Successfully verified - link practitioner
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await linkPractitioner(user, supabase);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // Handle code (PKCE flow - OAuth or email with PKCE)
  if (code) {
    console.log('Exchanging code for session...');

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
    }

    console.log('Code exchanged successfully');

    // Successfully exchanged - link practitioner
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await linkPractitioner(user, supabase);
    }

    return NextResponse.redirect(`${origin}${next}`);
  }

  // No code or token_hash - check if we already have a session
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('User already authenticated, redirecting...');
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Something went wrong, redirect to login
  console.log('No auth credentials found, redirecting to login');
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
