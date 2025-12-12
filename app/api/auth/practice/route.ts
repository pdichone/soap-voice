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
      // Get the practitioner's data
      const { data: practitioner, error: practitionerError } = await adminClient
        .from('practitioners')
        .select('user_id, practice_type, name')
        .eq('id', impersonation.practitionerId)
        .single();

      console.log('[Practice API] Impersonation - practitioner:', {
        practitionerId: impersonation.practitionerId,
        practitioner,
        error: practitionerError,
      });

      // If practitioner has practice_type, return it (even without user_id)
      if (practitioner?.practice_type) {
        // Try to get practice from practices table if user_id exists
        if (practitioner.user_id) {
          const { data: profile } = await adminClient
            .from('profiles')
            .select('practice_id')
            .eq('id', practitioner.user_id)
            .single();

          if (profile?.practice_id) {
            const { data: practice } = await adminClient
              .from('practices')
              .select('*')
              .eq('id', profile.practice_id)
              .single();

            if (practice) {
              // Override with practitioner's practice_type
              practice.practice_type = practitioner.practice_type;
              return NextResponse.json({ practice });
            }
          }
        }

        // Return admin-controlled practice with practitioner's practice_type
        return NextResponse.json({
          practice: {
            id: 'admin-controlled',
            name: practitioner.name || 'My Practice',
            practice_type: practitioner.practice_type,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }

      // Practitioner exists but no practice_type - return null to show onboarding
      console.log('[Practice API] Impersonation - no practice_type set for practitioner');
      return NextResponse.json({ practice: null });
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
