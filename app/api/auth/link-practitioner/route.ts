import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

// Service role client for admin operations
const supabaseAdmin = createClient(
  SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
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

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if therapist profile exists, create if not
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
      console.log('Created therapist profile for:', user.id);
    }

    // Link practitioner record to user if exists (for admin-created accounts)
    if (user.email) {
      const { data: practitioner } = await supabaseAdmin
        .from('practitioners')
        .select('id, user_id')
        .eq('email', user.email.toLowerCase())
        .is('user_id', null)
        .single();

      if (practitioner) {
        // Link the practitioner to this auth user
        await supabaseAdmin
          .from('practitioners')
          .update({
            user_id: user.id,
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
          actor_email: user.email,
          event_type: 'practitioner.first_login',
          event_category: 'practitioner',
          practitioner_id: practitioner.id,
          description: `First login for ${user.email}`,
          metadata: {
            linked_at: new Date().toISOString(),
          },
        });

        console.log('Linked practitioner:', practitioner.id, 'to user:', user.id);

        return NextResponse.json({
          success: true,
          linked: true,
          practitionerId: practitioner.id
        });
      }

      // Check if already linked
      const { data: existingPractitioner } = await supabaseAdmin
        .from('practitioners')
        .select('id, login_count')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (existingPractitioner) {
        // Update last login
        await supabaseAdmin
          .from('practitioners')
          .update({
            last_login_at: new Date().toISOString(),
            login_count: (existingPractitioner.login_count || 0) + 1,
          })
          .eq('id', existingPractitioner.id);

        console.log('Updated login for practitioner:', existingPractitioner.id);

        return NextResponse.json({
          success: true,
          linked: true,
          practitionerId: existingPractitioner.id
        });
      }

      // No practitioner found - auto-create one for self-signup
      console.log('No practitioner found, creating new one for:', user.email);

      const { data: newPractitioner, error: createError } = await supabaseAdmin
        .from('practitioners')
        .insert({
          user_id: user.id,
          email: user.email.toLowerCase(),
          name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Practitioner',
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
        console.log('Created new practitioner:', newPractitioner?.id);

        // Log the signup event
        await supabaseAdmin.from('admin_events').insert({
          actor_type: 'practitioner',
          actor_id: user.id,
          actor_email: user.email,
          event_type: 'practitioner.self_signup',
          event_category: 'practitioner',
          practitioner_id: newPractitioner?.id,
          description: `Self-signup for ${user.email}`,
          metadata: {
            created_at: new Date().toISOString(),
          },
        });

        return NextResponse.json({
          success: true,
          created: true,
          practitionerId: newPractitioner?.id
        });
      }
    }

    return NextResponse.json({ success: true, linked: false });
  } catch (error) {
    console.error('Error linking practitioner:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
