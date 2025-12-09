import { createServiceRoleClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import type { OnboardingQuestionnaire, OnboardingQuestionnaireFormData } from '@/lib/types-onboarding';

// GET: Fetch questionnaire by token (public)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createServiceRoleClient();

    // Get questionnaire with practitioner name
    const { data: questionnaire, error } = await supabase
      .from('onboarding_questionnaires')
      .select(`
        *,
        practitioners!inner(name)
      `)
      .eq('token', token)
      .single();

    if (error || !questionnaire) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    const response = {
      questionnaire: {
        id: questionnaire.id,
        practitioner_id: questionnaire.practitioner_id,
        token: questionnaire.token,
        practice_name: questionnaire.practice_name,
        practice_type: questionnaire.practice_type,
        specialties: questionnaire.specialties || [],
        services: questionnaire.services || [],
        insurance_portals: questionnaire.insurance_portals || [],
        insurance_payers: questionnaire.insurance_payers || [],
        intake_preferences: questionnaire.intake_preferences,
        address: questionnaire.address,
        timezone: questionnaire.timezone,
        additional_notes: questionnaire.additional_notes,
        client_list_file_url: questionnaire.client_list_file_url,
        client_list_file_name: questionnaire.client_list_file_name,
        client_list_confirmed: questionnaire.client_list_confirmed,
        submitted_at: questionnaire.submitted_at,
        created_at: questionnaire.created_at,
        updated_at: questionnaire.updated_at,
      } as OnboardingQuestionnaire,
      practitioner_name: questionnaire.practitioners?.name || 'Unknown',
      already_submitted: !!questionnaire.submitted_at,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching questionnaire:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Submit questionnaire responses (public)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = createServiceRoleClient();
    const body: OnboardingQuestionnaireFormData = await request.json();

    // Verify token exists and not already submitted
    const { data: existing, error: fetchError } = await supabase
      .from('onboarding_questionnaires')
      .select('id, practitioner_id, submitted_at')
      .eq('token', token)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    if (existing.submitted_at) {
      return NextResponse.json(
        { error: 'Questionnaire has already been submitted' },
        { status: 400 }
      );
    }

    // Update questionnaire with responses
    const { error: updateError } = await supabase
      .from('onboarding_questionnaires')
      .update({
        practice_name: body.practice_name,
        practice_type: body.practice_type,
        specialties: body.specialties,
        services: body.services,
        insurance_portals: body.insurance_portals,
        insurance_payers: body.insurance_payers,
        intake_preferences: body.intake_preferences,
        address: body.address,
        timezone: body.timezone,
        additional_notes: body.additional_notes,
        client_list_file_url: body.client_list_file_url,
        client_list_file_name: body.client_list_file_name,
        client_list_confirmed: body.client_list_confirmed,
        submitted_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (updateError) {
      console.error('Error updating questionnaire:', updateError);
      return NextResponse.json(
        { error: 'Failed to submit questionnaire' },
        { status: 500 }
      );
    }

    // Update practitioner status and checklist
    const { error: practitionerError } = await supabase
      .from('practitioners')
      .update({
        onboarding_status: 'questionnaire_received',
        onboarding_checklist: {
          questionnaire_sent: true,
          questionnaire_received: true,
          practice_configured: false,
          services_added: false,
          intake_form_created: false,
          client_list_imported: false,
          welcome_email_sent: false,
        },
      })
      .eq('id', existing.practitioner_id);

    if (practitionerError) {
      console.error('Error updating practitioner:', practitionerError);
      // Don't fail the request - questionnaire was saved
    }

    return NextResponse.json({
      success: true,
      message: 'Questionnaire submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting questionnaire:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
