// =============================================
// ADMIN DATABASE QUERIES
// Database operations for Super Admin portal
// =============================================

import { createServiceRoleClient } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/admin-auth';
import type {
  Practitioner,
  PractitionerWithStats,
  PractitionerCreateInput,
  PractitionerUpdateInput,
  AdminEvent,
  AdminEventWithPractitioner,
  ImpersonationSession,
  PractitionerStatus,
  PractitionerPlanType,
  BillingStatus,
} from '@/lib/types-ops';
import type { OnboardingQuestionnaire, OnboardingUpdateInput, OnboardingStatus } from '@/lib/types-onboarding';

// =============================================
// PRACTITIONERS
// =============================================

export async function getAllPractitioners(filters?: {
  status?: PractitionerStatus;
  planType?: PractitionerPlanType;
  billingStatus?: BillingStatus;
  onboardingStatus?: OnboardingStatus;
  search?: string;
}): Promise<PractitionerWithStats[]> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  // Use the practitioner_stats view for stats
  let query = supabase
    .from('practitioner_stats')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.planType) {
    query = query.eq('plan_type', filters.planType);
  }

  if (filters?.billingStatus) {
    query = query.eq('billing_status', filters.billingStatus);
  }

  if (filters?.onboardingStatus) {
    if (filters.onboardingStatus === 'not_started') {
      // Handle null as 'not_started'
      query = query.or('onboarding_status.is.null,onboarding_status.eq.not_started');
    } else {
      query = query.eq('onboarding_status', filters.onboardingStatus);
    }
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching practitioners:', error);
    throw new Error('Failed to fetch practitioners');
  }

  return (data || []) as PractitionerWithStats[];
}

export async function getPractitionerById(id: string): Promise<PractitionerWithStats | null> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('practitioner_stats')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching practitioner:', error);
    throw new Error('Failed to fetch practitioner');
  }

  return data as PractitionerWithStats;
}

export async function getPractitionerByWorkspaceId(
  workspaceId: string
): Promise<Practitioner | null> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('practitioners')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching practitioner by workspace:', error);
    throw new Error('Failed to fetch practitioner');
  }

  return data as Practitioner;
}

export async function createPractitioner(
  input: PractitionerCreateInput,
  adminId: string
): Promise<Practitioner> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  // Calculate trial end date (default 14 days from now)
  const trialEndsAt =
    input.trial_ends_at || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('practitioners')
    .insert({
      email: input.email,
      name: input.name,
      workspace_name: input.workspace_name || `${input.name}'s Practice`,
      plan_type: input.plan_type || 'trial',
      billing_status: input.billing_status || 'trial',
      monthly_price: input.monthly_price,
      trial_ends_at: trialEndsAt,
      billing_notes: input.billing_notes,
      feature_claims_tracking: input.feature_claims_tracking ?? true,
      feature_year_end_summary: input.feature_year_end_summary ?? true,
      feature_insurance_calculator: input.feature_insurance_calculator ?? false,
      feature_bulk_operations: input.feature_bulk_operations ?? false,
      feature_intake_forms: input.feature_intake_forms ?? true,
      feature_documents: input.feature_documents ?? true,
      created_by: adminId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating practitioner:', error);
    if (error.code === '23505') {
      throw new Error('A practitioner with this email already exists');
    }
    throw new Error('Failed to create practitioner');
  }

  return data as Practitioner;
}

export async function updatePractitioner(
  id: string,
  input: PractitionerUpdateInput
): Promise<Practitioner> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('practitioners')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating practitioner:', error);
    throw new Error('Failed to update practitioner');
  }

  return data as Practitioner;
}

export async function deletePractitioner(id: string): Promise<void> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  // Soft delete
  const { error } = await supabase
    .from('practitioners')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'inactive',
    })
    .eq('id', id);

  if (error) {
    console.error('Error deleting practitioner:', error);
    throw new Error('Failed to delete practitioner');
  }
}

export async function linkPractitionerToUser(
  practitionerId: string,
  userId: string
): Promise<void> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('practitioners')
    .update({
      user_id: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', practitionerId);

  if (error) {
    console.error('Error linking practitioner to user:', error);
    throw new Error('Failed to link practitioner to user');
  }
}

// =============================================
// ADMIN EVENTS
// =============================================

export interface LogEventParams {
  actorType: 'admin' | 'practitioner' | 'system';
  actorId?: string;
  actorEmail?: string;
  eventType: string;
  practitionerId?: string;
  workspaceId?: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export async function logAdminEvent(params: LogEventParams): Promise<void> {
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from('admin_events').insert({
    actor_type: params.actorType,
    actor_id: params.actorId,
    actor_email: params.actorEmail,
    event_type: params.eventType,
    event_category: params.eventType.split('.')[0],
    practitioner_id: params.practitionerId,
    workspace_id: params.workspaceId,
    description: params.description,
    metadata: params.metadata || {},
  });

  if (error) {
    console.error('Error logging admin event:', error);
    // Don't throw - logging should not break the flow
  }
}

export async function getAdminEvents(options?: {
  practitionerId?: string;
  eventCategory?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminEventWithPractitioner[]> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  let query = supabase
    .from('admin_events')
    .select(
      `
      *,
      practitioner:practitioners(id, name, email)
    `
    )
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100);

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
  }

  if (options?.practitionerId) {
    query = query.eq('practitioner_id', options.practitionerId);
  }

  if (options?.eventCategory) {
    query = query.eq('event_category', options.eventCategory);
  }

  if (options?.eventType) {
    query = query.eq('event_type', options.eventType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching admin events:', error);
    throw new Error('Failed to fetch admin events');
  }

  return (data || []) as AdminEventWithPractitioner[];
}

export async function getRecentActivityForPractitioner(
  practitionerId: string,
  limit: number = 20
): Promise<AdminEvent[]> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('admin_events')
    .select('*')
    .eq('practitioner_id', practitionerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching practitioner activity:', error);
    throw new Error('Failed to fetch practitioner activity');
  }

  return (data || []) as AdminEvent[];
}

// =============================================
// IMPERSONATION SESSIONS
// =============================================

export async function createImpersonationSession(
  adminId: string,
  practitionerId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<ImpersonationSession> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('impersonation_sessions')
    .insert({
      admin_id: adminId,
      practitioner_id: practitionerId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating impersonation session:', error);
    throw new Error('Failed to create impersonation session');
  }

  return data as ImpersonationSession;
}

export async function endImpersonationSession(sessionId: string): Promise<void> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('impersonation_sessions')
    .update({
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error ending impersonation session:', error);
    throw new Error('Failed to end impersonation session');
  }
}

export async function getActiveImpersonationSessions(): Promise<ImpersonationSession[]> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('impersonation_sessions')
    .select('*')
    .is('ended_at', null)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching active impersonation sessions:', error);
    throw new Error('Failed to fetch impersonation sessions');
  }

  return (data || []) as ImpersonationSession[];
}

// =============================================
// DASHBOARD STATS
// =============================================

export interface AdminDashboardStats {
  totalPractitioners: number;
  activePractitioners: number;
  trialPractitioners: number;
  payingPractitioners: number;
  recentSignups: number;
  activeThisWeek: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  // Get practitioner counts
  const { data: practitioners } = await supabase
    .from('practitioners')
    .select('status, billing_status, created_at, last_activity_at')
    .is('deleted_at', null);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats: AdminDashboardStats = {
    totalPractitioners: practitioners?.length || 0,
    activePractitioners: practitioners?.filter((p) => p.status === 'active').length || 0,
    trialPractitioners: practitioners?.filter((p) => p.billing_status === 'trial').length || 0,
    payingPractitioners: practitioners?.filter((p) => p.billing_status === 'paying').length || 0,
    recentSignups:
      practitioners?.filter((p) => new Date(p.created_at) > weekAgo).length || 0,
    activeThisWeek:
      practitioners?.filter(
        (p) => p.last_activity_at && new Date(p.last_activity_at) > weekAgo
      ).length || 0,
  };

  return stats;
}

// =============================================
// MAGIC LINK
// =============================================

export async function sendMagicLink(
  practitionerId: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  // Get practitioner email
  const { data: practitioner, error: fetchError } = await supabase
    .from('practitioners')
    .select('email, name')
    .eq('id', practitionerId)
    .single();

  if (fetchError || !practitioner) {
    return { success: false, error: 'Practitioner not found' };
  }

  // Use Supabase admin API to generate magic link
  // Note: This requires the service role key
  const { error: linkError } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: practitioner.email,
  });

  if (linkError) {
    console.error('Error generating magic link:', linkError);
    return { success: false, error: 'Failed to send magic link' };
  }

  // Log the event
  await logAdminEvent({
    actorType: 'admin',
    actorId: adminId,
    eventType: 'admin.magic_link_sent',
    practitionerId,
    description: `Magic link sent to ${practitioner.email}`,
  });

  return { success: true };
}

// =============================================
// ONBOARDING
// =============================================

export async function getQuestionnaireByPractitionerId(
  practitionerId: string
): Promise<OnboardingQuestionnaire | null> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('onboarding_questionnaires')
    .select('*')
    .eq('practitioner_id', practitionerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching questionnaire:', error);
    throw new Error('Failed to fetch questionnaire');
  }

  return data as OnboardingQuestionnaire;
}

export async function updatePractitionerOnboarding(
  practitionerId: string,
  input: OnboardingUpdateInput
): Promise<void> {
  await requireAdmin();

  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('practitioners')
    .update({
      onboarding_status: input.onboarding_status,
      onboarding_notes: input.onboarding_notes,
      onboarding_started_at: input.onboarding_started_at,
      onboarding_completed_at: input.onboarding_completed_at,
      onboarding_checklist: input.onboarding_checklist,
      updated_at: new Date().toISOString(),
    })
    .eq('id', practitionerId);

  if (error) {
    console.error('Error updating practitioner onboarding:', error);
    throw new Error('Failed to update practitioner onboarding');
  }
}
