import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';

// GET /api/data/patients - Get patients for effective user
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('archived') === 'true';

    const impersonation = await getImpersonationContext();
    let userId: string | null = null;

    if (impersonation.isImpersonating && impersonation.practitionerId) {
      // Get practitioner's user_id using service role
      const adminClient = createServiceRoleClient();
      const { data: practitioner } = await adminClient
        .from('practitioners')
        .select('user_id')
        .eq('id', impersonation.practitionerId)
        .single();

      userId = practitioner?.user_id || null;

      if (!userId) {
        return NextResponse.json({ patients: [], archivedPatients: [] });
      }

      // Query using service role client (bypasses RLS)
      const { data: patients, error } = await adminClient
        .from('patients_non_phi')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('is_active', true)
        .order('display_name');

      if (error) {
        console.error('Error fetching patients:', error);
        return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
      }

      let archivedPatients: typeof patients = [];
      if (includeArchived) {
        const { data: archived } = await adminClient
          .from('patients_non_phi')
          .select('*')
          .eq('owner_user_id', userId)
          .eq('is_active', false)
          .order('display_name');
        archivedPatients = archived || [];
      }

      return NextResponse.json({ patients: patients || [], archivedPatients });
    }

    // Not impersonating - use regular Supabase client with RLS
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { data: patients, error } = await supabase
      .from('patients_non_phi')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('is_active', true)
      .order('display_name');

    if (error) {
      console.error('Error fetching patients:', error);
      return NextResponse.json({ error: 'Failed to fetch patients' }, { status: 500 });
    }

    let archivedPatients: typeof patients = [];
    if (includeArchived) {
      const { data: archived } = await supabase
        .from('patients_non_phi')
        .select('*')
        .eq('owner_user_id', user.id)
        .eq('is_active', false)
        .order('display_name');
      archivedPatients = archived || [];
    }

    return NextResponse.json({ patients: patients || [], archivedPatients });
  } catch (error) {
    console.error('Error in patients API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
