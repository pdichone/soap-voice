import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';
import { getLocalDateString } from '@/lib/date-utils';

async function getEffectiveUserAndClient() {
  const impersonation = await getImpersonationContext();

  if (impersonation.isImpersonating && impersonation.practitionerId) {
    const adminClient = createServiceRoleClient();
    const { data: practitioner } = await adminClient
      .from('practitioners')
      .select('user_id')
      .eq('id', impersonation.practitionerId)
      .single();

    return {
      userId: practitioner?.user_id || null,
      client: adminClient,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  return {
    userId: user?.id || null,
    client: supabase,
  };
}

// GET /api/data/visits - Get visits data for effective user
export async function GET() {
  try {
    const { userId, client } = await getEffectiveUserAndClient();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const today = getLocalDateString();

    // Run all queries in parallel
    const [visitsResult, patientsResult, referralsResult, benefitsResult] = await Promise.all([
      client
        .from('visits_non_phi')
        .select('*, patient:patients_non_phi(id, display_name)')
        .eq('owner_user_id', userId)
        .order('visit_date', { ascending: false })
        .limit(50),
      client
        .from('patients_non_phi')
        .select('*')
        .eq('owner_user_id', userId)
        .eq('is_active', true)
        .order('display_name'),
      client
        .from('referrals_non_phi')
        .select('*')
        .eq('owner_user_id', userId)
        .or(`referral_expiration_date.is.null,referral_expiration_date.gte.${today}`)
        .order('referral_start_date', { ascending: false }),
      client
        .from('patient_benefits')
        .select('*')
        .eq('owner_user_id', userId),
    ]);

    return NextResponse.json({
      visits: visitsResult.data || [],
      patients: patientsResult.data || [],
      referrals: referralsResult.data || [],
      benefits: benefitsResult.data || [],
      userId,
    });
  } catch (error) {
    console.error('Error in visits API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/data/visits - Create a new visit
export async function POST(request: Request) {
  try {
    const { userId, client } = await getEffectiveUserAndClient();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { patient_id, referral_id, visit_date, is_billable_to_insurance } = body;

    const { data: visitData, error } = await client.from('visits_non_phi').insert({
      owner_user_id: userId,
      patient_id,
      referral_id: referral_id || null,
      visit_date,
      is_billable_to_insurance,
    }).select().single();

    if (error) {
      console.error('Error creating visit:', error);
      return NextResponse.json({ error: 'Failed to create visit' }, { status: 500 });
    }

    return NextResponse.json({ visit: visitData });
  } catch (error) {
    console.error('Error in create visit API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
