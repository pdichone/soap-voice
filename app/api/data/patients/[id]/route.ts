import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';

// GET /api/data/patients/[id] - Get patient detail for effective user
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const impersonation = await getImpersonationContext();
    let userId: string | null = null;
    let client;

    if (impersonation.isImpersonating && impersonation.practitionerId) {
      const adminClient = createServiceRoleClient();
      const { data: practitioner } = await adminClient
        .from('practitioners')
        .select('user_id')
        .eq('id', impersonation.practitionerId)
        .single();

      userId = practitioner?.user_id || null;
      client = adminClient;

      if (!userId) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
    } else {
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      userId = user.id;
      client = supabase;
    }

    // Run all queries in parallel
    const [
      patientResult,
      visitsResult,
      claimsResult,
      referralsResult,
      paymentsResult,
      templatesResult,
      clientDocsResult,
      intakeFormsResult,
      intakeLinksResult,
      intakeResponsesResult,
      benefitsResult,
      consentLinksResult,
    ] = await Promise.all([
      client.from('patients_non_phi').select('*').eq('id', patientId).eq('owner_user_id', userId).single(),
      client.from('visits_non_phi').select('*').eq('patient_id', patientId).order('visit_date', { ascending: false }),
      client.from('claims_non_phi').select('*').eq('patient_id', patientId).order('date_of_service', { ascending: false }),
      client.from('referrals_non_phi').select('*').eq('patient_id', patientId).order('referral_start_date', { ascending: false }),
      client.from('payments_non_phi').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      client.from('document_templates').select('*').eq('owner_user_id', userId).eq('is_active', true).order('sort_order', { ascending: true }),
      client.from('client_documents').select('*').eq('patient_id', patientId).eq('owner_user_id', userId),
      client.from('intake_forms').select('*').eq('owner_user_id', userId).eq('is_active', true).order('created_at', { ascending: false }),
      client.from('intake_links').select('*, intake_forms (*)').eq('patient_id', patientId).eq('owner_user_id', userId).order('created_at', { ascending: false }),
      client.from('intake_responses').select('*, intake_forms (*)').eq('patient_id', patientId).eq('owner_user_id', userId).order('submitted_at', { ascending: false }),
      client.from('patient_benefits').select('*').eq('patient_id', patientId).eq('owner_user_id', userId).single(),
      client.from('consent_links').select('*').eq('patient_id', patientId).eq('owner_user_id', userId).order('created_at', { ascending: false }),
    ]);

    if (patientResult.error || !patientResult.data) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    return NextResponse.json({
      patient: patientResult.data,
      visits: visitsResult.data || [],
      claims: claimsResult.data || [],
      referrals: referralsResult.data || [],
      payments: paymentsResult.data || [],
      templates: templatesResult.data || [],
      clientDocs: clientDocsResult.data || [],
      intakeForms: intakeFormsResult.data || [],
      intakeLinks: intakeLinksResult.data || [],
      intakeResponses: intakeResponsesResult.data || [],
      benefits: benefitsResult.data || null,
      consentLinks: consentLinksResult.data || [],
      userId,
    });
  } catch (error) {
    console.error('Error in patient detail API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
