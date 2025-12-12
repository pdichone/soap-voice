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

// POST /api/data/patients/[id]/actions - Perform actions on patient
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const patientId = params.id;
    const body = await request.json();
    const { action, data } = body;

    const { userId, client } = await getEffectiveUserAndClient();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    switch (action) {
      case 'archive': {
        const { error } = await client
          .from('patients_non_phi')
          .update({ is_active: false })
          .eq('id', patientId)
          .eq('owner_user_id', userId);

        if (error) {
          console.error('Error archiving patient:', error);
          return NextResponse.json({ error: 'Failed to archive patient' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      case 'restore': {
        const { error } = await client
          .from('patients_non_phi')
          .update({ is_active: true })
          .eq('id', patientId)
          .eq('owner_user_id', userId);

        if (error) {
          console.error('Error restoring patient:', error);
          return NextResponse.json({ error: 'Failed to restore patient' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      case 'logPayment': {
        const { amount, method, is_copay } = data;
        const { error } = await client.from('payments_non_phi').insert({
          owner_user_id: userId,
          patient_id: patientId,
          amount: parseFloat(amount),
          method,
          is_copay,
        });

        if (error) {
          console.error('Error logging payment:', error);
          return NextResponse.json({ error: 'Failed to log payment' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      case 'signDocument': {
        const { templateId, clientDocId } = data;

        if (clientDocId) {
          // Update existing
          const { error } = await client
            .from('client_documents')
            .update({
              status: 'SIGNED',
              signed_at: new Date().toISOString(),
              signature_data: 'Acknowledged',
            })
            .eq('id', clientDocId);

          if (error) {
            console.error('Error updating document:', error);
            return NextResponse.json({ error: 'Failed to sign document' }, { status: 500 });
          }
        } else {
          // Create new
          const { error } = await client.from('client_documents').insert({
            owner_user_id: userId,
            patient_id: patientId,
            template_id: templateId,
            status: 'SIGNED',
            signed_at: new Date().toISOString(),
            signature_data: 'Acknowledged',
          });

          if (error) {
            console.error('Error signing document:', error);
            return NextResponse.json({ error: 'Failed to sign document' }, { status: 500 });
          }
        }
        return NextResponse.json({ success: true });
      }

      case 'createIntakeLink': {
        const { formId, token, expiresAt } = data;

        const { error } = await client.from('intake_links').insert({
          token,
          form_id: formId,
          patient_id: patientId,
          owner_user_id: userId,
          expires_at: expiresAt,
        });

        if (error) {
          console.error('Error creating intake link:', error);
          return NextResponse.json({ error: 'Failed to create intake link' }, { status: 500 });
        }
        return NextResponse.json({ success: true });
      }

      case 'createConsentLink': {
        const { templateId, token, expiresAt } = data;

        const { data: newLink, error } = await client.from('consent_links').insert({
          token,
          template_id: templateId,
          patient_id: patientId,
          owner_user_id: userId,
          expires_at: expiresAt,
        }).select().single();

        if (error) {
          console.error('Error creating consent link:', error);
          return NextResponse.json({ error: 'Failed to create consent link' }, { status: 500 });
        }
        return NextResponse.json({ success: true, link: newLink });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in patient action API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
