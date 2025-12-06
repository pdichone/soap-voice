// =============================================
// REFERRAL PRESET DATA
// Specialties, ICD-10 codes, and CPT codes for massage therapy
// =============================================

export interface CodeOption {
  code: string;
  description: string;
}

// Physician Specialties
export const PHYSICIAN_SPECIALTIES = [
  { value: 'pmr', label: 'PM&R (Physical Medicine & Rehabilitation)' },
  { value: 'orthopedic', label: 'Orthopedic' },
  { value: 'pcp', label: 'Primary Care (PCP)' },
  { value: 'chiropractic', label: 'Chiropractor' },
  { value: 'pain_management', label: 'Pain Management' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'rheumatology', label: 'Rheumatology' },
  { value: 'sports_medicine', label: 'Sports Medicine' },
  { value: 'family_medicine', label: 'Family Medicine' },
  { value: 'internal_medicine', label: 'Internal Medicine' },
  { value: 'naturopathic', label: 'Naturopathic (ND)' },
  { value: 'physical_therapy', label: 'Physical Therapy' },
  { value: 'occupational_therapy', label: 'Occupational Therapy' },
  { value: 'other', label: 'Other' },
];

// Common ICD-10 Codes for Massage Therapy
export const COMMON_ICD10_CODES: CodeOption[] = [
  // Back pain
  { code: 'M54.5', description: 'Low back pain' },
  { code: 'M54.50', description: 'Low back pain, unspecified' },
  { code: 'M54.51', description: 'Vertebrogenic low back pain' },
  { code: 'M54.59', description: 'Other low back pain' },
  { code: 'M54.2', description: 'Cervicalgia (neck pain)' },
  { code: 'M54.6', description: 'Pain in thoracic spine' },
  { code: 'M54.9', description: 'Dorsalgia, unspecified' },

  // Shoulder pain
  { code: 'M25.511', description: 'Pain in right shoulder' },
  { code: 'M25.512', description: 'Pain in left shoulder' },
  { code: 'M25.519', description: 'Pain in unspecified shoulder' },
  { code: 'M75.80', description: 'Other shoulder lesions, unspecified' },
  { code: 'M75.100', description: 'Rotator cuff tear, unspecified shoulder' },

  // Muscle conditions
  { code: 'M79.1', description: 'Myalgia (muscle pain)' },
  { code: 'M79.3', description: 'Panniculitis, unspecified' },
  { code: 'M62.830', description: 'Muscle spasm of back' },
  { code: 'M62.838', description: 'Other muscle spasm' },
  { code: 'M62.81', description: 'Muscle weakness (generalized)' },

  // Soft tissue
  { code: 'M79.9', description: 'Soft tissue disorder, unspecified' },
  { code: 'M79.7', description: 'Fibromyalgia' },

  // Joint pain
  { code: 'M25.50', description: 'Pain in unspecified joint' },
  { code: 'M25.551', description: 'Pain in right hip' },
  { code: 'M25.552', description: 'Pain in left hip' },
  { code: 'M25.561', description: 'Pain in right knee' },
  { code: 'M25.562', description: 'Pain in left knee' },

  // Chronic pain
  { code: 'G89.29', description: 'Other chronic pain' },
  { code: 'G89.4', description: 'Chronic pain syndrome' },

  // Sprains/strains
  { code: 'S13.4XXA', description: 'Sprain of ligaments of cervical spine, initial' },
  { code: 'S13.4XXD', description: 'Sprain of ligaments of cervical spine, subsequent' },
  { code: 'S23.3XXA', description: 'Sprain of ligaments of thoracic spine, initial' },
  { code: 'S33.5XXA', description: 'Sprain of ligaments of lumbar spine, initial' },

  // Headache
  { code: 'G43.909', description: 'Migraine, unspecified' },
  { code: 'G44.209', description: 'Tension-type headache, unspecified' },
  { code: 'M53.0', description: 'Cervicocranial syndrome' },

  // Sciatica
  { code: 'M54.30', description: 'Sciatica, unspecified side' },
  { code: 'M54.31', description: 'Sciatica, right side' },
  { code: 'M54.32', description: 'Sciatica, left side' },

  // Other common
  { code: 'M62.40', description: 'Contracture of muscle, unspecified' },
  { code: 'R51', description: 'Headache' },
  { code: 'M53.1', description: 'Cervicobrachial syndrome' },
];

// Common CPT Codes for Massage Therapy
export const COMMON_CPT_CODES: CodeOption[] = [
  { code: '97140', description: 'Manual therapy (15 min)' },
  { code: '97110', description: 'Therapeutic exercises (15 min)' },
  { code: '97530', description: 'Therapeutic activities (15 min)' },
  { code: '97010', description: 'Hot/cold packs' },
  { code: '97112', description: 'Neuromuscular re-education (15 min)' },
  { code: '97124', description: 'Massage therapy (15 min)' },
  { code: '97035', description: 'Ultrasound (15 min)' },
  { code: '97116', description: 'Gait training (15 min)' },
  { code: '97542', description: 'Wheelchair management (15 min)' },
  { code: '97150', description: 'Group therapeutic procedure' },
  { code: '97032', description: 'Electrical stimulation (15 min)' },
  { code: '97033', description: 'Iontophoresis (15 min)' },
  { code: '97039', description: 'Unlisted modality' },
  { code: '97139', description: 'Unlisted therapeutic procedure' },
  { code: '97545', description: 'Work hardening (2 hrs)' },
  { code: '97546', description: 'Work hardening, each additional hour' },
];

// Search/filter helper functions
export function searchICD10Codes(query: string): CodeOption[] {
  const lowerQuery = query.toLowerCase();
  return COMMON_ICD10_CODES.filter(
    (code) =>
      code.code.toLowerCase().includes(lowerQuery) ||
      code.description.toLowerCase().includes(lowerQuery)
  );
}

export function searchCPTCodes(query: string): CodeOption[] {
  const lowerQuery = query.toLowerCase();
  return COMMON_CPT_CODES.filter(
    (code) =>
      code.code.toLowerCase().includes(lowerQuery) ||
      code.description.toLowerCase().includes(lowerQuery)
  );
}

// Get display string for code
export function getCodeDisplay(code: string, codes: CodeOption[]): string {
  const found = codes.find((c) => c.code === code);
  return found ? `${found.code} - ${found.description}` : code;
}

// Parse codes array to display string
export function formatCodesForDisplay(codes: string[] | null, codeList: CodeOption[]): string {
  if (!codes || codes.length === 0) return '';
  return codes
    .map((code) => {
      const found = codeList.find((c) => c.code === code);
      return found ? code : code;
    })
    .join(', ');
}

// Referral status helpers
export type ReferralAlertLevel = 'urgent' | 'warning' | 'info' | 'none';

export interface ReferralStatusInfo {
  status: 'active' | 'expiring_soon' | 'visits_low' | 'exhausted' | 'expired';
  alertLevel: ReferralAlertLevel;
  message: string;
  daysUntilExpiry: number | null;
  visitsRemaining: number | null;
  percentUsed: number;
}

export function calculateReferralStatus(
  referral: {
    referral_expiration_date: string | null;
    visit_limit_count: number | null;
    status?: string;
  },
  visitsUsed: number
): ReferralStatusInfo {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = referral.referral_expiration_date
    ? new Date(referral.referral_expiration_date)
    : null;

  const daysUntilExpiry = endDate
    ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const visitsRemaining = referral.visit_limit_count
    ? referral.visit_limit_count - visitsUsed
    : null;

  const percentUsed = referral.visit_limit_count && referral.visit_limit_count > 0
    ? (visitsUsed / referral.visit_limit_count) * 100
    : 0;

  // Determine status
  if (endDate && endDate < today) {
    return {
      status: 'expired',
      alertLevel: 'info',
      message: 'Expired',
      daysUntilExpiry,
      visitsRemaining,
      percentUsed,
    };
  }

  if (visitsRemaining !== null && visitsRemaining <= 0) {
    return {
      status: 'exhausted',
      alertLevel: 'urgent',
      message: 'All visits used',
      daysUntilExpiry,
      visitsRemaining,
      percentUsed,
    };
  }

  if (visitsRemaining !== null && (visitsRemaining === 1 || percentUsed >= 90)) {
    return {
      status: 'visits_low',
      alertLevel: 'urgent',
      message: `${visitsRemaining} visit${visitsRemaining === 1 ? '' : 's'} remaining`,
      daysUntilExpiry,
      visitsRemaining,
      percentUsed,
    };
  }

  if (daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
    return {
      status: 'expiring_soon',
      alertLevel: 'warning',
      message: `Expires in ${daysUntilExpiry} days`,
      daysUntilExpiry,
      visitsRemaining,
      percentUsed,
    };
  }

  return {
    status: 'active',
    alertLevel: 'none',
    message: 'Active',
    daysUntilExpiry,
    visitsRemaining,
    percentUsed,
  };
}

// Get color for alert level
export function getAlertLevelColor(level: ReferralAlertLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case 'urgent':
      return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
    case 'warning':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
    case 'info':
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' };
    default:
      return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
  }
}
