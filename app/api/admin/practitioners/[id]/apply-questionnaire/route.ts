import { createServiceRoleClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';

// POST: Apply questionnaire data to practitioner settings
export async function POST(
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

    const adminClient = createServiceRoleClient();

    // Fetch the questionnaire for this practitioner
    const { data: questionnaire, error: fetchError } = await adminClient
      .from('onboarding_questionnaires')
      .select('*')
      .eq('practitioner_id', id)
      .single();

    if (fetchError || !questionnaire) {
      return NextResponse.json(
        { error: 'Questionnaire not found' },
        { status: 404 }
      );
    }

    if (!questionnaire.submitted_at) {
      return NextResponse.json(
        { error: 'Questionnaire has not been submitted yet' },
        { status: 400 }
      );
    }

    // Fetch current practitioner data
    const { data: practitioner, error: practitionerError } = await adminClient
      .from('practitioners')
      .select('user_id, workspace_name, practice_type')
      .eq('id', id)
      .single();

    if (practitionerError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Build update object for practitioner
    const practitionerUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Apply practice name as workspace_name
    if (questionnaire.practice_name) {
      practitionerUpdate.workspace_name = questionnaire.practice_name;
    }

    // Apply practice type
    if (questionnaire.practice_type) {
      practitionerUpdate.practice_type = questionnaire.practice_type;
    }

    // Apply timezone if provided
    if (questionnaire.timezone) {
      practitionerUpdate.timezone = questionnaire.timezone;
    }

    // Update practitioner record
    const { error: updateError } = await adminClient
      .from('practitioners')
      .update(practitionerUpdate)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating practitioner:', updateError);
      return NextResponse.json(
        { error: 'Failed to update practitioner settings' },
        { status: 500 }
      );
    }

    // Update onboarding checklist to mark practice_configured as true
    const { data: currentPractitioner } = await adminClient
      .from('practitioners')
      .select('onboarding_checklist')
      .eq('id', id)
      .single();

    const currentChecklist = (currentPractitioner?.onboarding_checklist as Record<string, boolean>) || {};
    const updatedChecklist = {
      ...currentChecklist,
      practice_configured: true,
      // If services were provided, mark that too
      services_added: questionnaire.services && questionnaire.services.length > 0,
    };

    await adminClient
      .from('practitioners')
      .update({
        onboarding_checklist: updatedChecklist,
        onboarding_status: 'in_progress',
      })
      .eq('id', id);

    // Log admin event
    await logAdminEventInternal(adminClient, {
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.questionnaire_applied',
      practitionerId: id,
      description: `Applied questionnaire settings: practice_name=${questionnaire.practice_name}, practice_type=${questionnaire.practice_type}`,
      metadata: {
        practice_name: questionnaire.practice_name,
        practice_type: questionnaire.practice_type,
        services_count: questionnaire.services?.length || 0,
        timezone: questionnaire.timezone,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Questionnaire settings applied successfully',
      applied: {
        workspace_name: questionnaire.practice_name,
        practice_type: questionnaire.practice_type,
        timezone: questionnaire.timezone,
        services_count: questionnaire.services?.length || 0,
      },
    });
  } catch (error) {
    console.error('Error applying questionnaire:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Internal helper to log admin events (duplicated to avoid import issues)
async function logAdminEventInternal(
  supabase: ReturnType<typeof createServiceRoleClient>,
  event: {
    actorType: string;
    actorId: string;
    actorEmail: string;
    eventType: string;
    practitionerId?: string;
    description: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await supabase.from('admin_events').insert({
      actor_type: event.actorType,
      actor_id: event.actorId,
      actor_email: event.actorEmail,
      event_type: event.eventType,
      practitioner_id: event.practitionerId,
      description: event.description,
      metadata: event.metadata,
    });
  } catch (err) {
    console.error('Failed to log admin event:', err);
  }
}
