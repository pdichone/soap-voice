import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { getImpersonationContext } from '@/lib/admin-auth';

interface QueryRequest {
  table: string;
  select?: string;
  filters?: Record<string, unknown>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

// Allowed tables for security - only allow querying these tables
const ALLOWED_TABLES = [
  'patients_non_phi',
  'visits_non_phi',
  'payments_non_phi',
  'claims_non_phi',
  'referrals_non_phi',
  'sessions',
  'intake_templates',
  'intake_responses',
  'portals',
  'physicians',
  'profiles',
  'practices',
  'practitioners',
  'practice_users',
  'document_templates',
];

// POST /api/data/query - Query data for effective user
export async function POST(request: Request) {
  try {
    const body: QueryRequest = await request.json();
    const { table, select = '*', filters = {}, order, limit } = body;

    // Security: Only allow querying specific tables
    if (!ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    const impersonation = await getImpersonationContext();
    let userId: string | null = null;
    let useServiceRole = false;

    if (impersonation.isImpersonating && impersonation.practitionerId) {
      // Get practitioner's user_id using service role
      const adminClient = createServiceRoleClient();
      const { data: practitioner } = await adminClient
        .from('practitioners')
        .select('user_id')
        .eq('id', impersonation.practitionerId)
        .single();

      userId = practitioner?.user_id || null;
      useServiceRole = true; // Must use service role to bypass RLS during impersonation

      if (!userId) {
        return NextResponse.json({ data: [] });
      }
    } else {
      // Not impersonating - get real user
      const supabase = await createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      userId = user.id;
    }

    // Choose client based on impersonation status
    const client = useServiceRole ? createServiceRoleClient() : await createServerSupabaseClient();

    // Build query
    let query = client.from(table).select(select);

    // Add owner_user_id filter for tables that have it
    const tablesWithOwnerUserId = [
      'patients_non_phi',
      'visits_non_phi',
      'payments_non_phi',
      'claims_non_phi',
      'referrals_non_phi',
      'sessions',
      'intake_templates',
      'portals',
      'document_templates',
    ];

    if (tablesWithOwnerUserId.includes(table)) {
      query = query.eq('owner_user_id', userId);
    }

    // Add custom filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === null) {
        query = query.is(key, null);
      } else if (typeof value === 'object' && value !== null) {
        const filterObj = value as Record<string, unknown>;
        if ('not' in filterObj && filterObj.not === null) {
          query = query.not(key, 'is', null);
        } else if ('eq' in filterObj) {
          query = query.eq(key, filterObj.eq);
        } else if ('neq' in filterObj) {
          query = query.neq(key, filterObj.neq);
        } else if ('gt' in filterObj) {
          query = query.gt(key, filterObj.gt);
        } else if ('gte' in filterObj) {
          query = query.gte(key, filterObj.gte);
        } else if ('lt' in filterObj) {
          query = query.lt(key, filterObj.lt);
        } else if ('lte' in filterObj) {
          query = query.lte(key, filterObj.lte);
        } else if ('in' in filterObj) {
          query = query.in(key, filterObj.in as unknown[]);
        } else if ('ilike' in filterObj) {
          query = query.ilike(key, filterObj.ilike as string);
        }
      } else {
        query = query.eq(key, value);
      }
    }

    // Add ordering
    if (order) {
      query = query.order(order.column, { ascending: order.ascending ?? true });
    }

    // Add limit
    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error in query API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
