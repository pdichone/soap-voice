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

    // Log what we received from questionnaire
    console.log('Questionnaire data:', {
      practice_name: questionnaire.practice_name,
      practice_type: questionnaire.practice_type,
      services: questionnaire.services?.length || 0,
    });

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

    // Check if there's anything to update besides timestamp
    const hasUpdates = Object.keys(practitionerUpdate).length > 1;
    console.log('Update payload:', practitionerUpdate, 'Has updates:', hasUpdates);

    if (!hasUpdates) {
      return NextResponse.json({
        success: true,
        message: 'No settings to apply - questionnaire may not have practice name or type filled in',
        applied: {
          workspace_name: null,
          practice_type: null,
          services_count: questionnaire.services?.length || 0,
        },
        questionnaire_data: {
          practice_name: questionnaire.practice_name,
          practice_type: questionnaire.practice_type,
        }
      });
    }

    // Update practitioner record
    const { data: updateResult, error: updateError } = await adminClient
      .from('practitioners')
      .update(practitionerUpdate)
      .eq('id', id)
      .select();

    console.log('Update result:', updateResult, 'Error:', updateError);

    if (updateError) {
      console.error('Error updating practitioner:', updateError);
      return NextResponse.json(
        { error: `Failed to update practitioner settings: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Also update the practices table if the user has one (for Settings page)
    if (practitioner.user_id) {
      // Find the practice_id from the user's profile
      const { data: profile } = await adminClient
        .from('profiles')
        .select('practice_id')
        .eq('id', practitioner.user_id)
        .single();

      if (profile?.practice_id) {
        // Get current practice settings
        const { data: currentPractice } = await adminClient
          .from('practices')
          .select('settings, practice_type')
          .eq('id', profile.practice_id)
          .single();

        const currentSettings = (currentPractice?.settings || {}) as Record<string, unknown>;

        // Build updated settings
        const updatedSettings: Record<string, unknown> = {
          ...currentSettings,
        };

        if (questionnaire.practice_name) {
          updatedSettings.business_name = questionnaire.practice_name;
        }

        if (questionnaire.address) {
          if (questionnaire.address.street) {
            updatedSettings.address_line1 = questionnaire.address.street;
          }
          if (questionnaire.address.city) {
            updatedSettings.city = questionnaire.address.city;
          }
          if (questionnaire.address.state) {
            updatedSettings.state = questionnaire.address.state;
          }
          if (questionnaire.address.zip) {
            updatedSettings.zip = questionnaire.address.zip;
          }
        }

        // Update practices table
        const practiceUpdate: Record<string, unknown> = {
          settings: updatedSettings,
          updated_at: new Date().toISOString(),
        };

        if (questionnaire.practice_type) {
          practiceUpdate.practice_type = questionnaire.practice_type;
        }

        const { error: practiceError } = await adminClient
          .from('practices')
          .update(practiceUpdate)
          .eq('id', profile.practice_id);

        if (practiceError) {
          console.error('Error updating practice:', practiceError);
          // Don't fail the whole request - practitioner was updated successfully
        } else {
          console.log('Practice updated successfully');
        }
      }
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
        services_count: questionnaire.services?.length || 0,
      },
      updated_record: updateResult?.[0] || null,
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
