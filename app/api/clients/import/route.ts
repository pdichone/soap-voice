import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface CSVClient {
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile?: string;
  cell?: string;
  email?: string;
  notes?: string;
  comments?: string;
  preferences?: string;
}

function parseCSV(text: string): CSVClient[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header row - normalize to lowercase and trim
  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '_')
  );

  const clients: CSVClient[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted values with commas inside
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const client: CSVClient = {};
    headers.forEach((header, index) => {
      const value = values[index]?.replace(/^["']|["']$/g, '').trim();
      if (value) {
        (client as Record<string, string>)[header] = value;
      }
    });

    clients.push(client);
  }

  return clients;
}

interface NormalizedClient {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
}

function normalizeClient(csv: CSVClient): NormalizedClient | null {
  // Build name from various possible fields
  let name = csv.name || '';
  if (!name && (csv.first_name || csv.last_name)) {
    name = [csv.first_name, csv.last_name].filter(Boolean).join(' ');
  }

  if (!name.trim()) return null;

  // Get phone from various possible fields
  const phone = csv.phone || csv.mobile || csv.cell || null;

  // Get email
  const email = csv.email || null;

  // Combine notes fields
  const noteParts = [csv.notes, csv.comments, csv.preferences].filter(Boolean);
  const notes = noteParts.length > 0 ? noteParts.join('\n') : null;

  return { name: name.trim(), phone, email, notes };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }

    const text = await file.text();
    const csvClients = parseCSV(text);

    if (csvClients.length === 0) {
      return NextResponse.json({ error: 'No valid clients found in CSV' }, { status: 400 });
    }

    // Get authenticated user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Normalize and filter valid clients
    const normalizedClients = csvClients
      .map(normalizeClient)
      .filter((c): c is NormalizedClient => c !== null);

    if (normalizedClients.length === 0) {
      return NextResponse.json({ error: 'No valid clients found. Ensure CSV has name or first_name/last_name columns.' }, { status: 400 });
    }

    // Insert clients
    const clientsToInsert = normalizedClients.map(c => ({
      therapist_id: user.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
    }));

    const { data: insertedClients, error } = await supabase
      .from('clients')
      .insert(clientsToInsert)
      .select();

    if (error) {
      console.error('Import error:', error);
      return NextResponse.json({ error: 'Failed to import clients' }, { status: 500 });
    }

    return NextResponse.json({
      imported: insertedClients?.length || 0,
      message: `Successfully imported ${insertedClients?.length || 0} clients`
    });

  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json({ error: 'Failed to process CSV' }, { status: 500 });
  }
}
