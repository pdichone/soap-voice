import { createServiceRoleClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import type { OnboardingUpdateInput } from '@/lib/types-onboarding';

// PUT: Update practitioner onboarding (admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify admin access using cookie-based auth
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: OnboardingUpdateInput = await request.json();

    // Use service role for updating
    const adminClient = createServiceRoleClient();

    const { error } = await adminClient
      .from('practitioners')
      .update({
        onboarding_status: body.onboarding_status,
        onboarding_notes: body.onboarding_notes,
        onboarding_started_at: body.onboarding_started_at,
        onboarding_completed_at: body.onboarding_completed_at,
        onboarding_checklist: body.onboarding_checklist,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating onboarding:', error);
      return NextResponse.json(
        { error: 'Failed to update onboarding' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
