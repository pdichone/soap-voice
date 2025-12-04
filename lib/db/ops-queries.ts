import { createServerSupabaseClient } from '@/lib/supabase-server';
import type {
  PatientNonPhi,
  PatientWithStats,
  ReferralNonPhi,
  VisitNonPhi,
  PaymentNonPhi,
  ClaimNonPhi,
  ClaimWithPatient,
  DashboardSummary,
  Profile,
  Practice,
  PracticeType,
  EarningsSummary,
  WeeklyEarning,
  MonthlyEarning,
  YearlyEarning,
  PaymentExport,
  PaymentMethodBreakdown,
  PatientBenefits,
} from '@/lib/types-ops';
import { getCollectAmount } from '@/lib/benefits-calculator';

// =============================================
// TIMEZONE HELPERS
// =============================================

/**
 * Get the current date string in the user's timezone
 * Falls back to America/Los_Angeles if no timezone is set
 */
function getDateInTimezone(timezone: string = 'America/Los_Angeles'): string {
  const now = new Date();
  // Format as YYYY-MM-DD in the specified timezone
  return now.toLocaleDateString('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD format
}

/**
 * Get the start of today (midnight) as an ISO string in the user's timezone
 */
function getStartOfTodayInTimezone(timezone: string = 'America/Los_Angeles'): string {
  const dateStr = getDateInTimezone(timezone);
  // Create a date at midnight in the specified timezone
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toISOString();
}

/**
 * Get the start of the week (Sunday midnight) in the user's timezone
 */
function getStartOfWeekInTimezone(timezone: string = 'America/Los_Angeles'): { date: string; iso: string } {
  const todayStr = getDateInTimezone(timezone);
  const today = new Date(`${todayStr}T12:00:00`); // Use noon to avoid DST issues
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  const dateStr = startOfWeek.toISOString().split('T')[0];
  return {
    date: dateStr,
    iso: new Date(`${dateStr}T00:00:00`).toISOString(),
  };
}

// =============================================
// PROFILE QUERIES
// =============================================

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return data;
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  return data;
}

// =============================================
// PRACTICE CONFIG QUERIES
// =============================================

interface PracticeFeatures {
  showClaims: boolean;
  showReferrals: boolean;
  showInsuranceFields: boolean;
  showSupervisorApproval: boolean;
  showStudentManagement: boolean;
  patientLabel: string;
  patientLabelPlural: string;
  visitLabel: string;
  visitLabelPlural: string;
}

const PRACTICE_FEATURES: Record<PracticeType, PracticeFeatures> = {
  cash_only: {
    showClaims: false,
    showReferrals: false,
    showInsuranceFields: false,
    showSupervisorApproval: false,
    showStudentManagement: false,
    patientLabel: 'Client',
    patientLabelPlural: 'Clients',
    visitLabel: 'Session',
    visitLabelPlural: 'Sessions',
  },
  insurance: {
    showClaims: true,
    showReferrals: true,
    showInsuranceFields: true,
    showSupervisorApproval: false,
    showStudentManagement: false,
    patientLabel: 'Patient',
    patientLabelPlural: 'Patients',
    visitLabel: 'Visit',
    visitLabelPlural: 'Visits',
  },
  school: {
    showClaims: false,
    showReferrals: false,
    showInsuranceFields: false,
    showSupervisorApproval: true,
    showStudentManagement: true,
    patientLabel: 'Client',
    patientLabelPlural: 'Clients',
    visitLabel: 'Session',
    visitLabelPlural: 'Sessions',
  },
};

export interface PracticeConfig {
  practice: Practice | null;
  practiceType: PracticeType;
  features: PracticeFeatures;
}

export async function getPracticeConfig(): Promise<PracticeConfig> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Default config for insurance practice type
  const defaultConfig: PracticeConfig = {
    practice: null,
    practiceType: 'insurance',
    features: PRACTICE_FEATURES['insurance'],
  };

  if (!user) return defaultConfig;

  // Get user's profile to find their practice_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('practice_id')
    .eq('id', user.id)
    .single();

  if (!profile?.practice_id) return defaultConfig;

  // Fetch the practice details
  const { data: practice } = await supabase
    .from('practices')
    .select('*')
    .eq('id', profile.practice_id)
    .single();

  if (!practice) return defaultConfig;

  const practiceType = practice.practice_type as PracticeType;

  return {
    practice,
    practiceType,
    features: PRACTICE_FEATURES[practiceType],
  };
}

export async function updatePracticeType(practiceId: string, practiceType: PracticeType): Promise<Practice | null> {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from('practices')
    .update({ practice_type: practiceType })
    .eq('id', practiceId)
    .select()
    .single();

  return data;
}

// =============================================
// PATIENT QUERIES
// =============================================

export async function getPatients(activeOnly = true): Promise<PatientNonPhi[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('patients_non_phi')
    .select('*')
    .eq('owner_user_id', user.id)
    .order('display_name');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data } = await query;
  return data || [];
}

export async function getPatientsWithStats(): Promise<PatientWithStats[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get patients with visit counts
  const { data: patients } = await supabase
    .from('patients_non_phi')
    .select(`
      *,
      visits:visits_non_phi(count),
      claims:claims_non_phi(count)
    `)
    .eq('owner_user_id', user.id)
    .eq('is_active', true)
    .order('display_name');

  if (!patients) return [];

  // Get last visit date and pending claims for each patient
  const patientsWithStats: PatientWithStats[] = await Promise.all(
    patients.map(async (patient) => {
      // Get last visit
      const { data: lastVisit } = await supabase
        .from('visits_non_phi')
        .select('visit_date')
        .eq('patient_id', patient.id)
        .order('visit_date', { ascending: false })
        .limit(1)
        .single();

      // Get pending claims count
      const { count: pendingClaims } = await supabase
        .from('claims_non_phi')
        .select('*', { count: 'exact', head: true })
        .eq('patient_id', patient.id)
        .in('status', ['TO_SUBMIT', 'SUBMITTED', 'PENDING']);

      // Get active referral
      const { data: activeReferral } = await supabase
        .from('referrals_non_phi')
        .select('*')
        .eq('patient_id', patient.id)
        .or(`referral_expiration_date.is.null,referral_expiration_date.gte.${new Date().toISOString().split('T')[0]}`)
        .order('referral_start_date', { ascending: false })
        .limit(1)
        .single();

      return {
        ...patient,
        visit_count: (patient.visits as unknown as { count: number }[])?.[0]?.count || 0,
        last_visit_date: lastVisit?.visit_date || undefined,
        pending_claims_count: pendingClaims || 0,
        active_referral: activeReferral || null,
      };
    })
  );

  return patientsWithStats;
}

export async function getPatient(id: string): Promise<PatientWithStats | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: patient } = await supabase
    .from('patients_non_phi')
    .select('*')
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .single();

  if (!patient) return null;

  // Get visit count
  const { count: visitCount } = await supabase
    .from('visits_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', id);

  // Get last visit
  const { data: lastVisit } = await supabase
    .from('visits_non_phi')
    .select('visit_date')
    .eq('patient_id', id)
    .order('visit_date', { ascending: false })
    .limit(1)
    .single();

  // Get pending claims count
  const { count: pendingClaims } = await supabase
    .from('claims_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', id)
    .in('status', ['TO_SUBMIT', 'SUBMITTED', 'PENDING']);

  // Get active referral
  const { data: activeReferral } = await supabase
    .from('referrals_non_phi')
    .select('*')
    .eq('patient_id', id)
    .or(`referral_expiration_date.is.null,referral_expiration_date.gte.${new Date().toISOString().split('T')[0]}`)
    .order('referral_start_date', { ascending: false })
    .limit(1)
    .single();

  return {
    ...patient,
    visit_count: visitCount || 0,
    last_visit_date: lastVisit?.visit_date,
    pending_claims_count: pendingClaims || 0,
    active_referral: activeReferral || null,
  };
}

export async function createPatient(patient: Omit<PatientNonPhi, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>): Promise<PatientNonPhi | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('patients_non_phi')
    .insert({ ...patient, owner_user_id: user.id })
    .select()
    .single();

  return data;
}

// =============================================
// VISIT QUERIES
// =============================================

export async function getVisits(options?: { patientId?: string; limit?: number }): Promise<VisitNonPhi[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('visits_non_phi')
    .select('*, patient:patients_non_phi(id, display_name)')
    .eq('owner_user_id', user.id)
    .order('visit_date', { ascending: false });

  if (options?.patientId) {
    query = query.eq('patient_id', options.patientId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data } = await query;
  return data || [];
}

export async function createVisit(visit: Omit<VisitNonPhi, 'id' | 'owner_user_id' | 'created_at'>): Promise<VisitNonPhi | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('visits_non_phi')
    .insert({ ...visit, owner_user_id: user.id })
    .select()
    .single();

  return data;
}

// =============================================
// CLAIM QUERIES
// =============================================

export async function getClaims(options?: { status?: string; patientId?: string }): Promise<ClaimWithPatient[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('claims_non_phi')
    .select('*, patient:patients_non_phi(id, display_name)')
    .eq('owner_user_id', user.id)
    .order('date_of_service', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.patientId) {
    query = query.eq('patient_id', options.patientId);
  }

  const { data } = await query;
  return data || [];
}

export async function getPendingClaims(): Promise<ClaimWithPatient[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('claims_non_phi')
    .select('*, patient:patients_non_phi(id, display_name)')
    .eq('owner_user_id', user.id)
    .in('status', ['TO_SUBMIT', 'SUBMITTED', 'PENDING'])
    .order('date_of_service', { ascending: true });

  return data || [];
}

export async function createClaim(claim: Omit<ClaimNonPhi, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>): Promise<ClaimNonPhi | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('claims_non_phi')
    .insert({ ...claim, owner_user_id: user.id })
    .select()
    .single();

  return data;
}

export async function updateClaimStatus(id: string, status: string, notes?: string): Promise<ClaimNonPhi | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const updates: Partial<ClaimNonPhi> = { status: status as ClaimNonPhi['status'] };

  if (status === 'SUBMITTED') {
    updates.date_submitted = new Date().toISOString().split('T')[0];
  } else if (status === 'PAID') {
    updates.date_paid = new Date().toISOString().split('T')[0];
  }

  if (notes !== undefined) {
    updates.notes = notes;
  }

  const { data } = await supabase
    .from('claims_non_phi')
    .update(updates)
    .eq('id', id)
    .eq('owner_user_id', user.id)
    .select()
    .single();

  return data;
}

// =============================================
// PAYMENT QUERIES
// =============================================

export async function getPayments(options?: { patientId?: string; startDate?: string; endDate?: string }): Promise<PaymentNonPhi[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('payments_non_phi')
    .select('*, patient:patients_non_phi(id, display_name)')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });

  if (options?.patientId) {
    query = query.eq('patient_id', options.patientId);
  }

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate);
  }

  const { data } = await query;
  return data || [];
}

export async function createPayment(payment: Omit<PaymentNonPhi, 'id' | 'owner_user_id' | 'created_at'>): Promise<PaymentNonPhi | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('payments_non_phi')
    .insert({ ...payment, owner_user_id: user.id })
    .select()
    .single();

  return data;
}

// =============================================
// REFERRAL QUERIES
// =============================================

export async function getReferrals(patientId: string): Promise<ReferralNonPhi[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('referrals_non_phi')
    .select('*')
    .eq('patient_id', patientId)
    .eq('owner_user_id', user.id)
    .order('referral_start_date', { ascending: false });

  return data || [];
}

export async function getExpiringReferrals(daysAhead = 30): Promise<ReferralNonPhi[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date();
  const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from('referrals_non_phi')
    .select('*, patient:patients_non_phi(id, display_name)')
    .eq('owner_user_id', user.id)
    .gte('referral_expiration_date', today.toISOString().split('T')[0])
    .lte('referral_expiration_date', futureDate.toISOString().split('T')[0])
    .order('referral_expiration_date', { ascending: true });

  return data || [];
}

// =============================================
// DASHBOARD QUERIES
// =============================================

export async function getOverdueClaimsCount(thresholdDays = 21): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

  const { count } = await supabase
    .from('claims_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
    .in('status', ['SUBMITTED', 'PENDING'])
    .lte('date_submitted', thresholdDate.toISOString().split('T')[0]);

  return count || 0;
}

export async function getTodaysVisits(): Promise<(VisitNonPhi & { patient?: PatientNonPhi })[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const today = getDateInTimezone(timezone);

  const { data } = await supabase
    .from('visits_non_phi')
    .select('*, patient:patients_non_phi(*)')
    .eq('owner_user_id', user.id)
    .eq('visit_date', today)
    .order('created_at', { ascending: true });

  return data || [];
}

export interface VisitWithCollection extends VisitNonPhi {
  patient?: PatientNonPhi;
  collectAmount: number;
  paidAmount: number | null; // Actual payment made for this visit (null if no payment yet)
}

export async function getTodaysVisitsWithCollections(): Promise<VisitWithCollection[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const today = getDateInTimezone(timezone);

  // Get today's visits with patient info
  const { data: visits } = await supabase
    .from('visits_non_phi')
    .select('*, patient:patients_non_phi(*)')
    .eq('owner_user_id', user.id)
    .eq('visit_date', today)
    .order('created_at', { ascending: true });

  if (!visits || visits.length === 0) return [];

  // Get visit IDs to fetch associated payments
  const visitIds = visits.map(v => v.id);

  // Fetch payments for these visits
  const { data: paymentsData } = await supabase
    .from('payments_non_phi')
    .select('visit_id, amount')
    .in('visit_id', visitIds);

  // Create a map of visit_id to payment amount
  const paymentsMap = new Map<string, number>();
  (paymentsData || []).forEach(p => {
    if (p.visit_id) {
      // Sum payments if there are multiple for the same visit
      const existing = paymentsMap.get(p.visit_id) || 0;
      paymentsMap.set(p.visit_id, existing + p.amount);
    }
  });

  // Get unique patient IDs
  const patientIds = Array.from(new Set(visits.map(v => v.patient_id).filter(Boolean)));

  // Fetch benefits for all patients in one query
  const { data: benefitsData } = await supabase
    .from('patient_benefits')
    .select('*')
    .in('patient_id', patientIds);

  // Create a map of patient_id to benefits
  const benefitsMap = new Map<string, PatientBenefits>();
  (benefitsData || []).forEach(b => benefitsMap.set(b.patient_id, b as PatientBenefits));

  // Calculate collection amount for each visit
  return visits.map(visit => {
    const patient = visit.patient as PatientNonPhi | undefined;
    const benefits = patient ? benefitsMap.get(patient.id) || null : null;
    const paidAmount = paymentsMap.get(visit.id) || null;

    // Calculate collect amount using the benefits calculator
    const collection = patient
      ? getCollectAmount(patient, benefits)
      : { collect_amount: 0 };

    return {
      ...visit,
      patient,
      collectAmount: collection.collect_amount,
      paidAmount,
    };
  });
}

export async function getTodaysPayments(): Promise<(PaymentNonPhi & { patient?: PatientNonPhi })[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const startOfToday = getStartOfTodayInTimezone(timezone);

  const { data } = await supabase
    .from('payments_non_phi')
    .select('*, patient:patients_non_phi(id, display_name)')
    .eq('owner_user_id', user.id)
    .gte('created_at', startOfToday)
    .order('created_at', { ascending: false });

  return data || [];
}

export async function getWeeklyPaymentsSummary(): Promise<{ thisWeek: number; lastWeek: number; byMethod: Record<string, number> }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { thisWeek: 0, lastWeek: 0, byMethod: {} };

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const { iso: startOfThisWeekISO, date: startOfThisWeekDate } = getStartOfWeekInTimezone(timezone);

  // Calculate last week start
  const lastWeekStartDate = new Date(`${startOfThisWeekDate}T12:00:00`);
  lastWeekStartDate.setDate(lastWeekStartDate.getDate() - 7);
  const startOfLastWeekISO = new Date(`${lastWeekStartDate.toISOString().split('T')[0]}T00:00:00`).toISOString();

  // This week's payments
  const { data: thisWeekPayments } = await supabase
    .from('payments_non_phi')
    .select('amount, method')
    .eq('owner_user_id', user.id)
    .gte('created_at', startOfThisWeekISO);

  // Last week's payments
  const { data: lastWeekPayments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', startOfLastWeekISO)
    .lt('created_at', startOfThisWeekISO);

  const thisWeek = thisWeekPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const lastWeek = lastWeekPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  // Group by method
  const byMethod: Record<string, number> = {};
  thisWeekPayments?.forEach(p => {
    const method = p.method || 'OTHER';
    byMethod[method] = (byMethod[method] || 0) + (p.amount || 0);
  });

  return { thisWeek, lastWeek, byMethod };
}

export async function getPatientsNearVisitLimit(): Promise<{ patient: PatientNonPhi; referral: ReferralNonPhi; visitsUsed: number }[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get active referrals with visit limits
  const { data: referrals } = await supabase
    .from('referrals_non_phi')
    .select('*, patient:patients_non_phi(*)')
    .eq('owner_user_id', user.id)
    .not('visit_limit_count', 'is', null)
    .or(`referral_expiration_date.is.null,referral_expiration_date.gte.${new Date().toISOString().split('T')[0]}`);

  if (!referrals) return [];

  const results: { patient: PatientNonPhi; referral: ReferralNonPhi; visitsUsed: number }[] = [];

  for (const referral of referrals) {
    // Count visits linked to this referral
    const { count } = await supabase
      .from('visits_non_phi')
      .select('*', { count: 'exact', head: true })
      .eq('referral_id', referral.id);

    const visitsUsed = count || 0;
    const limitCount = referral.visit_limit_count || 0;

    // Include if at 70% or more of limit
    if (limitCount > 0 && visitsUsed >= limitCount * 0.7) {
      results.push({
        patient: referral.patient as PatientNonPhi,
        referral,
        visitsUsed,
      });
    }
  }

  return results.sort((a, b) => {
    const aPercent = a.visitsUsed / (a.referral.visit_limit_count || 1);
    const bPercent = b.visitsUsed / (b.referral.visit_limit_count || 1);
    return bPercent - aPercent;
  });
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      total_patients: 0,
      active_patients: 0,
      visits_this_week: 0,
      visits_this_month: 0,
      pending_claims_count: 0,
      pending_claims_amount: 0,
      expiring_referrals_count: 0,
      payments_this_month: 0,
    };
  }

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const todayStr = getDateInTimezone(timezone);
  const today = new Date(`${todayStr}T12:00:00`);

  // Calculate start of week in user's timezone
  const { date: startOfWeekDate } = getStartOfWeekInTimezone(timezone);

  // Calculate start of month in user's timezone
  const startOfMonthDate = `${todayStr.substring(0, 7)}-01`; // YYYY-MM-01

  // Calculate 30 days from today
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Get patient counts
  const { count: totalPatients } = await supabase
    .from('patients_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id);

  const { count: activePatients } = await supabase
    .from('patients_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
    .eq('is_active', true);

  // Get visit counts
  const { count: visitsThisWeek } = await supabase
    .from('visits_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
    .gte('visit_date', startOfWeekDate);

  const { count: visitsThisMonth } = await supabase
    .from('visits_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
    .gte('visit_date', startOfMonthDate);

  // Get pending claims
  const { data: pendingClaims } = await supabase
    .from('claims_non_phi')
    .select('billed_amount')
    .eq('owner_user_id', user.id)
    .in('status', ['TO_SUBMIT', 'SUBMITTED', 'PENDING']);

  const pendingClaimsAmount = pendingClaims?.reduce((sum, c) => sum + (c.billed_amount || 0), 0) || 0;

  // Get expiring referrals count
  const thirtyDaysFromNowStr = thirtyDaysFromNow.toISOString().split('T')[0];
  const { count: expiringReferrals } = await supabase
    .from('referrals_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
    .gte('referral_expiration_date', todayStr)
    .lte('referral_expiration_date', thirtyDaysFromNowStr);

  // Get payments this month
  const startOfMonthISO = new Date(`${startOfMonthDate}T00:00:00`).toISOString();
  const { data: paymentsData } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', startOfMonthISO);

  const paymentsThisMonth = paymentsData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  return {
    total_patients: totalPatients || 0,
    active_patients: activePatients || 0,
    visits_this_week: visitsThisWeek || 0,
    visits_this_month: visitsThisMonth || 0,
    pending_claims_count: pendingClaims?.length || 0,
    pending_claims_amount: pendingClaimsAmount,
    expiring_referrals_count: expiringReferrals || 0,
    payments_this_month: paymentsThisMonth,
  };
}

// =============================================
// ENHANCED DASHBOARD QUERIES
// =============================================

export async function getTodaysCopaysExpected(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const today = getDateInTimezone(timezone);

  // Get today's visits with patient copay amounts
  const { data: visits } = await supabase
    .from('visits_non_phi')
    .select('patient:patients_non_phi(default_copay_amount)')
    .eq('owner_user_id', user.id)
    .eq('visit_date', today)
    .eq('is_billable_to_insurance', true);

  if (!visits) return 0;

  return visits.reduce((sum, v) => {
    const copay = (v.patient as { default_copay_amount?: number })?.default_copay_amount || 0;
    return sum + copay;
  }, 0);
}

export async function getTodaysCopaysCollected(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const startOfToday = getStartOfTodayInTimezone(timezone);

  const { data: payments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .eq('is_copay', true)
    .gte('created_at', startOfToday);

  if (!payments) return 0;

  return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
}

export async function getClaimsPaidThisWeek(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const { date: startOfWeekDate } = getStartOfWeekInTimezone(timezone);

  const { count } = await supabase
    .from('claims_non_phi')
    .select('*', { count: 'exact', head: true })
    .eq('owner_user_id', user.id)
    .eq('status', 'PAID')
    .gte('date_paid', startOfWeekDate);

  return count || 0;
}

export async function getInsurancePaymentsThisWeek(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const { date: startOfWeekDate } = getStartOfWeekInTimezone(timezone);

  // Get all paid claims this week - use paid_amount if available, otherwise billed_amount
  const { data } = await supabase
    .from('claims_non_phi')
    .select('paid_amount, billed_amount')
    .eq('owner_user_id', user.id)
    .eq('status', 'PAID')
    .gte('date_paid', startOfWeekDate);

  return data?.reduce((sum, c) => sum + (c.paid_amount ?? c.billed_amount ?? 0), 0) || 0;
}

export async function getReferralAlerts(): Promise<{
  critical: { patient: PatientNonPhi; referral: ReferralNonPhi; visitsUsed: number; reason: string }[];
  warning: { patient: PatientNonPhi; referral: ReferralNonPhi; visitsUsed: number; reason: string }[];
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { critical: [], warning: [] };

  const today = new Date();
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Get active referrals
  const { data: referrals } = await supabase
    .from('referrals_non_phi')
    .select('*, patient:patients_non_phi(*)')
    .eq('owner_user_id', user.id)
    .or(`referral_expiration_date.is.null,referral_expiration_date.gte.${today.toISOString().split('T')[0]}`);

  if (!referrals) return { critical: [], warning: [] };

  const critical: { patient: PatientNonPhi; referral: ReferralNonPhi; visitsUsed: number; reason: string }[] = [];
  const warning: { patient: PatientNonPhi; referral: ReferralNonPhi; visitsUsed: number; reason: string }[] = [];

  for (const referral of referrals) {
    // Count visits for this referral
    const { count } = await supabase
      .from('visits_non_phi')
      .select('*', { count: 'exact', head: true })
      .eq('referral_id', referral.id);

    const visitsUsed = count || 0;
    const limit = referral.visit_limit_count || 0;
    const percentUsed = limit > 0 ? (visitsUsed / limit) * 100 : 0;
    const expirationDate = referral.referral_expiration_date ? new Date(referral.referral_expiration_date) : null;

    let isCritical = false;
    let isWarning = false;
    let reason = '';

    // Check visit limit
    if (limit > 0) {
      if (percentUsed >= 90) {
        isCritical = true;
        reason = `${visitsUsed}/${limit} visits used`;
      } else if (percentUsed >= 70) {
        isWarning = true;
        reason = `${visitsUsed}/${limit} visits used`;
      }
    }

    // Check expiration
    if (expirationDate) {
      if (expirationDate <= sevenDaysFromNow) {
        isCritical = true;
        const daysLeft = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        reason = reason ? `${reason}, expires in ${daysLeft}d` : `Expires in ${daysLeft}d`;
      } else if (expirationDate <= thirtyDaysFromNow && !isCritical) {
        isWarning = true;
        const daysLeft = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        reason = reason ? `${reason}, expires in ${daysLeft}d` : `Expires in ${daysLeft}d`;
      }
    }

    if (isCritical) {
      critical.push({
        patient: referral.patient as PatientNonPhi,
        referral,
        visitsUsed,
        reason,
      });
    } else if (isWarning) {
      warning.push({
        patient: referral.patient as PatientNonPhi,
        referral,
        visitsUsed,
        reason,
      });
    }
  }

  return { critical, warning };
}

// =============================================
// REPORTS & EARNINGS QUERIES
// =============================================

export async function getEarningsSummary(): Promise<EarningsSummary> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { thisWeek: 0, thisMonth: 0, thisYear: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 };
  }

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const todayStr = getDateInTimezone(timezone);

  // This week (Sunday - Saturday)
  const { date: thisWeekStart } = getStartOfWeekInTimezone(timezone);
  const thisWeekStartDate = new Date(`${thisWeekStart}T00:00:00`);

  // Last week
  const lastWeekStartDate = new Date(thisWeekStartDate);
  lastWeekStartDate.setDate(lastWeekStartDate.getDate() - 7);
  const lastWeekEndDate = new Date(thisWeekStartDate);
  lastWeekEndDate.setMilliseconds(-1);

  // This month
  const thisMonthStart = `${todayStr.substring(0, 7)}-01`;

  // Last month
  const lastMonthDate = new Date(`${thisMonthStart}T12:00:00`);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStart = lastMonthDate.toISOString().split('T')[0].substring(0, 7) + '-01';
  const lastMonthEnd = new Date(`${thisMonthStart}T00:00:00`);
  lastMonthEnd.setMilliseconds(-1);

  // This year
  const thisYearStart = `${todayStr.substring(0, 4)}-01-01`;

  // Last year
  const lastYear = parseInt(todayStr.substring(0, 4)) - 1;
  const lastYearStart = `${lastYear}-01-01`;
  const lastYearEnd = `${lastYear}-12-31T23:59:59`;

  // This week payments
  const { data: thisWeekPayments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', thisWeekStartDate.toISOString());

  // Last week payments
  const { data: lastWeekPayments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', lastWeekStartDate.toISOString())
    .lt('created_at', thisWeekStartDate.toISOString());

  // This month payments
  const { data: thisMonthPayments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', new Date(`${thisMonthStart}T00:00:00`).toISOString());

  // Last month payments
  const { data: lastMonthPayments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', new Date(`${lastMonthStart}T00:00:00`).toISOString())
    .lt('created_at', new Date(`${thisMonthStart}T00:00:00`).toISOString());

  // This year payments
  const { data: thisYearPayments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', new Date(`${thisYearStart}T00:00:00`).toISOString());

  // Last year payments
  const { data: lastYearPayments } = await supabase
    .from('payments_non_phi')
    .select('amount')
    .eq('owner_user_id', user.id)
    .gte('created_at', new Date(`${lastYearStart}T00:00:00`).toISOString())
    .lte('created_at', lastYearEnd);

  // Insurance payments from paid claims (based on date_paid)
  // Use paid_amount if available, otherwise fall back to billed_amount
  // This week insurance
  const { data: thisWeekInsurance } = await supabase
    .from('claims_non_phi')
    .select('paid_amount, billed_amount')
    .eq('owner_user_id', user.id)
    .eq('status', 'PAID')
    .gte('date_paid', thisWeekStart);

  // This month insurance
  const { data: thisMonthInsurance } = await supabase
    .from('claims_non_phi')
    .select('paid_amount, billed_amount')
    .eq('owner_user_id', user.id)
    .eq('status', 'PAID')
    .gte('date_paid', thisMonthStart);

  // This year insurance
  const { data: thisYearInsurance } = await supabase
    .from('claims_non_phi')
    .select('paid_amount, billed_amount')
    .eq('owner_user_id', user.id)
    .eq('status', 'PAID')
    .gte('date_paid', thisYearStart);

  const patientThisWeek = thisWeekPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const patientThisMonth = thisMonthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  const patientThisYear = thisYearPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const insuranceThisWeek = thisWeekInsurance?.reduce((sum, c) => sum + (c.paid_amount ?? c.billed_amount ?? 0), 0) || 0;
  const insuranceThisMonth = thisMonthInsurance?.reduce((sum, c) => sum + (c.paid_amount ?? c.billed_amount ?? 0), 0) || 0;
  const insuranceThisYear = thisYearInsurance?.reduce((sum, c) => sum + (c.paid_amount ?? c.billed_amount ?? 0), 0) || 0;

  return {
    thisWeek: patientThisWeek + insuranceThisWeek,
    lastWeek: lastWeekPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
    thisMonth: patientThisMonth + insuranceThisMonth,
    lastMonth: lastMonthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
    thisYear: patientThisYear + insuranceThisYear,
    lastYear: lastYearPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
    insuranceThisWeek,
    insuranceThisMonth,
    insuranceThisYear,
  };
}

export async function getWeeklyEarnings(weeks: number = 8): Promise<WeeklyEarning[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const { date: currentWeekStart } = getStartOfWeekInTimezone(timezone);

  const results: WeeklyEarning[] = [];

  for (let i = 0; i < weeks; i++) {
    const weekStartDate = new Date(`${currentWeekStart}T12:00:00`);
    weekStartDate.setDate(weekStartDate.getDate() - (i * 7));
    const weekStart = weekStartDate.toISOString().split('T')[0];

    const weekEndDate = new Date(`${weekStart}T12:00:00`);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];

    const weekStartISO = new Date(`${weekStart}T00:00:00`).toISOString();
    const weekEndISO = new Date(`${weekEnd}T23:59:59`).toISOString();

    // Get payments for this week
    const { data: payments } = await supabase
      .from('payments_non_phi')
      .select('amount, is_copay')
      .eq('owner_user_id', user.id)
      .gte('created_at', weekStartISO)
      .lte('created_at', weekEndISO);

    // Get insurance payments (paid claims) for this week
    // Use paid_amount if available, otherwise fall back to billed_amount
    const { data: paidClaims } = await supabase
      .from('claims_non_phi')
      .select('paid_amount, billed_amount')
      .eq('owner_user_id', user.id)
      .eq('status', 'PAID')
      .gte('date_paid', weekStart)
      .lte('date_paid', weekEnd);

    // Get visits for this week
    const { count: visitCount } = await supabase
      .from('visits_non_phi')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .gte('visit_date', weekStart)
      .lte('visit_date', weekEnd);

    const patientTotal = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const copays = payments?.filter(p => p.is_copay).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const otherPayments = patientTotal - copays;
    const insurancePayments = paidClaims?.reduce((sum, c) => sum + (c.paid_amount ?? c.billed_amount ?? 0), 0) || 0;

    results.push({
      weekStart,
      weekEnd,
      total: patientTotal + insurancePayments,
      visitCount: visitCount || 0,
      copays,
      otherPayments,
      insurancePayments,
    });
  }

  return results;
}

export async function getMonthlyEarnings(months: number = 12): Promise<MonthlyEarning[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const todayStr = getDateInTimezone(timezone);

  const results: MonthlyEarning[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < months; i++) {
    const currentDate = new Date(`${todayStr}T12:00:00`);
    currentDate.setMonth(currentDate.getMonth() - i);
    currentDate.setDate(1);

    const month = currentDate.toISOString().split('T')[0].substring(0, 7); // YYYY-MM
    const monthStart = `${month}-01`;

    // Get end of month
    const nextMonth = new Date(currentDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEndDate = new Date(nextMonth.getTime() - 1).toISOString().split('T')[0];

    const monthStartISO = new Date(`${monthStart}T00:00:00`).toISOString();

    // Get payments for this month
    const { data: payments } = await supabase
      .from('payments_non_phi')
      .select('amount, is_copay')
      .eq('owner_user_id', user.id)
      .gte('created_at', monthStartISO)
      .lt('created_at', nextMonth.toISOString());

    // Get insurance payments (paid claims) for this month
    // Use paid_amount if available, otherwise fall back to billed_amount
    const { data: paidClaims } = await supabase
      .from('claims_non_phi')
      .select('paid_amount, billed_amount')
      .eq('owner_user_id', user.id)
      .eq('status', 'PAID')
      .gte('date_paid', monthStart)
      .lte('date_paid', monthEndDate);

    // Get visits for this month
    const { count: visitCount } = await supabase
      .from('visits_non_phi')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .gte('visit_date', monthStart)
      .lte('visit_date', monthEndDate);

    const patientTotal = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const copays = payments?.filter(p => p.is_copay).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const otherPayments = patientTotal - copays;
    const insurancePayments = paidClaims?.reduce((sum, c) => sum + (c.paid_amount ?? c.billed_amount ?? 0), 0) || 0;

    const monthLabel = `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

    results.push({
      month,
      monthLabel,
      total: patientTotal + insurancePayments,
      visitCount: visitCount || 0,
      copays,
      otherPayments,
      insurancePayments,
    });
  }

  return results;
}

export async function getYearlyEarnings(): Promise<YearlyEarning[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const todayStr = getDateInTimezone(timezone);
  const currentYear = parseInt(todayStr.substring(0, 4));

  const results: YearlyEarning[] = [];

  // Get data for current year and previous years (up to 5 years)
  for (let year = currentYear; year >= currentYear - 4; year--) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const yearStartISO = new Date(`${yearStart}T00:00:00`).toISOString();
    const yearEndISO = new Date(`${yearEnd}T23:59:59`).toISOString();

    // Get payments for this year
    const { data: payments } = await supabase
      .from('payments_non_phi')
      .select('amount, is_copay')
      .eq('owner_user_id', user.id)
      .gte('created_at', yearStartISO)
      .lte('created_at', yearEndISO);

    // Get insurance payments (paid claims) for this year
    // Use paid_amount if available, otherwise fall back to billed_amount
    const { data: paidClaims } = await supabase
      .from('claims_non_phi')
      .select('paid_amount, billed_amount')
      .eq('owner_user_id', user.id)
      .eq('status', 'PAID')
      .gte('date_paid', yearStart)
      .lte('date_paid', yearEnd);

    // Get visits for this year
    const { count: visitCount } = await supabase
      .from('visits_non_phi')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .gte('visit_date', yearStart)
      .lte('visit_date', yearEnd);

    const patientTotal = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const copays = payments?.filter(p => p.is_copay).reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const otherPayments = patientTotal - copays;
    const insurancePayments = paidClaims?.reduce((sum, c) => sum + (c.paid_amount ?? c.billed_amount ?? 0), 0) || 0;

    // Only include years with data
    if (patientTotal > 0 || insurancePayments > 0 || (visitCount && visitCount > 0)) {
      results.push({
        year: String(year),
        total: patientTotal + insurancePayments,
        visitCount: visitCount || 0,
        copays,
        otherPayments,
        insurancePayments,
      });
    }
  }

  return results;
}

export async function getPaymentMethodBreakdown(period: 'week' | 'month' | 'year' = 'month'): Promise<PaymentMethodBreakdown[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user's timezone from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';
  const todayStr = getDateInTimezone(timezone);

  let startDate: string;

  if (period === 'week') {
    const { iso } = getStartOfWeekInTimezone(timezone);
    startDate = iso;
  } else if (period === 'month') {
    startDate = new Date(`${todayStr.substring(0, 7)}-01T00:00:00`).toISOString();
  } else {
    startDate = new Date(`${todayStr.substring(0, 4)}-01-01T00:00:00`).toISOString();
  }

  const { data: payments } = await supabase
    .from('payments_non_phi')
    .select('amount, method')
    .eq('owner_user_id', user.id)
    .gte('created_at', startDate);

  if (!payments || payments.length === 0) return [];

  const methodTotals: Record<string, number> = {};
  let grandTotal = 0;

  payments.forEach(p => {
    const method = p.method || 'OTHER';
    methodTotals[method] = (methodTotals[method] || 0) + (p.amount || 0);
    grandTotal += p.amount || 0;
  });

  return Object.entries(methodTotals)
    .map(([method, total]) => ({
      method,
      total,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getPaymentsForExport(options?: { startDate?: string; endDate?: string }): Promise<PaymentExport[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('payments_non_phi')
    .select('created_at, amount, method, is_copay, patient:patients_non_phi(display_name)')
    .eq('owner_user_id', user.id)
    .order('created_at', { ascending: false });

  if (options?.startDate) {
    query = query.gte('created_at', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('created_at', options.endDate);
  }

  const { data } = await query;

  return (data || []).map(p => ({
    date: new Date(p.created_at).toLocaleDateString(),
    patient: (p.patient as unknown as { display_name: string } | null)?.display_name || 'Unknown',
    amount: p.amount,
    method: p.method,
    isCopay: p.is_copay,
  }));
}
