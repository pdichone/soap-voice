import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin-auth';
import {
  getPractitionerById,
  updatePractitioner,
  logAdminEvent,
} from '@/lib/db/admin-queries';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/admin/practitioners/[id]
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const practitioner = await getPractitionerById(id);

    if (!practitioner) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 });
    }

    return NextResponse.json(practitioner);
  } catch (error) {
    console.error('Error fetching practitioner:', error);
    return NextResponse.json(
      { error: 'Failed to fetch practitioner' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/practitioners/[id]
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get the current practitioner to compare changes
    const currentPractitioner = await getPractitionerById(id);
    if (!currentPractitioner) {
      return NextResponse.json({ error: 'Practitioner not found' }, { status: 404 });
    }

    // Update the practitioner
    const updatedPractitioner = await updatePractitioner(id, body);

    // Log what changed
    const changedFields: string[] = [];
    Object.keys(body).forEach((key) => {
      const currentValue = currentPractitioner[key as keyof typeof currentPractitioner];
      const newValue = body[key];
      if (currentValue !== newValue) {
        changedFields.push(key);
      }
    });

    await logAdminEvent({
      actorType: 'admin',
      actorId: admin.id,
      actorEmail: admin.email,
      eventType: 'admin.practitioner_updated',
      practitionerId: id,
      description: `Updated practitioner: ${changedFields.join(', ')}`,
      metadata: {
        changes: body,
        previous: Object.fromEntries(
          changedFields.map((key) => [
            key,
            currentPractitioner[key as keyof typeof currentPractitioner],
          ])
        ),
      },
    });

    return NextResponse.json(updatedPractitioner);
  } catch (error) {
    console.error('Error updating practitioner:', error);
    const message = error instanceof Error ? error.message : 'Failed to update practitioner';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
