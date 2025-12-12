import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';

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

// POST /api/data/payments - Log a payment
export async function POST(request: Request) {
  try {
    const { userId, client } = await getEffectiveUserAndClient();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { patient_id, visit_id, amount, method, is_copay } = body;

    const { data: paymentData, error } = await client.from('payments_non_phi').insert({
      owner_user_id: userId,
      patient_id,
      visit_id: visit_id || null,
      amount: parseFloat(amount),
      method,
      is_copay,
    }).select().single();

    if (error) {
      console.error('Error creating payment:', error);
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    return NextResponse.json({ payment: paymentData });
  } catch (error) {
    console.error('Error in create payment API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
