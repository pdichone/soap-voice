import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, getAdminUser } from '@/lib/admin-auth';
import { logAdminEvent } from '@/lib/db/admin-queries';

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    await requireAdmin();
    const admin = await getAdminUser();

    const { id } = await params;

    // Get practitioner details
    const { data: practitioner, error: fetchError } = await supabaseAdmin
      .from('practitioners')
      .select('id, email, name, user_id')
      .eq('id', id)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    if (!practitioner.user_id) {
      return NextResponse.json(
        { error: 'Practitioner has not logged in yet' },
        { status: 400 }
      );
    }

    const ownerId = practitioner.user_id;

    // Count demo patients before deletion
    const { count: demoPatientCount } = await supabaseAdmin
      .from('patients_non_phi')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', ownerId)
      .like('display_name', '%(Demo)%');

    if (!demoPatientCount || demoPatientCount === 0) {
      return NextResponse.json(
        { error: 'No demo data found to delete' },
        { status: 400 }
      );
    }

    // Delete demo patients (cascades to visits, payments, referrals due to ON DELETE CASCADE)
    const { error: deleteError } = await supabaseAdmin
      .from('patients_non_phi')
      .delete()
      .eq('owner_user_id', ownerId)
      .like('display_name', '%(Demo)%');

    if (deleteError) {
      console.error('Error deleting demo data:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete demo data' },
        { status: 500 }
      );
    }

    // Log the admin event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin?.id,
      actorEmail: admin?.email,
      eventType: 'admin.demo_data_deleted',
      practitionerId: practitioner.id,
      description: `Demo data deleted: ${demoPatientCount} patients removed`,
      metadata: {
        patients_deleted: demoPatientCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Demo data deleted successfully`,
      data: {
        patients_deleted: demoPatientCount,
      },
    });
  } catch (error) {
    console.error('Error deleting demo data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
