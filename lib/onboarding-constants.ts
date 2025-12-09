// =============================================
// ONBOARDING CONSTANTS
// Predefined options for the questionnaire form
// =============================================

export const SPECIALTIES = [
  { value: 'swedish', label: 'Swedish Massage' },
  { value: 'deep_tissue', label: 'Deep Tissue' },
  { value: 'sports', label: 'Sports Massage' },
  { value: 'myofascial', label: 'Myofascial Release' },
  { value: 'craniosacral', label: 'Craniosacral Therapy' },
  { value: 'prenatal', label: 'Prenatal Massage' },
  { value: 'cupping', label: 'Cupping Therapy' },
  { value: 'hot_stone', label: 'Hot Stone Massage' },
  { value: 'lymphatic', label: 'Lymphatic Drainage' },
  { value: 'trigger_point', label: 'Trigger Point Therapy' },
  { value: 'reflexology', label: 'Reflexology' },
  { value: 'shiatsu', label: 'Shiatsu' },
  { value: 'thai', label: 'Thai Massage' },
  { value: 'aromatherapy', label: 'Aromatherapy' },
] as const;

export const INSURANCE_PORTALS = [
  { value: 'office_ally', label: 'Office Ally' },
  { value: 'availity', label: 'Availity' },
  { value: 'trizetto', label: 'Trizetto' },
  { value: 'change_healthcare', label: 'Change Healthcare' },
  { value: 'claim_md', label: 'Claim.MD' },
  { value: 'waystar', label: 'Waystar' },
  { value: 'kareo', label: 'Kareo' },
  { value: 'other', label: 'Other' },
] as const;

export const COMMON_PAYERS = [
  { value: 'aetna', label: 'Aetna' },
  { value: 'blue_cross', label: 'Blue Cross Blue Shield' },
  { value: 'cigna', label: 'Cigna' },
  { value: 'united', label: 'United Healthcare' },
  { value: 'humana', label: 'Humana' },
  { value: 'kaiser', label: 'Kaiser Permanente' },
  { value: 'medicare', label: 'Medicare' },
  { value: 'medicaid', label: 'Medicaid' },
  { value: 'tricare', label: 'TRICARE' },
  { value: 'anthem', label: 'Anthem' },
  { value: 'oscar', label: 'Oscar Health' },
  { value: 'other', label: 'Other' },
] as const;

export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (No DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
] as const;

export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
] as const;

export const SERVICE_DURATIONS = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 75, label: '75 minutes' },
  { value: 90, label: '90 minutes' },
  { value: 120, label: '120 minutes' },
] as const;

export const FOCUS_AREAS = [
  { value: 'pain_management', label: 'Pain Management' },
  { value: 'stress_relief', label: 'Stress Relief' },
  { value: 'injury_recovery', label: 'Injury Recovery' },
  { value: 'chronic_conditions', label: 'Chronic Conditions' },
  { value: 'prenatal_care', label: 'Prenatal Care' },
  { value: 'sports_performance', label: 'Sports Performance' },
  { value: 'relaxation', label: 'Relaxation & Wellness' },
  { value: 'posture_correction', label: 'Posture Correction' },
] as const;

// Onboarding status display config
// Note: Icons removed to prevent React hydration errors (emoji render differently on server vs client)
export const ONBOARDING_STATUS_CONFIG = {
  not_started: {
    label: 'Not Started',
    color: 'gray',
    badgeVariant: 'secondary' as const,
  },
  questionnaire_sent: {
    label: 'Questionnaire Sent',
    color: 'blue',
    badgeVariant: 'outline' as const,
  },
  questionnaire_received: {
    label: 'Questionnaire Received',
    color: 'cyan',
    badgeVariant: 'outline' as const,
  },
  in_progress: {
    label: 'In Progress',
    color: 'purple',
    badgeVariant: 'outline' as const,
  },
  completed: {
    label: 'Completed',
    color: 'green',
    badgeVariant: 'default' as const,
  },
  skipped: {
    label: 'Skipped',
    color: 'gray',
    badgeVariant: 'secondary' as const,
  },
} as const;

// Checklist items config
export const CHECKLIST_ITEMS = [
  { key: 'questionnaire_sent', label: 'Questionnaire sent' },
  { key: 'questionnaire_received', label: 'Questionnaire received' },
  { key: 'practice_configured', label: 'Practice configured' },
  { key: 'services_added', label: 'Services added' },
  { key: 'intake_form_created', label: 'Intake form created' },
  { key: 'client_list_imported', label: 'Client list imported' },
  { key: 'welcome_email_sent', label: 'Welcome email sent' },
] as const;

// Allowed file types for client list upload
export const ALLOWED_FILE_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/pdf',
  'image/png',
  'image/jpeg',
];

export const ALLOWED_FILE_EXTENSIONS = ['.csv', '.xls', '.xlsx', '.pdf', '.png', '.jpg', '.jpeg'];

export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
