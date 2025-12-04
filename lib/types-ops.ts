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

export interface PracticeSettings {
  // Future extensibility for practice-specific settings
  [key: string]: unknown;
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
