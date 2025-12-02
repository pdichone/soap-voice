// Operations Mode (Non-PHI) Types

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'PRACTITIONER' | 'ADMIN';
  timezone: string;
  claim_pending_threshold_days: number;
  referral_warning_days: number;
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
  method: 'CASH' | 'CHECK' | 'CARD' | 'HSA' | 'OTHER';
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
}

export interface WeeklyEarning {
  weekStart: string;
  weekEnd: string;
  total: number;
  visitCount: number;
  copays: number;
  otherPayments: number;
}

export interface MonthlyEarning {
  month: string;
  monthLabel: string;
  total: number;
  visitCount: number;
  copays: number;
  otherPayments: number;
}

export interface YearlyEarning {
  year: string;
  total: number;
  visitCount: number;
  copays: number;
  otherPayments: number;
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
