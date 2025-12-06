import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import {
  getAllPractitioners,
  createPractitioner,
  logAdminEvent,
} from '@/lib/db/admin-queries';
import type { PractitionerCreateInput } from '@/lib/types-ops';

// GET /api/admin/practitioners
export async function GET(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'active' | 'inactive' | 'suspended' | 'pending' | undefined;
    const planType = searchParams.get('planType') as 'trial' | 'solo' | 'professional' | 'enterprise' | 'founder' | 'custom' | undefined;
    const billingStatus = searchParams.get('billingStatus') as 'trial' | 'paying' | 'overdue' | 'cancelled' | 'comped' | undefined;
    const search = searchParams.get('search') || undefined;

    const practitioners = await getAllPractitioners({
      status,
      planType,
      billingStatus,
      search,
    });

    return NextResponse.json(practitioners);
  } catch (error) {
    console.error('Error fetching practitioners:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practitioners' },
      { status: 500 }
    );
  }
}

// POST /api/admin/practitioners
export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: PractitionerCreateInput = await request.json();

    if (!body.email || !body.name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    const practitioner = await createPractitioner(body, admin.id);

    // Log the event
    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.practitioner_created',
      practitionerId: practitioner.id,
      description: `Created practitioner account for ${practitioner.email}`,
      metadata: {
        plan_type: practitioner.plan_type,
        billing_status: practitioner.billing_status,
      },
    });

    return NextResponse.json(practitioner);
  } catch (error) {
    console.error('Error creating practitioner:', error);
    const message = error instanceof Error ? error.message : 'Failed to create practitioner';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
