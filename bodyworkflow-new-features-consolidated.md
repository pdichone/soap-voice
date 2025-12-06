# BodyWorkFlow: New Features Spec (Non-HIPAA)
## Consolidated Implementation Guide for Claude Code

**Version:** 1.0  
**Date:** December 2025  
**Source:** Direct feedback from Jess (LMT user)

---

## Overview

This document consolidates three high-priority features requested by Jess. All features are designed to work WITHOUT HIPAA compliance requirements - no PHI storage.

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Customizable Portals | 2-3 days | Quick win, daily use |
| 2 | Enhanced Referral Management | 4-5 days | "Big deal" per Jess |
| 3 | Year-End PDF Charges Summary | 5-7 days | Patients asking for this |

**Total Estimated Effort:** 2-3 weeks

---

# FEATURE 1: Customizable Portals Management

## Problem Statement

Jess has to log into multiple clearinghouse portals to manage claims (Office Ally, Availity, One Health Port, Premera, Regence, etc.). She wants an easy dropdown to select which portal a claim was submitted through, and she wants to add her own portal names.

## Solution

A user-manageable list of portals stored in practice settings.

---

## Database Schema

```sql
CREATE TABLE portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500),                      -- Optional: login URL
  notes TEXT,                            -- Optional: login hints
  
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(practice_id, name)
);

CREATE INDEX idx_portals_practice ON portals(practice_id);
```

---

## Default Portals (Seed Data)

```typescript
const defaultPortals = [
  { name: "Office Ally", url: "https://www.officeally.com" },
  { name: "Availity", url: "https://www.availity.com" },
  { name: "One Health Port", url: "https://www.onehealthport.com" },
  { name: "Premera", url: "https://www.premera.com/provider" },
  { name: "Regence", url: "https://www.regence.com/provider" },
  { name: "Aetna", url: "https://www.aetna.com/providers" },
  { name: "UnitedHealthcare", url: "https://www.uhcprovider.com" },
  { name: "Cigna", url: "https://www.cigna.com/providers" },
  { name: "Molina", url: "https://www.molinahealthcare.com/providers" },
  { name: "Blue Cross", url: "https://www.bluecross.com" },
];
```

---

## UI Components

### 1. Portal Dropdown (On Claims Form)

```
Portal *
┌─────────────────────────────────────────────────────────────┐
│ Office Ally                                              ▼ │
├─────────────────────────────────────────────────────────────┤
│ ★ Office Ally              (most used)                     │
│ ★ Availity                                                 │
│   One Health Port                                          │
│   Premera                                                  │
│   Regence                                                  │
│   ─────────────────────────                                │
│   + Manage Portals...                                      │
└─────────────────────────────────────────────────────────────┘
```

### 2. Settings → Manage Portals Screen

```
┌─────────────────────────────────────────────────────────────┐
│  ← Settings                                                 │
│                                                             │
│  Manage Portals                                             │
│  Add, edit, or reorder your claim submission portals        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ≡  Office Ally                           12 claims     ││
│  │     officeally.com                        [ Edit ] 🗑️   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ≡  Availity                              8 claims      ││
│  │     availity.com                          [ Edit ] 🗑️   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              [ + Add New Portal ]                       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  💡 Drag ≡ to reorder. Most-used portals appear first.     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Add/Edit Portal Modal

```
┌─────────────────────────────────────────────────────────────┐
│                      Add Portal                         ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Portal Name *                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Kaiser Permanente                                       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Website URL (optional)                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ https://provider.kp.org                                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Notes (optional)                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Username: jess_lmt                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               [ Save Portal ]                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

```typescript
// GET /api/portals - List all portals for practice
// POST /api/portals - Create new portal
// PUT /api/portals/:id - Update portal
// DELETE /api/portals/:id - Soft delete (is_active = false)
// PUT /api/portals/reorder - Update sort_order

interface Portal {
  id: string;
  name: string;
  url?: string;
  notes?: string;
  sort_order: number;
  is_active: boolean;
  claim_count?: number;  // Computed
}
```

---

## Implementation Checklist

- [ ] Create portals table with migration
- [ ] Seed default portals on new practice creation
- [ ] Create CRUD API endpoints
- [ ] Create "Manage Portals" screen in Settings
- [ ] Add/Edit portal modal
- [ ] Drag-to-reorder functionality
- [ ] Update claim form to use portals dropdown
- [ ] Add portal filter to Claims list screen
- [ ] Show portal name on claim cards

---

## Edge Cases

1. **Delete portal with existing claims** → Soft delete, still shows on historical claims
2. **Duplicate portal name** → Prevent with unique constraint + error message
3. **No portals** → Show "Add your first portal" prompt

---

# FEATURE 2: Enhanced Referral Management

## Problem Statement

Jess emphasized that "referrals are a big deal." She needs to track physician info, NPI codes, authorization numbers, visits allowed, ICD-10 codes, and CPT codes. The current referral tracking is too basic.

**IMPORTANT:** No referral document upload in this version (requires HIPAA). Jess enters fields manually and keeps PDFs in her own filing system.

---

## Referral Fields

| Field | Type | Example | Required |
|-------|------|---------|----------|
| Referring Physician | Text | Dr. Sarah Smith | Yes |
| Physician NPI | Text (10 digits) | 1234567890 | No |
| Physician Specialty | Dropdown | PM&R, Orthopedic, PCP | No |
| Physician Phone | Phone | (206) 555-1234 | No |
| Physician Fax | Phone | (206) 555-1235 | No |
| Authorization Number | Text | AUTH-2025-12345 | No |
| Visits Allowed | Number | 12 | Yes |
| Visits Used | Number | 8 | Auto-calculated |
| Start Date | Date | Jan 1, 2025 | Yes |
| End Date | Date | Jun 30, 2025 | Yes |
| ICD-10 Codes | Text/Tags | M54.5, M54.2 | No |
| CPT Codes | Text/Tags | 97140, 97110 | No |
| Insurance/Payer | Dropdown | Blue Cross, Premera | Yes |
| Notes | Textarea | "Renewal pending" | No |

**PM&R = Physical Medicine & Rehabilitation**

---

## Database Schema

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  patient_id UUID REFERENCES patients(id),
  
  -- Referring Provider Info
  physician_name VARCHAR(255) NOT NULL,
  physician_npi VARCHAR(10),
  physician_specialty VARCHAR(100),
  physician_phone VARCHAR(50),
  physician_fax VARCHAR(50),
  physician_clinic VARCHAR(255),
  
  -- Authorization Details
  authorization_number VARCHAR(100),
  payer VARCHAR(255),
  
  -- Visit Limits
  visits_allowed INTEGER NOT NULL,
  visits_used INTEGER DEFAULT 0,
  
  -- Date Range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- Codes (stored as arrays)
  icd10_codes TEXT[],
  cpt_codes TEXT[],
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- active, expired, exhausted, renewed
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_patient ON referrals(patient_id);
CREATE INDEX idx_referrals_status ON referrals(status);
CREATE INDEX idx_referrals_end_date ON referrals(end_date);
```

### Physician Directory (Optional - for auto-complete)

```sql
CREATE TABLE physicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  
  name VARCHAR(255) NOT NULL,
  npi VARCHAR(10),
  specialty VARCHAR(100),
  clinic_name VARCHAR(255),
  phone VARCHAR(50),
  fax VARCHAR(50),
  
  referral_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(practice_id, npi)
);
```

---

## Preset Data

### Physician Specialties

```typescript
const physicianSpecialties = [
  "PM&R (Physical Medicine & Rehabilitation)",
  "Orthopedic",
  "Primary Care (PCP)",
  "Chiropractor",
  "Pain Management",
  "Neurology",
  "Rheumatology",
  "Sports Medicine",
  "Family Medicine",
  "Internal Medicine",
  "Naturopathic (ND)",
  "Other"
];
```

### Common ICD-10 Codes

```typescript
const commonICD10Codes = [
  { code: "M54.5", description: "Low back pain" },
  { code: "M54.2", description: "Cervicalgia (neck pain)" },
  { code: "M54.6", description: "Pain in thoracic spine" },
  { code: "M25.511", description: "Pain in right shoulder" },
  { code: "M25.512", description: "Pain in left shoulder" },
  { code: "M79.3", description: "Panniculitis (soft tissue)" },
  { code: "M62.830", description: "Muscle spasm of back" },
  { code: "G89.29", description: "Other chronic pain" },
  { code: "M79.1", description: "Myalgia (muscle pain)" },
  { code: "S13.4XXA", description: "Sprain of cervical spine" },
];
```

### Common CPT Codes

```typescript
const commonCPTCodes = [
  { code: "97140", description: "Manual therapy (15 min)" },
  { code: "97110", description: "Therapeutic exercises (15 min)" },
  { code: "97530", description: "Therapeutic activities (15 min)" },
  { code: "97010", description: "Hot/cold packs" },
  { code: "97112", description: "Neuromuscular re-education" },
  { code: "97124", description: "Massage therapy (15 min)" },
];
```

---

## UI Components

### 1. Referral List (Patient Detail → Referrals Tab)

```
┌─────────────────────────────────────────────────────────────┐
│  Referrals                              [ + New Referral ]  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🟢 ACTIVE                                              ││
│  │                                                         ││
│  │  Dr. Sarah Smith (PM&R)                                 ││
│  │  Blue Cross • Auth #BC-2025-1234                        ││
│  │  Jan 1 - Jun 30, 2025                                   ││
│  │                                                         ││
│  │  Visits: 8 / 12                                         ││
│  │  ▓▓▓▓▓▓▓▓▓▓░░░░░░  67%                                 ││
│  │                                                         ││
│  │  ⚠️ 4 visits remaining • Expires in 45 days            ││
│  │                                                         ││
│  │  ICD-10: M54.5, M54.2                                   ││
│  │  CPT: 97140, 97110                                      ││
│  │                                                         ││
│  │  [ View Details ]                      [ Renew ]        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ⚫ EXPIRED                                             ││
│  │                                                         ││
│  │  Dr. John Lee (Orthopedic)                              ││
│  │  Blue Cross • Auth #BC-2024-5678                        ││
│  │  Jul 1 - Dec 31, 2024                                   ││
│  │  Visits: 12 / 12 (Complete)                             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Add/Edit Referral Form

```
┌─────────────────────────────────────────────────────────────┐
│                      New Referral                       ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Patient: Sarah Johnson                                     │
│                                                             │
│  ── REFERRING PROVIDER ──                                   │
│                                                             │
│  Physician Name *                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Dr. Sarah Smith                          🔍 (auto-fill) ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Specialty                          NPI                     │
│  ┌───────────────────────┐         ┌───────────────────────┐│
│  │ PM&R               ▼ │         │ 1234567890            ││
│  └───────────────────────┘         └───────────────────────┘│
│                                                             │
│  Phone                              Fax                     │
│  ┌───────────────────────┐         ┌───────────────────────┐│
│  │ (206) 555-1234        │         │ (206) 555-1235        ││
│  └───────────────────────┘         └───────────────────────┘│
│                                                             │
│  ── AUTHORIZATION ──                                        │
│                                                             │
│  Insurance/Payer *                                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Blue Cross                                           ▼ ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Authorization Number                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ BC-2025-1234                                            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Visits Allowed *                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 12                                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Start Date *                       End Date *              │
│  ┌───────────────────────┐         ┌───────────────────────┐│
│  │ Jan 1, 2025           │         │ Jun 30, 2025          ││
│  └───────────────────────┘         └───────────────────────┘│
│                                                             │
│  ── CODES ──                                                │
│                                                             │
│  ICD-10 Codes                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [ M54.5 ✕ ] [ M54.2 ✕ ] [ + Add ]                      ││
│  └─────────────────────────────────────────────────────────┘│
│  Suggestions: M54.5 (Low back), M54.2 (Neck pain)          │
│                                                             │
│  CPT Codes                                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [ 97140 ✕ ] [ 97110 ✕ ] [ + Add ]                      ││
│  └─────────────────────────────────────────────────────────┘│
│  Suggestions: 97140 (Manual therapy), 97110 (Therapeutic)  │
│                                                             │
│  ── NOTES ──                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Called for renewal 12/1, waiting on callback            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  📄 Keep your referral documents stored securely outside    │
│  the app. Document upload coming in a future update.        │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               [ Save Referral ]                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Dashboard Referral Alerts (Enhanced)

```
┌─────────────────────────────────────────────────────────────┐
│  Referral Alerts                        Manage Referrals →  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🔴 URGENT                                              ││
│  │  Sarah Johnson • Dr. Smith (PM&R) • Blue Cross          ││
│  │  11/12 visits • Expires Dec 15                          ││
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  92%                                 ││
│  │  [ Request Renewal ]                                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  🟡 EXPIRING SOON                                       ││
│  │  Mike R. • Dr. Lee (Ortho) • Regence                    ││
│  │  5/10 visits • Expires Jan 15                           ││
│  │  ▓▓▓▓▓▓▓░░░░░░░░░  50%                                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Referral Status Logic

```typescript
type ReferralStatus = 'active' | 'expiring_soon' | 'visits_low' | 'exhausted' | 'expired';

function calculateReferralStatus(referral: Referral): ReferralStatus {
  const today = new Date();
  const endDate = new Date(referral.end_date);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const visitsRemaining = referral.visits_allowed - referral.visits_used;
  const visitPercentUsed = (referral.visits_used / referral.visits_allowed) * 100;

  if (endDate < today) return 'expired';
  if (visitsRemaining <= 0) return 'exhausted';
  if (visitsRemaining === 1 || visitPercentUsed >= 90) return 'visits_low';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'active';
}

function getReferralAlertLevel(status: ReferralStatus): 'urgent' | 'warning' | 'info' | 'none' {
  switch (status) {
    case 'visits_low':
    case 'exhausted':
      return 'urgent';      // Red
    case 'expiring_soon':
      return 'warning';     // Yellow
    case 'expired':
      return 'info';        // Gray
    default:
      return 'none';
  }
}
```

---

## Auto-Increment Visits

When a visit is recorded for a patient with an active referral:

```typescript
async function recordVisit(patientId: string, visitData: VisitInput) {
  const visit = await createVisit(patientId, visitData);
  
  const activeReferral = await getActiveReferral(patientId);
  
  if (activeReferral) {
    await incrementReferralVisits(activeReferral.id);
    
    const visitsRemaining = activeReferral.visits_allowed - (activeReferral.visits_used + 1);
    
    if (visitsRemaining <= 2) {
      // Show alert: "Sarah has 2 visits remaining on current referral"
    }
  }
  
  return visit;
}
```

---

## Implementation Checklist

- [ ] Update referrals table with new fields
- [ ] Create physicians table for auto-complete
- [ ] Create/update referral form with all fields
- [ ] Add specialty dropdown with presets
- [ ] Add ICD-10 code input with suggestions
- [ ] Add CPT code input with suggestions
- [ ] Physician name auto-complete from previous referrals
- [ ] Auto-fill NPI, phone, fax when physician selected
- [ ] Update Referrals tab with enhanced display
- [ ] Update dashboard alerts with physician/codes info
- [ ] Auto-increment visits_used when visit recorded
- [ ] Alert when visits running low
- [ ] "Renew Referral" button (copies fields to new referral)

---

# FEATURE 3: Year-End PDF Charges Summary

## Problem Statement

Patients keep asking Jess for a printout of charges for taxes, HSA/FSA reimbursement, or insurance documentation. Currently she manually types up each summary in Word docs.

## Solution

One-click PDF generation with professional formatting showing all payments for a date range.

**Why It's Non-HIPAA Safe:**
- Contains only dates and dollar amounts
- NO diagnosis codes, treatment notes, or medical conditions
- It's financial data, not clinical data
- Similar to a receipt from any service business

---

## PDF Content

### What's Included (Non-PHI)

| Field | Example |
|-------|---------|
| Practice name | Healing Touch Massage Therapy |
| Practice address | 123 Main St, Seattle WA 98101 |
| Practice phone | (206) 555-1234 |
| Practice logo | [Image] |
| Patient name | Sarah Johnson |
| Date range | January 1 - December 31, 2025 |
| Visit date | March 15, 2025 |
| Service type | 60 min session |
| Amount paid | $45.00 |
| Payment method | Card |
| Total visits | 12 |
| Total paid | $600.00 |
| Generated timestamp | Generated Dec 15, 2025 |
| Signature line | _________________________ |

### What's NOT Included (PHI) - Never include these

- ❌ Diagnosis codes (ICD-10)
- ❌ Treatment descriptions
- ❌ CPT/procedure codes
- ❌ SOAP notes
- ❌ Health conditions
- ❌ Insurance claim details
- ❌ Referral information

---

## Database: Practice Branding Fields

Add to practices table if not exists:

```sql
ALTER TABLE practices ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS state VARCHAR(50);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS zip VARCHAR(20);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE practices ADD COLUMN IF NOT EXISTS logo_url TEXT;
```

---

## Query for Payment Summary

```sql
SELECT 
  v.visit_date,
  v.service_type,
  p.amount,
  p.method
FROM visits v
JOIN payments p ON p.visit_id = v.id
WHERE v.patient_id = :patient_id
  AND v.visit_date BETWEEN :start_date AND :end_date
  AND p.amount > 0
ORDER BY v.visit_date ASC;
```

---

## PDF Template Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [LOGO]    HEALING TOUCH MASSAGE THERAPY                               │
│            123 Main Street, Suite 100                                   │
│            Seattle, WA 98101                                            │
│            (206) 555-1234                                               │
│            healingtouchmassage.com                                      │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│            PATIENT CHARGES SUMMARY                                      │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  Patient:        Sarah Johnson                                          │
│  Date Range:     January 1, 2025 — December 31, 2025                   │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  VISIT DETAILS                                                          │
│                                                                         │
│  ┌─────────────────┬────────────────┬───────────────┬────────────────┐ │
│  │ Date            │ Service        │ Paid          │ Method         │ │
│  ├─────────────────┼────────────────┼───────────────┼────────────────┤ │
│  │ Jan 15, 2025    │ 60 min session │ $45.00        │ Card           │ │
│  │ Feb 3, 2025     │ 60 min session │ $45.00        │ Card           │ │
│  │ Feb 28, 2025    │ 90 min session │ $65.00        │ HSA            │ │
│  │ Mar 15, 2025    │ 60 min session │ $45.00        │ Card           │ │
│  │ ...             │ ...            │ ...           │ ...            │ │
│  └─────────────────┴────────────────┴───────────────┴────────────────┘ │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  SUMMARY                                                                │
│                                                                         │
│  Total Visits:                                      12                  │
│  Total Amount Paid by Patient:                      $600.00             │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  This statement reflects payments made directly by the patient.         │
│  It does not include amounts billed to or paid by insurance.           │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│                                                                         │
│  _________________________________          _______________             │
│  Provider Signature                         Date                        │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│  Generated on December 15, 2025 at 2:34 PM                             │
│  BodyWorkFlow • bodyworkflow.app                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### 1. Entry Point: Patient → Payments Tab

```
┌─────────────────────────────────────────────────────────────┐
│  Payment History                    [ 📄 Generate Summary ] │
│                                                             │
│  December 2025                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Dec 5      60 min session      $45.00      Card       ││
│  └─────────────────────────────────────────────────────────┘│
│  ...                                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2. Date Range Picker Modal

```
┌─────────────────────────────────────────────────────────────┐
│                Generate Charges Summary                  ✕  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Patient: Sarah Johnson                                     │
│                                                             │
│  Date Range                                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ● 2025 (Full Year)                                     ││
│  │ ○ 2024 (Full Year)                                     ││
│  │ ○ Custom Range                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Preview                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  12 visits found                                        ││
│  │  Total paid: $600.00                                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Include:                                                   │
│  ☑ Payment method column                                   │
│  ☑ Session type column                                     │
│  ☐ Provider signature line                                 │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │            [ Generate PDF ]                             ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. PDF Preview / Share Screen

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                    Charges Summary                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              [ PDF PREVIEW ]                            ││
│  │         (Scrollable preview of the PDF)                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Sarah Johnson • 2025 • 12 visits • $600.00                │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  📥 Download │  │  📧 Email    │  │  📤 Share    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Settings: Practice Branding

```
┌─────────────────────────────────────────────────────────────┐
│  Settings                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PRACTICE INFORMATION                                       │
│  Used on patient summaries and receipts                     │
│                                                             │
│  Business Name                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Healing Touch Massage Therapy                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Address                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 123 Main Street, Suite 100                              ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Seattle, WA 98101                                       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Phone                                                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ (206) 555-1234                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Website (optional)                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ healingtouchmassage.com                                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Logo                                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [Current Logo Preview]          [ Upload New ]         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               [ Save Changes ]                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

**Recommended: Client-side PDF** using `@react-pdf/renderer`

```typescript
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';

interface ChargesSummaryProps {
  practice: Practice;
  patient: Patient;
  visits: VisitPayment[];
  dateRange: { start: string; end: string };
  totals: { visits: number; paid: number };
}

// Component renders PDF document
// See full implementation in original spec
```

**Pros:**
- No server costs
- Works offline
- Instant generation
- ~50KB bundle addition

---

## Data Types

```typescript
interface VisitPayment {
  visit_id: string;
  visit_date: string;
  service_type: string;
  amount: number;
  method: string;
}

interface ChargesSummaryRequest {
  patient_id: string;
  start_date: string;
  end_date: string;
  include_payment_method?: boolean;
  include_service_type?: boolean;
  include_signature_line?: boolean;
}

interface ChargesSummaryData {
  practice: {
    business_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip: string;
    phone: string;
    website?: string;
    logo_url?: string;
  };
  patient: {
    display_name: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  visits: VisitPayment[];
  totals: {
    visit_count: number;
    total_paid: number;
  };
  generated_at: string;
}
```

---

## Implementation Checklist

- [ ] Add practice branding fields to database
- [ ] Create Settings screen for practice info + logo upload
- [ ] Store logo in cloud storage (Supabase Storage)
- [ ] Install PDF library (`@react-pdf/renderer`)
- [ ] Create PDF template component
- [ ] Style the PDF to match mockup
- [ ] Add "Generate Summary" button to Patient → Payments tab
- [ ] Create date range picker modal
- [ ] Show preview of visits count + total before generating
- [ ] Implement "Download" (save to device)
- [ ] Implement "Share" (native share sheet)

---

## Testing Scenarios

| Test | Input | Expected |
|------|-------|----------|
| Full year | Jan 1 - Dec 31, 2025 | PDF with all visits |
| Partial year | Jul 1 - Dec 31, 2025 | Only visits from July onward |
| No visits | 2024 range | Show "No visits found" message |
| Mixed payments | Card, Cash, HSA, Check | Each method shows correctly |
| No logo | Practice without logo | PDF generates cleanly without logo |

---

# CONSOLIDATED IMPLEMENTATION PLAN

## Week 1: Portals + Foundation

| Day | Task |
|-----|------|
| 1 | Create portals table, seed data, CRUD API |
| 2 | Manage Portals settings screen + modal |
| 3 | Integrate portal dropdown into claims form |
| 4 | Add practice branding fields to database |
| 5 | Create Practice Info settings screen |

## Week 2: Enhanced Referrals

| Day | Task |
|-----|------|
| 1 | Update referrals table, create physicians table |
| 2 | Create enhanced referral form (all fields) |
| 3 | Add code inputs with suggestions (ICD-10, CPT) |
| 4 | Physician auto-complete from previous referrals |
| 5 | Update referral list UI + dashboard alerts |

## Week 3: PDF Generation + Polish

| Day | Task |
|-----|------|
| 1 | Install @react-pdf/renderer, create template |
| 2 | Style PDF, add logo support |
| 3 | Add "Generate Summary" button + date picker |
| 4 | Implement download + share functionality |
| 5 | Testing, edge cases, polish |

---

# EXCLUDED FEATURES (Require HIPAA)

The following features are NOT included in this spec:

- ❌ Referral document upload (PDFs contain PHI)
- ❌ SOAP notes storage
- ❌ Treatment descriptions
- ❌ Diagnosis history
- ❌ Medical condition tracking
- ❌ Insurance EOB document storage

These will be added in a future HIPAA-compliant tier.

---

# MARKET CONTEXT (From Jess Meeting)

| Insight | Implication |
|---------|-------------|
| 4 other LMTs in her building use same binder system | 5 potential users, keep UI simple |
| They're not tech savvy (15+ years experience) | Don't overwhelm with features |
| Jess pays $30-45/mo for Acuity, disappointed | Price anchor for your app |
| 110 patients, 80-90 active | Good scale for production testing |

---

**End of Consolidated Spec**
