import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, getAdminUser } from '@/lib/admin-auth';
import { logAdminEvent } from '@/lib/db/admin-queries';

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Demo patient data - realistic massage therapy scenarios
// Only include columns that exist in the patients_non_phi table
// Names are de-identified (First L. format) and marked with "(Demo)" to clearly identify test data
const DEMO_PATIENTS = [
  {
    display_name: 'Sarah J. (Demo)',
    default_copay_amount: 25,
    is_active: true,
  },
  {
    display_name: 'Michael C. (Demo)',
    default_copay_amount: 30,
    is_active: true,
  },
  {
    display_name: 'Emily R. (Demo)',
    default_copay_amount: 20,
    is_active: true,
  },
  {
    display_name: 'James W. (Demo)',
    default_copay_amount: 25,
    is_active: true,
  },
];

export async function POST(
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
      .select('id, email, name, user_id, workspace_id')
      .eq('id', id)
      .single();

    if (fetchError || !practitioner) {
      return NextResponse.json(
        { error: 'Practitioner not found' },
        { status: 404 }
      );
    }

    // Check if practitioner has logged in (has user_id)
    if (!practitioner.user_id) {
      return NextResponse.json(
        { error: 'Practitioner must log in first before seeding demo data. Send them a magic link.' },
        { status: 400 }
      );
    }

    const ownerId = practitioner.user_id;

    // Ensure the profile exists (required for foreign key constraint)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', ownerId)
      .single();

    if (!existingProfile) {
      // Create profile for the user
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: ownerId,
          full_name: practitioner.name || practitioner.email?.split('@')[0],
          role: 'PRACTITIONER',
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to create user profile. Please try again.' },
          { status: 500 }
        );
      }
      console.log('Created profile for user:', ownerId);
    }

    // Delete any existing demo patients (those with "(Demo)" in the name)
    // This allows re-seeding without affecting real patient data
    const { error: deleteError } = await supabaseAdmin
      .from('patients_non_phi')
      .delete()
      .eq('owner_user_id', ownerId)
      .like('display_name', '%(Demo)%');

    if (deleteError) {
      console.error('Error deleting existing demo data:', deleteError);
    } else {
      console.log('Cleared existing demo patients for user:', ownerId);
    }

    // Create demo patients
    const createdPatients: { id: string; display_name: string }[] = [];

    for (const patient of DEMO_PATIENTS) {
      const { data: createdPatient, error: patientError } = await supabaseAdmin
        .from('patients_non_phi')
        .insert({
          ...patient,
          owner_user_id: ownerId,
        })
        .select('id, display_name')
        .single();

      if (patientError) {
        console.error('Error creating patient:', patientError);
        continue;
      }

      createdPatients.push(createdPatient);
    }

    // Create visits and referrals for each patient
    const today = new Date();
    let totalVisits = 0;
    let totalReferrals = 0;

    for (let i = 0; i < createdPatients.length; i++) {
      const patient = createdPatients[i];

      // Create a referral for the first 2 patients (insurance patients)
      let referralId: string | null = null;
      if (i < 2) {
        const referralStartDate = new Date(today);
        referralStartDate.setDate(referralStartDate.getDate() - 60);

        const referralEndDate = new Date(today);
        referralEndDate.setDate(referralEndDate.getDate() + 120);

        const { data: referral } = await supabaseAdmin
          .from('referrals_non_phi')
          .insert({
            owner_user_id: ownerId,
            patient_id: patient.id,
            referral_label: i === 0 ? 'Dr. Smith - Low Back Pain' : 'Dr. Williams - Neck Pain',
            referral_start_date: referralStartDate.toISOString().split('T')[0],
            referral_expiration_date: referralEndDate.toISOString().split('T')[0],
            visit_limit_type: 'PER_REFERRAL',
            visit_limit_count: 12,
            notes: 'Medical massage therapy for pain management',
          })
          .select('id')
          .single();

        if (referral) {
          referralId = referral.id;
          totalReferrals++;
        }
      }

      // Create 2-4 visits per patient over the past few weeks
      const visitCount = 2 + Math.floor(Math.random() * 3);

      for (let v = 0; v < visitCount; v++) {
        const visitDate = new Date(today);
        visitDate.setDate(visitDate.getDate() - (v * 7) - Math.floor(Math.random() * 3));

        const { data: visit, error: visitError } = await supabaseAdmin
          .from('visits_non_phi')
          .insert({
            owner_user_id: ownerId,
            patient_id: patient.id,
            referral_id: referralId,
            visit_date: visitDate.toISOString().split('T')[0],
            is_billable_to_insurance: i < 2,
          })
          .select('id')
          .single();

        if (visitError) {
          console.error('Error creating visit:', visitError);
          continue;
        }

        totalVisits++;

        // Create a payment for some visits
        if (v < 2 && visit) {
          const paymentAmount = DEMO_PATIENTS[i].default_copay_amount || 25;

          await supabaseAdmin
            .from('payments_non_phi')
            .insert({
              owner_user_id: ownerId,
              patient_id: patient.id,
              visit_id: visit.id,
              amount: paymentAmount,
              method: v % 2 === 0 ? 'CARD' : 'CASH',
              is_copay: i < 2,
            });
        }
      }
    }

    // Log the admin event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin?.id,
      actorEmail: admin?.email,
      eventType: 'admin.demo_data_seeded',
      practitionerId: practitioner.id,
      description: `Demo data seeded: ${createdPatients.length} patients, ${totalVisits} visits, ${totalReferrals} referrals`,
      metadata: {
        patients_created: createdPatients.length,
        visits_created: totalVisits,
        referrals_created: totalReferrals,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Demo data created successfully`,
      data: {
        patients: createdPatients.length,
        visits: totalVisits,
        referrals: totalReferrals,
      },
    });
  } catch (error) {
    console.error('Error seeding demo data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
