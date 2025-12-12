import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';

// GET /api/auth/practice - Get the practice config for the effective user
export async function GET() {
  try {
    // Check for impersonation first
    const impersonation = await getImpersonationContext();
    const adminClient = createServiceRoleClient();

    let userId: string | null = null;

    if (impersonation.isImpersonating && impersonation.practitionerId) {
      // Get the practitioner's user_id
      const { data: practitioner } = await adminClient
        .from('practitioners')
        .select('user_id, practice_type')
        .eq('id', impersonation.practitionerId)
        .single();

      if (practitioner?.user_id) {
        userId = practitioner.user_id;

        // Return practice config based on practitioner
        const { data: profile } = await adminClient
          .from('profiles')
          .select('practice_id')
          .eq('id', userId)
          .single();

        if (profile?.practice_id) {
          const { data: practice } = await adminClient
            .from('practices')
            .select('*')
            .eq('id', profile.practice_id)
            .single();

          if (practice) {
            // Override with practitioner's practice_type if set
            if (practitioner.practice_type) {
              practice.practice_type = practitioner.practice_type;
            }
            return NextResponse.json({ practice });
          }
        }

        // No practice in practices table, but check practitioner data
        if (practitioner.practice_type) {
          return NextResponse.json({
            practice: {
              id: 'admin-controlled',
              name: 'My Practice',
              practice_type: practitioner.practice_type,
              settings: {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          });
        }

        return NextResponse.json({ practice: null });
      }
    }

    // Not impersonating - get real user from Supabase auth
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ practice: null });
    }

    userId = user.id;

    // Check practitioner table first for admin-controlled practice type
    const { data: practitioner } = await adminClient
      .from('practitioners')
      .select('practice_type')
      .eq('user_id', userId)
      .single();

    // Get profile to find practice_id
    const { data: profile } = await adminClient
      .from('profiles')
      .select('practice_id')
      .eq('id', userId)
      .single();

    if (profile?.practice_id) {
      const { data: practice } = await adminClient
        .from('practices')
        .select('*')
        .eq('id', profile.practice_id)
        .single();

      if (practice) {
        // Override with practitioner's practice_type if set
        if (practitioner?.practice_type) {
          practice.practice_type = practitioner.practice_type;
        }
        return NextResponse.json({ practice });
      }
    }

    // No practice in practices table, but check practitioner data
    if (practitioner?.practice_type) {
      return NextResponse.json({
        practice: {
          id: 'admin-controlled',
          name: 'My Practice',
          practice_type: practitioner.practice_type,
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ practice: null });
  } catch (error) {
    console.error('Error getting practice config:', error);
    return NextResponse.json({ error: 'Failed to get practice config' }, { status: 500 });
  }
}
