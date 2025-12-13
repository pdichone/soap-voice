import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export interface FeatureFlags {
  feature_claims_tracking: boolean;
  feature_year_end_summary: boolean;
  feature_insurance_calculator: boolean;
  feature_bulk_operations: boolean;
  feature_intake_forms: boolean;
  feature_documents: boolean;
  feature_referrals: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  feature_claims_tracking: true,
  feature_year_end_summary: true,
  feature_insurance_calculator: false,
  feature_bulk_operations: false,
  feature_intake_forms: true,
  feature_documents: true,
  feature_referrals: true,
};

// GET /api/feature-flags
export async function GET() {
  try {
    // Get the authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to fetch from practitioners table (bypasses RLS)
    const serviceClient = createServiceRoleClient();
    const { data: practitioner, error: practitionerError } = await serviceClient
      .from('practitioners')
      .select('feature_claims_tracking, feature_year_end_summary, feature_insurance_calculator, feature_bulk_operations, feature_intake_forms, feature_documents, feature_referrals')
      .eq('user_id', user.id)
      .single();

    if (practitionerError || !practitioner) {
      // If no practitioner record exists, return defaults
      // This allows the system to work before admin sets up the practitioner
      return NextResponse.json(DEFAULT_FLAGS);
    }

    const flags: FeatureFlags = {
      feature_claims_tracking: practitioner.feature_claims_tracking ?? true,
      feature_year_end_summary: practitioner.feature_year_end_summary ?? true,
      feature_insurance_calculator: practitioner.feature_insurance_calculator ?? false,
      feature_bulk_operations: practitioner.feature_bulk_operations ?? false,
      feature_intake_forms: practitioner.feature_intake_forms ?? true,
      feature_documents: practitioner.feature_documents ?? true,
      feature_referrals: practitioner.feature_referrals ?? true,
    };

    return NextResponse.json(flags);
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    // Return defaults on error to avoid breaking the app
    return NextResponse.json(DEFAULT_FLAGS);
  }
}
