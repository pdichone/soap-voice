import { createServiceRoleClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';

// Admin-only endpoint to reset all data for testing
// WARNING: This deletes ALL data from the database
export async function DELETE(request: Request) {
  try {
    // Verify admin access using cookie-based auth
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require confirmation phrase in body
    const body = await request.json();
    if (body.confirmation !== 'DELETE ALL DATA') {
      return NextResponse.json({
        error: 'Invalid confirmation. Send { "confirmation": "DELETE ALL DATA" }'
      }, { status: 400 });
    }

    // Use service role client to bypass RLS for deletion
    const adminClient = createServiceRoleClient();

    // Delete all data in order (respecting foreign keys)
    const tables = [
      'consent_links',
      'intake_responses',
      'intake_links',
      'client_documents',
      'patient_benefits',
      'payments_non_phi',
      'claims_non_phi',
      'visits_non_phi',
      'referrals_non_phi',
      'patients_non_phi',
      'document_templates',
      'intake_forms',
      'practice_config',
      'feature_flags',
      'practitioners',
      'profiles',
    ];

    const results: { table: string; deleted: number; error?: string }[] = [];

    for (const table of tables) {
      try {
        // Delete all rows from each table using service role to bypass RLS
        const { error, count } = await adminClient
          .from(table)
          .delete({ count: 'exact' })
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (can't use * so we use a condition that matches all)

        if (error) {
          results.push({ table, deleted: 0, error: error.message });
        } else {
          results.push({ table, deleted: count || 0 });
        }
      } catch (err) {
        results.push({ table, deleted: 0, error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'All data has been deleted. Auth users must be deleted manually from Supabase Dashboard.',
      results,
      note: 'Go to Supabase Dashboard → Authentication → Users to delete auth users',
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Failed to reset data' }, { status: 500 });
  }
}
