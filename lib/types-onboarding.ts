// =============================================
// ONBOARDING TYPES
// Types for practitioner onboarding workflow
// =============================================

export type OnboardingStatus =
  | 'not_started'
  | 'questionnaire_sent'
  | 'questionnaire_received'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export interface OnboardingChecklist {
  questionnaire_sent: boolean;
  questionnaire_received: boolean;
  practice_configured: boolean;
  services_added: boolean;
  intake_form_created: boolean;
  client_list_imported: boolean;
  welcome_email_sent: boolean;
}

export interface ServiceConfig {
  name: string;
  duration_minutes: number;
  price_cents: number;
}

export interface IntakePreferences {
  focus_areas: string[];
  custom_questions: string[];
}

export interface AddressInfo {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface OnboardingQuestionnaire {
  id: string;
  practitioner_id: string;
  token: string;
  practice_name: string | null;
  practice_type: 'cash_only' | 'insurance' | null;
  specialties: string[];
  services: ServiceConfig[];
  insurance_portals: string[];
  insurance_payers: string[];
  intake_preferences: IntakePreferences | null;
  address: AddressInfo | null;
  timezone: string | null;
  additional_notes: string | null;

  // Client list
  client_list_file_url: string | null;
  client_list_file_name: string | null;
  client_list_confirmed: boolean;

  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingQuestionnaireFormData {
  practice_name: string;
  practice_type: 'cash_only' | 'insurance' | null;
  specialties: string[];
  services: ServiceConfig[];
  insurance_portals: string[];
  insurance_payers: string[];
  intake_preferences: IntakePreferences;
  address: AddressInfo;
  timezone: string;
  additional_notes: string;
  client_list_file_url: string | null;
  client_list_file_name: string | null;
  client_list_confirmed: boolean;
}

// Extended Practitioner type with onboarding fields
export interface PractitionerWithOnboarding {
  id: string;
  email: string;
  name: string;
  workspace_name: string | null;
  onboarding_status: OnboardingStatus;
  onboarding_notes: string | null;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;
  onboarding_checklist: OnboardingChecklist;
}

// For the admin update payload
export interface OnboardingUpdateInput {
  onboarding_status?: OnboardingStatus;
  onboarding_notes?: string;
  onboarding_started_at?: string;
  onboarding_completed_at?: string;
  onboarding_checklist?: OnboardingChecklist;
}

// API response types
export interface QuestionnaireApiResponse {
  questionnaire: OnboardingQuestionnaire;
  practitioner_name: string;
  already_submitted: boolean;
}

export interface QuestionnaireSubmitResponse {
  success: boolean;
  message: string;
}

export interface FileUploadResponse {
  success: boolean;
  url?: string;
  filename?: string;
  error?: string;
}
