# BodyWorkFlow Update: Insurance Benefits & Collection Calculator
## Requirements from Jess's Feedback

---

## Summary of Changes

Based on Jess's email, implement these updates:

1. **Rename "Copay" to "Collect"** throughout the app
2. **Add Insurance Benefits fields** to patient profile
3. **Add Insurance Notes field** for free-form benefit notes (Jess's current workflow)
4. **Add Collection Calculator** that auto-calculates what to collect
5. **Track deductible/OOP progress** per patient

**Important:** The notes field and calculator work TOGETHER. Jess can use the calculator for automatic calculations, but still has her notes field for:
- Complex situations the calculator can't handle
- Reminders about patient-specific quirks
- Her shorthand notation she's used to (e.g., "PCY = Per Calendar Year")
- Anything else she wants to remember

---

## Change 1: Terminology Update

Find and replace these labels throughout the app:

| Current | New |
|---------|-----|
| Today's Copays | Today's Collections |
| Default Copay | Default Collect |
| Copay: $45 | Collect: $45 |
| $527 copays | $527 collected |

**Note:** Keep internal variable/column names unchanged to avoid breaking changes. Only update display labels.

---

## Change 2: Patient Insurance Benefits

### Database Schema

Add new table to store insurance benefit details per patient:

```sql
CREATE TABLE patient_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  
  -- Plan timing
  plan_year_type VARCHAR(20) DEFAULT 'calendar', -- 'calendar' or 'custom'
  plan_year_start DATE, -- Only used if plan_year_type = 'custom'
  
  -- Deductible tracking
  deductible_amount DECIMAL(10,2) DEFAULT 0, -- Annual deductible (e.g., $625)
  deductible_paid DECIMAL(10,2) DEFAULT 0,   -- Amount paid toward deductible so far
  
  -- Coinsurance (after deductible is met)
  coinsurance_percent INTEGER DEFAULT 0, -- e.g., 10, 20, 30
  
  -- Out-of-pocket maximum
  oop_max DECIMAL(10,2) DEFAULT 0,  -- Annual OOP max (e.g., $1,500)
  oop_paid DECIMAL(10,2) DEFAULT 0, -- Amount paid toward OOP so far
  
  -- Allowed amount (what insurance approves for massage therapy)
  allowed_amount DECIMAL(10,2) DEFAULT 0, -- e.g., $88
  
  -- Notes field for anything else
  notes TEXT, -- Free-form notes for complex situations
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One benefits record per patient
  UNIQUE(patient_id)
);

-- Index for quick lookups
CREATE INDEX idx_patient_benefits_patient_id ON patient_benefits(patient_id);
```

### Data Model

```typescript
interface PatientBenefits {
  id: string;
  patient_id: string;
  
  // Plan timing
  plan_year_type: 'calendar' | 'custom';
  plan_year_start: string | null; // ISO date
  
  // Deductible
  deductible_amount: number;
  deductible_paid: number;
  
  // Coinsurance
  coinsurance_percent: number;
  
  // Out-of-pocket
  oop_max: number;
  oop_paid: number;
  
  // Allowed amount
  allowed_amount: number;
  
  // Notes
  notes: string | null;
  
  created_at: string;
  updated_at: string;
}
```

---

## Change 3: Collection Calculator Logic

### Core Calculation Function

```typescript
interface BenefitsInput {
  deductible_amount: number;
  deductible_paid: number;
  coinsurance_percent: number;
  oop_max: number;
  oop_paid: number;
  allowed_amount: number;
}

interface CollectionResult {
  collect_amount: number;
  reason: string;
  explanation: string;
  
  // Status indicators
  deductible_met: boolean;
  oop_met: boolean;
  
  // Remaining amounts
  deductible_remaining: number;
  oop_remaining: number;
  
  // What this payment applies to
  applies_to_deductible: number;
  applies_to_coinsurance: number;
}

function calculateCollection(benefits: BenefitsInput): CollectionResult {
  const {
    deductible_amount,
    deductible_paid,
    coinsurance_percent,
    oop_max,
    oop_paid,
    allowed_amount
  } = benefits;

  // Calculate remaining amounts
  const deductible_remaining = Math.max(0, deductible_amount - deductible_paid);
  const oop_remaining = Math.max(0, oop_max - oop_paid);
  
  const deductible_met = deductible_remaining <= 0;
  const oop_met = oop_remaining <= 0;

  // CASE 1: Out-of-pocket maximum is met → Collect $0
  if (oop_met) {
    return {
      collect_amount: 0,
      reason: "OOP Met",
      explanation: "Out-of-pocket maximum has been met. Patient owes nothing.",
      deductible_met: true,
      oop_met: true,
      deductible_remaining: 0,
      oop_remaining: 0,
      applies_to_deductible: 0,
      applies_to_coinsurance: 0
    };
  }

  // CASE 2: Deductible NOT met → Collect full allowed amount (up to remaining)
  if (!deductible_met) {
    // Collect the lesser of: allowed amount, remaining deductible, or remaining OOP
    const collect = Math.min(allowed_amount, deductible_remaining, oop_remaining);
    
    // Round to 2 decimal places
    const collect_rounded = Math.round(collect * 100) / 100;
    
    return {
      collect_amount: collect_rounded,
      reason: "Deductible",
      explanation: `Deductible not met. $${deductible_remaining.toFixed(2)} remaining. Collect full allowed amount.`,
      deductible_met: false,
      oop_met: false,
      deductible_remaining: Math.round((deductible_remaining - collect_rounded) * 100) / 100,
      oop_remaining: Math.round((oop_remaining - collect_rounded) * 100) / 100,
      applies_to_deductible: collect_rounded,
      applies_to_coinsurance: 0
    };
  }

  // CASE 3: Deductible MET → Collect coinsurance percentage
  const coinsurance_amount = allowed_amount * (coinsurance_percent / 100);
  
  // Don't exceed remaining OOP
  const collect = Math.min(coinsurance_amount, oop_remaining);
  
  // Round to 2 decimal places
  const collect_rounded = Math.round(collect * 100) / 100;
  
  return {
    collect_amount: collect_rounded,
    reason: `${coinsurance_percent}% Coinsurance`,
    explanation: `Deductible met. Patient pays ${coinsurance_percent}% of $${allowed_amount.toFixed(2)} allowed amount.`,
    deductible_met: true,
    oop_met: false,
    deductible_remaining: 0,
    oop_remaining: Math.round((oop_remaining - collect_rounded) * 100) / 100,
    applies_to_deductible: 0,
    applies_to_coinsurance: collect_rounded
  };
}
```

### Example Calculations

**Jess's Example 1:**
```typescript
calculateCollection({
  deductible_amount: 625,
  deductible_paid: 0,      // Not met yet
  coinsurance_percent: 10,
  oop_max: 1500,
  oop_paid: 0,
  allowed_amount: 90
});

// Result:
// {
//   collect_amount: 90.00,
//   reason: "Deductible",
//   explanation: "Deductible not met. $625.00 remaining. Collect full allowed amount.",
//   ...
// }
```

**Jess's Example 2:**
```typescript
calculateCollection({
  deductible_amount: 625,
  deductible_paid: 625,    // MET
  coinsurance_percent: 10,
  oop_max: 1500,
  oop_paid: 625,
  allowed_amount: 88
});

// Result:
// {
//   collect_amount: 8.80,
//   reason: "10% Coinsurance",
//   explanation: "Deductible met. Patient pays 10% of $88.00 allowed amount.",
//   ...
// }
```

**Jess's Example 3:**
```typescript
calculateCollection({
  deductible_amount: 1650,
  deductible_paid: 1650,   // MET
  coinsurance_percent: 20,
  oop_max: 5000,
  oop_paid: 1650,
  allowed_amount: 88
});

// Result:
// {
//   collect_amount: 17.60,
//   reason: "20% Coinsurance",
//   explanation: "Deductible met. Patient pays 20% of $88.00 allowed amount.",
//   ...
// }
```

---

## Change 4: UI Components

### 4A: Patient Benefits Section (Patient Detail Screen)

Add a new "Benefits" tab or section to the Patient Detail screen.

**Key Design Principle:** The NOTES field should be prominent and always visible - not hidden at the bottom. Jess is used to quick-reference notes, so make them easy to see at a glance.

```
┌─────────────────────────────────────────────────────────────┐
│  Insurance Benefits                            [Edit]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  💰 COLLECT TODAY: $88.00                               ││
│  │  Reason: Deductible not met ($175 remaining)            ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  📝 BENEFIT NOTES                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Ded $625 // Coins. 10% // $1,500 OOP PCY               ││
│  │ Collect $90 until Ded. is met then OOP of 10%          ││
│  │ Currently collect $8.80                                 ││
│  │                                                         ││
│  │ ** Patient prefers text reminders day before appt **   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  DEDUCTIBLE                          COINSURANCE            │
│  ┌─────────────────────────┐        ┌─────────────────────┐ │
│  │ $450 / $625             │        │ 10%                 │ │
│  │ ▓▓▓▓▓▓▓▓▓░░░░  72%     │        │ after deductible    │ │
│  │ $175 remaining          │        └─────────────────────┘ │
│  └─────────────────────────┘                                │
│                                                             │
│  OUT-OF-POCKET MAX                   ALLOWED AMOUNT         │
│  ┌─────────────────────────┐        ┌─────────────────────┐ │
│  │ $450 / $1,500           │        │ $88.00              │ │
│  │ ▓▓▓▓░░░░░░░░░  30%     │        │ per visit           │ │
│  │ $1,050 remaining        │        └─────────────────────┘ │
│  └─────────────────────────┘                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Notes Field Purpose:**
The notes field is for Jess's existing workflow. Even with the calculator, she may want to record:
- Her shorthand notation (e.g., "PCY = Per Calendar Year", "Ded $625 // Coins. 10%")
- Complex benefit situations the calculator can't handle
- Patient-specific reminders ("prefers morning appointments")
- Historical context ("deductible met as of 3/15")
- Override explanations ("insurance changed mid-year")

The notes should support multi-line text and be easily editable inline or via tap-to-edit.

### 4B: Edit Benefits Modal

When user taps [Edit] on the Benefits section:

```
┌─────────────────────────────────────────────────────────────┐
│                    Edit Insurance Benefits              ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Plan Year                                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ○ Calendar Year (resets Jan 1)                         ││
│  │ ● Custom Start Date: [ May 1 ]                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Deductible                                                 │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Annual: $[625.00   ] │  │ Paid: $[450.00    ]  │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                             │
│  Coinsurance                                                │
│  ┌──────────────────────┐                                  │
│  │ [10] %               │  (patient pays after deductible) │
│  └──────────────────────┘                                  │
│                                                             │
│  Out-of-Pocket Maximum                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ Annual: $[1500.00  ] │  │ Paid: $[450.00    ]  │        │
│  └──────────────────────┘  └──────────────────────┘        │
│                                                             │
│  Allowed Amount (per visit)                                 │
│  ┌──────────────────────┐                                  │
│  │ $[88.00           ]  │  (what insurance approves)       │
│  └──────────────────────┘                                  │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  📝 Benefit Notes                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Ded $625 // Coins. 10% // $1,500 OOP PCY               ││
│  │ Collect $90 until Ded. is met then OOP of 10%          ││
│  │ Currently collect $8.80                                 ││
│  │                                                         ││
│  │ ** Patient prefers text reminders **                   ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│  Use for your shorthand, reminders, or complex situations  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               [ Save Benefits ]                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Notes field characteristics:**
- Multi-line textarea (at least 4-5 lines visible)
- Supports Jess's shorthand notation
- Persists exactly what she types (no auto-formatting)
- Visible on main Benefits view without needing to open Edit modal

### 4C: Collection Display on Add Visit / Today's Visits

When viewing today's schedule or adding a visit, show the calculated collect amount:

```
┌─────────────────────────────────────────────────────────────┐
│  Today's Visits                               View All →    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ● Sarah M.                                                 │
│    Blue Cross • 10:00 AM                                    │
│    ┌────────────────────────────────┐                       │
│    │ Collect: $88.00  (Deductible)  │                       │
│    └────────────────────────────────┘                       │
│                                                             │
│  ● Mike R.                                                  │
│    Regence • 11:30 AM                                       │
│    ┌────────────────────────────────┐                       │
│    │ Collect: $8.80  (10% Coins.)   │                       │
│    └────────────────────────────────┘                       │
│                                                             │
│  ● Carlos S.                                                │
│    Self Pay • 1:00 PM                                       │
│    ┌────────────────────────────────┐                       │
│    │ Collect: $90.00  (FFS)         │                       │
│    └────────────────────────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4D: Quick Update After Visit

When recording a payment, optionally update the deductible/OOP tracking:

```
┌─────────────────────────────────────────────────────────────┐
│                    Record Payment                       ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Patient: Sarah M.                                          │
│  Suggested: $88.00 (Deductible not met)                    │
│                                                             │
│  Amount Collected                                           │
│  ┌──────────────────────┐                                  │
│  │ $[88.00           ]  │                                  │
│  └──────────────────────┘                                  │
│                                                             │
│  Payment Method                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Card ▼]                                               ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ☑ Update patient's deductible tracking                    │
│    (Add $88.00 to deductible paid)                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               [ Save Payment ]                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Change 5: Handle Special Cases

### Cash / Fee-For-Service (FFS) Patients

For patients marked as "Self Pay" or "Cash", skip the benefits calculation entirely:

```typescript
function getCollectAmount(patient: Patient, benefits: PatientBenefits | null): CollectionResult {
  // If no insurance or self-pay, use default collect amount
  if (!patient.insurance || patient.insurance.toLowerCase() === 'self pay' || patient.insurance.toLowerCase() === 'cash') {
    return {
      collect_amount: patient.default_collect || 90, // FFS rate
      reason: "FFS",
      explanation: "Fee for Service / Self Pay",
      deductible_met: true,
      oop_met: true,
      deductible_remaining: 0,
      oop_remaining: 0,
      applies_to_deductible: 0,
      applies_to_coinsurance: 0
    };
  }
  
  // If no benefits set up yet, use default collect
  if (!benefits || !benefits.allowed_amount) {
    return {
      collect_amount: patient.default_collect || 0,
      reason: "Default",
      explanation: "No benefits configured. Using default collect amount.",
      deductible_met: false,
      oop_met: false,
      deductible_remaining: 0,
      oop_remaining: 0,
      applies_to_deductible: 0,
      applies_to_coinsurance: 0
    };
  }
  
  // Calculate based on benefits
  return calculateCollection(benefits);
}
```

### Plan Year Reset

Add a utility to check if benefits should reset:

```typescript
function shouldResetBenefits(benefits: PatientBenefits): boolean {
  const now = new Date();
  const lastUpdate = new Date(benefits.updated_at);
  
  if (benefits.plan_year_type === 'calendar') {
    // Reset if we're in a new calendar year
    return now.getFullYear() > lastUpdate.getFullYear();
  } else if (benefits.plan_year_start) {
    // Reset if we've passed the custom plan year start
    const planStart = new Date(benefits.plan_year_start);
    planStart.setFullYear(now.getFullYear());
    
    // If plan start already passed this year and last update was before it
    if (now >= planStart && lastUpdate < planStart) {
      return true;
    }
  }
  
  return false;
}

function resetBenefitsIfNeeded(benefits: PatientBenefits): PatientBenefits {
  if (shouldResetBenefits(benefits)) {
    return {
      ...benefits,
      deductible_paid: 0,
      oop_paid: 0,
      updated_at: new Date().toISOString()
    };
  }
  return benefits;
}
```

---

## Change 6: Update Add Patient Modal

Add a "Payment Type" selector to simplify the initial setup:

```
┌─────────────────────────────────────────────────────────────┐
│                    Add New Patient                      ✕   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Display Name *                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Janet J.                                                ││
│  └─────────────────────────────────────────────────────────┘│
│  Use an alias - no real names for privacy                   │
│                                                             │
│  Payment Type                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ ● Insurance                                             ││
│  │ ○ Self Pay / Cash ($90)                                 ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ─── Insurance Details (if Insurance selected) ───          │
│                                                             │
│  Insurance                                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Blue Cross                                              ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Default Collect                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ $56                                                     ││
│  └─────────────────────────────────────────────────────────┘│
│  (Can set up full benefits later in patient profile)       │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │               [ Add Patient ]                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Quick Wins (Do First)
- [ ] Rename "Copay" to "Collect" in all UI labels
- [ ] Add `notes` TEXT field to patient_benefits table (or patients table if benefits table doesn't exist yet)
- [ ] Display benefit notes prominently on Patient Detail screen (not hidden in modal)
- [ ] Make notes inline-editable or easy to access

### Phase 2: Benefits Structure
- [ ] Create `patient_benefits` table with all fields including notes
- [ ] Create PatientBenefits TypeScript interface
- [ ] Add API endpoints for CRUD operations on benefits

### Phase 3: Calculator
- [ ] Implement `calculateCollection()` function
- [ ] Implement `getCollectAmount()` wrapper for different patient types
- [ ] Add unit tests for calculation edge cases

### Phase 4: Benefits UI
- [ ] Add "Benefits" section/tab to Patient Detail screen
- [ ] Create Edit Benefits modal
- [ ] Display progress bars for deductible and OOP

### Phase 5: Integration
- [ ] Show calculated collect amount on Today's Visits
- [ ] Show calculated collect amount when adding a visit
- [ ] Add "Update deductible tracking" checkbox when recording payment
- [ ] Implement plan year reset logic

### Phase 6: Polish
- [ ] Add visual indicators for deductible almost met
- [ ] Add visual indicators for OOP almost met  
- [ ] Handle edge cases (no benefits set, self-pay, etc.)

---

## Testing Scenarios

### Test Case 1: Deductible Not Met
```
Input:
  Deductible: $625, Paid: $0
  Coinsurance: 10%
  OOP Max: $1,500, Paid: $0
  Allowed: $88

Expected:
  Collect: $88.00
  Reason: "Deductible"
```

### Test Case 2: Deductible Partially Met
```
Input:
  Deductible: $625, Paid: $600
  Coinsurance: 10%
  OOP Max: $1,500, Paid: $600
  Allowed: $88

Expected:
  Collect: $25.00 (only $25 remaining on deductible)
  Reason: "Deductible"
  Note: Next visit will be coinsurance
```

### Test Case 3: Deductible Met, Paying Coinsurance
```
Input:
  Deductible: $625, Paid: $625
  Coinsurance: 10%
  OOP Max: $1,500, Paid: $625
  Allowed: $88

Expected:
  Collect: $8.80
  Reason: "10% Coinsurance"
```

### Test Case 4: OOP Max Met
```
Input:
  Deductible: $625, Paid: $625
  Coinsurance: 10%
  OOP Max: $1,500, Paid: $1,500
  Allowed: $88

Expected:
  Collect: $0.00
  Reason: "OOP Met"
```

### Test Case 5: Self Pay Patient
```
Input:
  Insurance: "Self Pay"
  Default Collect: $90

Expected:
  Collect: $90.00
  Reason: "FFS"
```

### Test Case 6: Edge Case - Payment Would Exceed OOP
```
Input:
  Deductible: $625, Paid: $625
  Coinsurance: 20%
  OOP Max: $1,500, Paid: $1,495
  Allowed: $88

Expected:
  Collect: $5.00 (capped at remaining OOP, not full $17.60)
  Reason: "20% Coinsurance"
  Note: Next visit should be $0
```

---

## Summary

This update transforms the app from simple copay tracking to a smart collection calculator that:

1. **Stores insurance benefit details** per patient (deductible, coinsurance, OOP max, allowed amount)
2. **Keeps a prominent notes field** for Jess's shorthand, reminders, and complex situations
3. **Auto-calculates** what to collect based on deductible/coinsurance status
4. **Tracks progress** toward deductible and out-of-pocket max
5. **Handles all patient types**: insurance, self-pay, various benefit structures
6. **Shows the math** so Jess understands why the amount is what it is

**Key principle:** The calculator and notes work TOGETHER. The calculator handles the math; the notes handle everything else (context, reminders, edge cases, her existing shorthand notation).

Jess can still use her familiar notation like "Ded $625 // Coins. 10% // $1,500 OOP PCY" in the notes field, while the app does the actual calculation for her.
