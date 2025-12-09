import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

// GET: Fetch questionnaire for a practitioner (admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    if (!adminEmails.includes(user.email || '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use service role for querying
    const adminClient = createServiceRoleClient();

    const { data: questionnaire, error } = await adminClient
      .from('onboarding_questionnaires')
      .select('*')
      .eq('practitioner_id', id)
      .single();

    if (error) {
      console.error('Error fetching questionnaire:', error);
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(questionnaire);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Generate new questionnaire token (admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    // Verify admin access
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()) || [];
    if (!adminEmails.includes(user.email || '')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use service role for updating
    const adminClient = createServiceRoleClient();

    // Check if questionnaire exists
    const { data: existing, error: fetchError } = await adminClient
      .from('onboarding_questionnaires')
      .select('id')
      .eq('practitioner_id', id)
      .single();

    if (fetchError || !existing) {
      // Create a new questionnaire if one doesn't exist
      const { data: newQuestionnaire, error: createError } = await adminClient
        .from('onboarding_questionnaires')
        .insert({ practitioner_id: id })
        .select()
        .single();

      if (createError) {
        console.error('Error creating questionnaire:', createError);
        return NextResponse.json(
          { error: 'Failed to create questionnaire' },
          { status: 500 }
        );
      }

      // Update practitioner status
      await adminClient
        .from('practitioners')
        .update({
          onboarding_status: 'questionnaire_sent',
          onboarding_checklist: {
            questionnaire_sent: true,
            questionnaire_received: false,
            practice_configured: false,
            services_added: false,
            intake_form_created: false,
            client_list_imported: false,
            welcome_email_sent: false,
          },
        })
        .eq('id', id);

      return NextResponse.json({
        success: true,
        token: newQuestionnaire.token,
        message: 'Questionnaire created',
      });
    }

    // Generate new token for existing questionnaire (only if not submitted)
    const { data: questionnaire, error: updateError } = await adminClient
      .from('onboarding_questionnaires')
      .update({
        token: crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''),
        updated_at: new Date().toISOString(),
      })
      .eq('practitioner_id', id)
      .is('submitted_at', null)
      .select()
      .single();

    if (updateError) {
      // If the questionnaire was already submitted, we can't regenerate the token
      return NextResponse.json(
        { error: 'Cannot regenerate token for submitted questionnaire' },
        { status: 400 }
      );
    }

    // Update practitioner status
    await adminClient
      .from('practitioners')
      .update({
        onboarding_status: 'questionnaire_sent',
        onboarding_checklist: {
          questionnaire_sent: true,
          questionnaire_received: false,
          practice_configured: false,
          services_added: false,
          intake_form_created: false,
          client_list_imported: false,
          welcome_email_sent: false,
        },
      })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      token: questionnaire.token,
      message: 'New token generated',
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
