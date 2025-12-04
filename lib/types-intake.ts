// Intake Forms Types

// Question types supported in intake forms
export type IntakeQuestionType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'yesno'
  | 'scale'
  | 'date'
  | 'section';

// Individual question definition
export interface IntakeQuestion {
  id: string;
  type: IntakeQuestionType;
  label: string;
  required?: boolean;
  options?: string[];       // For select/multiselect
  placeholder?: string;
  helpText?: string;
  min?: number;             // For scale
  max?: number;             // For scale
}

// Intake form template
export interface IntakeForm {
  id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  questions: IntakeQuestion[];
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Link sent to a specific client
export interface IntakeLink {
  id: string;
  token: string;
  form_id: string;
  patient_id: string;
  owner_user_id: string;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Responses keyed by question ID
export interface IntakeResponseData {
  [questionId: string]: string | string[] | boolean | number | null;
}

// Client submission
export interface IntakeResponse {
  id: string;
  link_id: string;
  form_id: string;
  patient_id: string;
  owner_user_id: string;
  responses: IntakeResponseData;
  submitted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

// Joined types
export interface IntakeLinkWithForm extends IntakeLink {
  form?: IntakeForm;
}

export interface IntakeLinkWithPatient extends IntakeLink {
  patient?: {
    id: string;
    display_name: string;
  };
}

export interface IntakeResponseWithForm extends IntakeResponse {
  form?: IntakeForm;
}

// For the public form page
export interface PublicIntakeData {
  form: IntakeForm;
  patient_name: string;
  already_completed: boolean;
  expired: boolean;
}

// Default Health History Template
export const DEFAULT_HEALTH_HISTORY_QUESTIONS: IntakeQuestion[] = [
  {
    id: 'section_visit',
    type: 'section',
    label: 'Reason for Visit',
  },
  {
    id: 'what_brings_you_in',
    type: 'textarea',
    label: 'What brings you in today?',
    required: true,
    placeholder: 'Describe any pain, tension, or goals for your session',
    helpText: 'Please share the main reason for your visit',
  },
  {
    id: 'section_personal',
    type: 'section',
    label: 'Personal Information',
  },
  {
    id: 'emergency_contact_name',
    type: 'text',
    label: 'Emergency Contact Name',
    required: true,
    placeholder: 'Full name',
  },
  {
    id: 'emergency_contact_phone',
    type: 'text',
    label: 'Emergency Contact Phone',
    required: true,
    placeholder: '(555) 555-5555',
  },
  {
    id: 'section_health',
    type: 'section',
    label: 'Health History',
  },
  {
    id: 'heart_conditions',
    type: 'yesno',
    label: 'Do you have any heart conditions?',
    required: true,
  },
  {
    id: 'high_blood_pressure',
    type: 'yesno',
    label: 'Do you have high blood pressure?',
    required: true,
  },
  {
    id: 'diabetes',
    type: 'yesno',
    label: 'Do you have diabetes?',
    required: true,
  },
  {
    id: 'skin_conditions',
    type: 'yesno',
    label: 'Do you have any skin conditions?',
    required: true,
  },
  {
    id: 'recent_surgery',
    type: 'yesno',
    label: 'Have you had any recent injuries or surgeries?',
    required: true,
  },
  {
    id: 'pregnant',
    type: 'yesno',
    label: 'Are you pregnant or is there a possibility you could be?',
    required: true,
  },
  {
    id: 'conditions',
    type: 'multiselect',
    label: 'Please select any conditions that apply:',
    options: [
      'Arthritis',
      'Fibromyalgia',
      'Chronic pain',
      'Varicose veins',
      'Blood clots',
      'Cancer',
      'Osteoporosis',
      'None of the above',
    ],
  },
  {
    id: 'medications',
    type: 'textarea',
    label: 'Please list any medications you are currently taking',
    placeholder: 'Include prescription and over-the-counter medications',
  },
  {
    id: 'allergies',
    type: 'textarea',
    label: 'Please list any known allergies',
    placeholder: 'Include allergies to oils, lotions, or other products',
  },
  {
    id: 'section_preferences',
    type: 'section',
    label: 'Session Preferences',
  },
  {
    id: 'pressure_preference',
    type: 'select',
    label: 'What is your preferred pressure level?',
    required: true,
    options: ['Light', 'Medium', 'Firm', 'Deep'],
  },
  {
    id: 'focus_areas',
    type: 'textarea',
    label: 'Are there any areas you would like us to focus on?',
    placeholder: 'e.g., neck, shoulders, lower back',
  },
  {
    id: 'avoid_areas',
    type: 'textarea',
    label: 'Are there any areas you would like us to avoid?',
    placeholder: 'e.g., feet, face, abdomen',
  },
  {
    id: 'additional_info',
    type: 'textarea',
    label: 'Is there anything else you would like us to know?',
    placeholder: 'Any other health concerns or preferences',
  },
];
