// Operations Mode (Non-PHI) Types

// =============================================
// Practice Types
// =============================================
export type PracticeType = 'cash_only' | 'insurance' | 'school';

export type PracticeUserRole = 'admin' | 'supervisor' | 'practitioner';

export interface Practice {
  id: string;
  name: string;
  practice_type: PracticeType;
  settings: PracticeSettings;
  created_at: string;
  updated_at: string;
}

// Service configuration from onboarding
export interface ServiceConfig {
  name: string;
  duration_minutes: number;
  price_cents: number;
}

// Intake preferences from onboarding
export interface IntakePreferencesConfig {
  focus_areas?: string[];
  custom_questions?: string[];
}

export interface PracticeSettings {
  // Practice branding for PDFs and documents
  business_name?: string;
  logo_url?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  website?: string;

  // From onboarding questionnaire
  services?: ServiceConfig[];
  specialties?: string[];
  insurance_payers?: string[];
  insurance_portals?: string[];
  intake_preferences?: IntakePreferencesConfig;

  // Future extensibility for practice-specific settings
  [key: string]: unknown;
}

// Charges summary data for PDF generation
export interface ChargesSummaryData {
  practice: PracticeSettings;
  patient: {
    display_name: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  payments: Array<{
    date: string;
    amount: number;
    method: string;
  }>;
  totals: {
    visit_count: number;
    total_paid: number;
  };
  generated_at: string;
}

export interface PracticeUser {
  id: string;
  practice_id: string;
  user_id: string;
  role: PracticeUserRole;
  is_active: boolean;
  invited_at: string | null;
  joined_at: string;
  created_at: string;
}

// =============================================
// Payment Methods (expanded for all practice types)
// =============================================
export type PaymentMethod =
  | 'CASH'
  | 'CHECK'
  | 'CARD'
  | 'HSA'
  | 'VENMO'
  | 'CASHAPP'
  | 'APPLEPAY'
  | 'ZELLE'
  | 'OTHER';

// =============================================
// User Profile
// =============================================
export interface Profile {
  id: string;
  full_name: string | null;
  role: 'PRACTITIONER' | 'ADMIN';
  timezone: string;
  claim_pending_threshold_days: number;
  referral_warning_days: number;
  practice_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientNonPhi {
  id: string;
  owner_user_id: string;
  display_name: string;
  insurer_name: string | null;
  default_copay_amount: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ReferralStatus = 'active' | 'expired' | 'exhausted' | 'renewed';

export interface ReferralNonPhi {
  id: string;
  patient_id: string;
  owner_user_id: string;
  referral_label: string | null;
  visit_limit_type: 'PER_REFERRAL' | 'PER_YEAR' | 'UNLIMITED';
  visit_limit_count: number | null;
  referral_start_date: string | null;
  referral_expiration_date: string | null;
  notes: string | null;
  // Enhanced physician info
  physician_name: string | null;
  physician_npi: string | null;
  physician_specialty: string | null;
  physician_phone: string | null;
  physician_fax: string | null;
  physician_clinic: string | null;
  // Authorization details
  authorization_number: string | null;
  payer: string | null;
  // Medical codes (stored as arrays)
  icd10_codes: string[] | null;
  cpt_codes: string[] | null;
  // Status tracking
  status: ReferralStatus;
  created_at: string;
  updated_at: string;
}

export interface Physician {
  id: string;
  practice_id: string | null;
  owner_user_id: string;
  name: string;
  npi: string | null;
  specialty: string | null;
  clinic_name: string | null;
  phone: string | null;
  fax: string | null;
  referral_count: number;
  created_at: string;
  updated_at: string;
}

export interface VisitNonPhi {
  id: string;
  patient_id: string;
  owner_user_id: string;
  referral_id: string | null;
  visit_date: string;
  is_billable_to_insurance: boolean;
  created_at: string;
}

export interface PaymentNonPhi {
  id: string;
  owner_user_id: string;
  patient_id: string;
  visit_id: string | null;
  amount: number;
  method: PaymentMethod;
  is_copay: boolean;
  created_at: string;
}

export type ClaimStatus =
  | 'TO_SUBMIT'
  | 'SUBMITTED'
  | 'PENDING'
  | 'PAID'
  | 'DENIED'
  | 'APPEAL';

export interface ClaimNonPhi {
  id: string;
  owner_user_id: string;
  patient_id: string;
  visit_id: string | null;
  insurer_name: string | null;
  portal_name: string | null;
  status: ClaimStatus;
  date_of_service: string | null;
  date_submitted: string | null;
  date_paid: string | null;
  billed_amount: number | null;
  paid_amount: number | null; // Actual amount paid by insurance
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Joined types for display
export interface PatientWithStats extends PatientNonPhi {
  visit_count?: number;
  last_visit_date?: string;
  pending_claims_count?: number;
  active_referral?: ReferralNonPhi | null;
}

export interface ClaimWithPatient extends ClaimNonPhi {
  patient?: PatientNonPhi;
}

export interface VisitWithPatient extends VisitNonPhi {
  patient?: PatientNonPhi;
}

// Dashboard summary types
export interface DashboardSummary {
  total_patients: number;
  active_patients: number;
  visits_this_week: number;
  visits_this_month: number;
  pending_claims_count: number;
  pending_claims_amount: number;
  expiring_referrals_count: number;
  payments_this_month: number;
}

// Reports types
export interface EarningsSummary {
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  lastWeek: number;
  lastMonth: number;
  lastYear: number;
  // Insurance payments (from paid claims)
  insuranceThisWeek?: number;
  insuranceThisMonth?: number;
  insuranceThisYear?: number;
}

export interface WeeklyEarning {
  weekStart: string;
  weekEnd: string;
  total: number;
  visitCount: number;
  copays: number;
  otherPayments: number;
  insurancePayments?: number;
}

export interface MonthlyEarning {
  month: string;
  monthLabel: string;
  total: number;
  visitCount: number;
  copays: number;
  otherPayments: number;
  insurancePayments?: number;
}

export interface YearlyEarning {
  year: string;
  total: number;
  visitCount: number;
  copays: number;
  otherPayments: number;
  insurancePayments?: number;
}

export interface PaymentExport {
  date: string;
  patient: string;
  amount: number;
  method: string;
  isCopay: boolean;
}

export interface PaymentMethodBreakdown {
  method: string;
  total: number;
  percentage: number;
}

// =============================================
// Document Types
// =============================================
export type DocumentType = 'INTAKE' | 'CONSENT' | 'HIPAA' | 'POLICY' | 'OTHER';
export type DocumentStatus = 'PENDING' | 'SIGNED' | 'DECLINED' | 'EXPIRED';

export interface DocumentTemplate {
  id: string;
  owner_user_id: string;
  title: string;
  document_type: DocumentType;
  content: string;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClientDocument {
  id: string;
  owner_user_id: string;
  patient_id: string;
  template_id: string;
  status: DocumentStatus;
  signed_at: string | null;
  expires_at: string | null;
  signature_data: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDocumentWithTemplate extends ClientDocument {
  template?: DocumentTemplate;
}

export interface DocumentTemplateWithStatus extends DocumentTemplate {
  client_document?: ClientDocument | null;
}

// =============================================
// Patient Benefits Types (Insurance Tracking)
// =============================================
export type PlanYearType = 'calendar' | 'custom';

export interface PatientBenefits {
  id: string;
  patient_id: string;
  owner_user_id: string;
  plan_year_type: PlanYearType;
  plan_year_start: string | null;
  deductible_amount: number;
  deductible_paid: number;
  coinsurance_percent: number;
  oop_max: number;
  oop_paid: number;
  allowed_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollectionResult {
  collect_amount: number;
  reason: string;
  explanation: string;
  deductible_met: boolean;
  oop_met: boolean;
  deductible_remaining: number;
  oop_remaining: number;
}

export interface PatientWithBenefits extends PatientNonPhi {
  benefits?: PatientBenefits | null;
}

// =============================================
// Portal Types (Claim Submission Portals)
// =============================================
export interface Portal {
  id: string;
  practice_id: string;
  name: string;
  url: string | null;
  notes: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalWithClaimCount extends Portal {
  claim_count?: number;
}

// =============================================
// Super Admin Types
// =============================================
export type PractitionerStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type PractitionerPlanType = 'trial' | 'solo' | 'professional' | 'enterprise' | 'founder' | 'custom';
export type BillingStatus = 'trial' | 'paying' | 'overdue' | 'cancelled' | 'comped';
export type AdminRole = 'admin' | 'super_admin' | 'support';
export type EventActorType = 'admin' | 'practitioner' | 'system';

export type StripeSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface Practitioner {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  workspace_id: string;
  workspace_name: string | null;
  status: PractitionerStatus;
  plan_type: PractitionerPlanType;
  monthly_price: number | null;
  billing_status: BillingStatus;
  trial_ends_at: string | null;
  billing_started_at: string | null;
  billing_notes: string | null;
  // Stripe billing fields
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: StripeSubscriptionStatus | null;
  current_period_end: string | null;
  feature_claims_tracking: boolean;
  feature_year_end_summary: boolean;
  feature_insurance_calculator: boolean;
  feature_bulk_operations: boolean;
  feature_intake_forms: boolean;
  feature_documents: boolean;
  feature_referrals: boolean;
  practice_type: PracticeType;
  last_login_at: string | null;
  last_activity_at: string | null;
  login_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  deleted_at: string | null;
  // Onboarding fields
  onboarding_status: string | null;
  onboarding_notes: string | null;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  onboarding_checklist: Record<string, boolean> | null;
}

export interface PractitionerWithStats extends Practitioner {
  patient_count?: number;
  visit_count?: number;
  visits_this_week?: number;
  visits_this_month?: number;
  total_payments?: number;
  payments_this_month?: number;
  pending_claims_count?: number;
}

export interface AdminUser {
  id: string;
  user_id: string | null;
  email: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminEvent {
  id: string;
  actor_type: EventActorType;
  actor_id: string | null;
  actor_email: string | null;
  event_type: string;
  event_category: string | null;
  practitioner_id: string | null;
  workspace_id: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminEventWithPractitioner extends AdminEvent {
  practitioner?: Practitioner | null;
}

export interface ImpersonationSession {
  id: string;
  admin_id: string;
  practitioner_id: string;
  started_at: string;
  ended_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface ImpersonationSessionWithDetails extends ImpersonationSession {
  admin?: AdminUser;
  practitioner?: Practitioner;
}

export interface ImpersonationContext {
  isImpersonating: boolean;
  practitionerId: string | null;
  practitionerName: string | null;
  workspaceId: string | null;
  sessionId: string | null;
  adminReturnUrl: string | null;
}

export interface PractitionerCreateInput {
  email: string;
  name: string;
  workspace_name?: string;
  plan_type?: PractitionerPlanType;
  billing_status?: BillingStatus;
  monthly_price?: number;
  trial_ends_at?: string;
  billing_notes?: string;
  feature_claims_tracking?: boolean;
  feature_year_end_summary?: boolean;
  feature_insurance_calculator?: boolean;
  feature_bulk_operations?: boolean;
  feature_intake_forms?: boolean;
  feature_documents?: boolean;
  feature_referrals?: boolean;
}

export interface PractitionerUpdateInput {
  name?: string;
  workspace_name?: string;
  status?: PractitionerStatus;
  plan_type?: PractitionerPlanType;
  practice_type?: PracticeType;
  billing_status?: BillingStatus;
  monthly_price?: number;
  trial_ends_at?: string;
  billing_started_at?: string;
  billing_notes?: string;
  feature_claims_tracking?: boolean;
  feature_year_end_summary?: boolean;
  feature_insurance_calculator?: boolean;
  feature_bulk_operations?: boolean;
  feature_intake_forms?: boolean;
  feature_documents?: boolean;
  feature_referrals?: boolean;
}
