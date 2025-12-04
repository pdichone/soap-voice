# BodyWorkFlow Expansion
## Multi-Practice Type Architecture for LMT Practice Management

---

## Context

This is **BodyWorkFlow** - a practice management PWA for Licensed Massage Therapists (LMTs). The app is currently built and functional, designed for an insurance-billing LMT named Jess.

Before making any changes, familiarize yourself with the existing codebase structure, tech stack, database schema, and component patterns already in use.

### Current Features (Insurance-Billing LMT)
The app currently supports these features for insurance-billing massage therapists:

**Dashboard:**
- Today's visits count and list
- Today's copays (expected vs collected)
- Pending claims count with dollar amount
- Referral alerts with progress bars (visits used/allowed)
- Today's payments with method icons (Card/HSA/Cash)
- Weekly snapshot (visits, collected, claims paid)
- Quick actions (Add Visit, Submit Claim, New Client, New Referral)

**Patients/Clients:**
- Patient list with insurer and default copay
- Search functionality
- Add patient modal (display name as alias for privacy, insurance, default copay)
- Patient detail view with stats (visits, pending claims, referrals)
- Tabbed interface: Visits | Claims | Referrals | Payments

**Visits:**
- Visit list grouped by date
- Insurance badge per visit
- Add Visit functionality

**Claims:**
- List view and "By Portal" view
- Pending/Completed tabs
- Portal filter dropdown (Office Ally, Availity, One Health Port, etc.)
- Claim details with portal badge, status (Paid/Denied)
- File Appeal button for denied claims
- New Claim modal (patient picker, portal, billed amount, notes)

**Reports:**
- This week / This month / Year to date earnings
- Monthly breakdown (visits and copays per month)
- Payment method breakdown with percentages and progress bars
- Export CSV functionality

**Bottom Navigation:**
Dashboard | Patients | Visits | Claims | Reports

---

## Expansion Requirements

The app needs to be expanded to support THREE different practice types while maintaining a single codebase:

### Practice Type 1: Cash-Only LMT (e.g., "Tina")
**Profile:** 
- Does NOT take insurance (not HIPAA-bound)
- Self-pay clients only
- Hates paperwork, wants simplicity
- Needs digital intake forms with custom health questions
- Wants electronic SOAP notes attached to visits
- Accepts multiple payment methods: Cash, Card, Check, Venmo, CashApp, Apple Pay
- Wants card-on-file for no-show protection
- Needs payment categorization for bookkeeping/taxes
- May eventually open a massage school

**Tina's specific intake questions she wants digitized:**
1. What brings you in?
2. Did someone refer you? Why?
3. Health history:
   - Accidents
   - Surgeries
   - Pregnancies / Labor and deliveries
   - Scars / Broken bones
   - Head hits, concussions or not
   - Hard falls on the behind
   - Serious illnesses (Covid, bronchitis, pneumonia)
4. How is your digestion?
5. How are your periods? (cramps, PMS, heavy bleeding, too many days, very light, irregular)
6. What medications are you taking?
7. Have you noticed any side effects?
8. Pain levels (1-10) for areas of concern (for accident cases)
9. Assessment notes for "listening" / areas of restriction (Barral visceral work)

### Practice Type 2: Insurance-Billing LMT (e.g., "Jess") - CURRENT
**Profile:**
- Bills insurance through clearinghouses (Office Ally, etc.)
- HIPAA-bound (covered entity)
- Tracks claims, referrals, copays
- Multiple payers with different visit limits
- Needs portal-specific claim tracking
- Current app functionality is designed for this user

### Practice Type 3: Massage School / Student Clinic (Future)
**Profile:**
- Multiple practitioners (students + supervisors)
- Students need supervisor approval for notes
- Clinic-wide scheduling and reporting
- Shared intake form templates
- Role-based access (Admin, Supervisor, Student)
- Aggregate reporting across all practitioners

---

## Architecture Requirements

### 1. Practice Type Configuration

Create a practice type system that controls:
- Which features are visible/hidden
- Which navigation items appear
- Which dashboard cards are shown
- Which client detail tabs are available
- Terminology (Patients vs Clients)

```typescript
type PracticeType = 'cash_only' | 'insurance' | 'school';

interface PracticeConfig {
  type: PracticeType;
  features: {
    claims: boolean;
    referrals: boolean;
    intakeForms: boolean;
    soapNotes: boolean;
    cardOnFile: boolean;
    noShowPolicy: boolean;
    multiUser: boolean;
    supervisorApproval: boolean;
  };
  terminology: {
    client: 'Client' | 'Patient';
    visit: 'Session' | 'Visit' | 'Appointment';
  };
  paymentMethods: PaymentMethod[];
}
```

### 2. Conditional UI Components

The app should render different experiences based on practice type:

**Dashboard - Cash-Only:**
- Today's Sessions (not "Visits")
- Today's Revenue (not "Copays")
- HIDE: Pending Claims card
- HIDE: Referral Alerts card
- SHOW: Upcoming Intakes (clients without completed intake)
- SHOW: Recent Notes (quick access to add session notes)

**Dashboard - Insurance (current):**
- Keep as-is

**Dashboard - School:**
- Today's Clinic Sessions (aggregate)
- Pending Approvals (notes awaiting supervisor review)
- Student Activity summary
- Clinic Revenue

**Bottom Navigation - Cash-Only:**
```
[ Dashboard ] [ Clients ] [ Sessions ] [ Payments ] [ Reports ]
```

**Bottom Navigation - Insurance (current):**
```
[ Dashboard ] [ Patients ] [ Visits ] [ Claims ] [ Reports ]
```

**Bottom Navigation - School:**
```
[ Dashboard ] [ Clients ] [ Schedule ] [ Students ] [ Reports ]
```

**Client Detail Tabs - Cash-Only:**
```
[ Intake ] [ Sessions ] [ Notes ] [ Payments ]
```

**Client Detail Tabs - Insurance (current):**
```
[ Visits ] [ Claims ] [ Referrals ] [ Payments ]
```

### 3. New Features to Build

#### A. Intake Forms System
- Customizable intake form builder (start with Tina's questions as default template)
- Send intake form link to client via SMS/email before appointment
- Client fills out on their phone (mobile-optimized form)
- Form responses save to client profile
- Intake completion status visible on client list
- Support for:
  - Text fields (short and long)
  - Multiple choice
  - Checkboxes
  - Pain scale (1-10 slider)
  - Body diagram (tap to mark areas) - stretch goal
  - Date fields
  - Signature capture

#### B. SOAP Notes / Session Notes
- Attach notes to each visit/session
- For Cash-Only: Flexible freeform + optional structured fields
- For Insurance: Standard SOAP format (Subjective, Objective, Assessment, Plan)
- For School: SOAP with supervisor approval workflow
- Fields:
  - Subjective: Client's reported symptoms/concerns
  - Objective: Therapist's observations, ROM, palpation findings
  - Assessment: Areas of restriction, trigger points, tissue quality
  - Plan: Treatment provided, home care recommendations, follow-up
  - Custom fields (JSON) for practice-specific notes like "Barral listening assessment"

#### C. Expanded Payment Methods
Add to existing payment tracking:
- Venmo
- CashApp  
- Apple Pay
- Check
- Zelle
- Other (custom label)

Update Reports to include all methods in breakdown.

#### D. Card on File
- Stripe integration for saving payment methods
- Client can add card during intake or in-app
- "Save card for future payments" checkbox
- Card selection at checkout
- Secure card display (last 4 + brand only)

#### E. No-Show Policy Agreement
- Digital agreement during intake flow
- Customizable policy text
- Signature capture
- Agreement stored with timestamp and IP
- Ability to charge no-show fee to card on file

#### F. Multi-User Support (School - Phase 2)
- Practice/Clinic has multiple user accounts
- Roles: Admin, Supervisor, Practitioner (Student)
- Students can only see their own clients/sessions
- Supervisors can see all + approve notes
- Admin can see all + manage users + view aggregate reports
- Invitation system for adding users

---

## Database Schema Additions

Add these tables/fields to support the new features. Adapt the SQL syntax to match the existing database (Supabase PostgreSQL, Firebase, etc.):

```sql
-- Practice settings (add to existing practices/users table or create new)
-- Add practice_type field to control which features are enabled
ALTER TABLE practices ADD COLUMN practice_type VARCHAR(20) DEFAULT 'insurance';
-- Values: 'cash_only', 'insurance', 'school'

ALTER TABLE practices ADD COLUMN settings JSONB DEFAULT '{}';
-- Store feature flags, terminology preferences, custom configurations
-- Store feature flags, terminology preferences, etc.

-- Intake form templates
CREATE TABLE intake_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  fields JSONB NOT NULL, -- Array of field definitions
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Intake form responses
CREATE TABLE intake_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  client_id UUID REFERENCES clients(id),
  template_id UUID REFERENCES intake_templates(id),
  responses JSONB NOT NULL, -- Key-value pairs matching template fields
  completed_at TIMESTAMPTZ,
  signature_url TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session/Visit notes (SOAP notes)
CREATE TABLE session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  visit_id UUID REFERENCES visits(id),
  client_id UUID REFERENCES clients(id),
  practitioner_id UUID REFERENCES users(id), -- For multi-user/school
  
  -- SOAP fields
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  
  -- Flexible custom fields
  custom_fields JSONB DEFAULT '{}',
  
  -- For school: approval workflow
  status VARCHAR(20) DEFAULT 'draft', -- draft, pending_approval, approved, revision_requested
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  revision_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client payment methods (card on file)
CREATE TABLE client_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  client_id UUID REFERENCES clients(id),
  stripe_customer_id VARCHAR(255),
  stripe_payment_method_id VARCHAR(255),
  card_brand VARCHAR(50),
  card_last_four VARCHAR(4),
  card_exp_month INTEGER,
  card_exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client agreements (no-show policy, consent forms)
CREATE TABLE client_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  client_id UUID REFERENCES clients(id),
  agreement_type VARCHAR(50) NOT NULL, -- 'no_show_policy', 'intake_consent', 'hipaa_consent'
  agreement_version VARCHAR(20),
  agreement_text TEXT, -- Snapshot of policy at time of signing
  signed_at TIMESTAMPTZ NOT NULL,
  signature_url TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expand payment methods enum/field
-- Update existing payments table
ALTER TABLE payments 
  ALTER COLUMN method TYPE VARCHAR(50);
-- Now supports: 'card', 'cash', 'check', 'hsa', 'venmo', 'cashapp', 'applepay', 'zelle', 'other'

-- For school: user roles within a practice
CREATE TABLE practice_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id UUID REFERENCES practices(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) NOT NULL, -- 'admin', 'supervisor', 'practitioner'
  is_active BOOLEAN DEFAULT true,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(practice_id, user_id)
);
```

---

## Implementation Phases

### Phase 1: Foundation (Do First)
1. Add `practice_type` field to practice/user settings
2. Create `PracticeConfig` context/provider that determines feature visibility
3. Update navigation to conditionally show/hide items based on practice type
4. Update dashboard to show/hide cards based on practice type
5. Add practice type selection in Settings screen
6. Update terminology throughout app based on practice type

### Phase 2: Cash-Only Features (Tina's Needs)
1. Add expanded payment methods (Venmo, CashApp, Check, etc.)
2. Update Reports payment breakdown to include new methods
3. Build Intake Forms system:
   - Create default template with Tina's questions
   - Build intake form renderer (client-facing)
   - Build intake response viewer (in client detail)
   - Add "Send Intake" action to client
   - Add "Intake" tab to client detail (Cash-Only)
4. Build Session Notes:
   - Add notes to visit detail
   - Simple freeform + optional structured fields
   - Add "Notes" tab to client detail (Cash-Only)

### Phase 3: Payment & Policy Features
1. Stripe integration for card on file
2. Add payment method management to client detail
3. Build no-show policy agreement flow
4. Integrate into intake form flow
5. Add ability to charge card on file

### Phase 4: School Features (Future)
1. Multi-user support with roles
2. Supervisor approval workflow for notes
3. Student management screen
4. Aggregate reporting
5. Clinic scheduling view

---

## UI/UX Guidelines

### Keep Consistent With Existing Design
- Maintain the current color scheme (green header, warm neutrals)
- Keep the same card styling with subtle shadows
- Use existing button styles (primary green, secondary outline)
- Maintain bottom navigation pattern
- Keep modal patterns for forms (like Add Patient modal)

### Mobile-First
- All new features must work great on mobile
- Touch-friendly tap targets (minimum 44px)
- Thumb-friendly bottom navigation
- Forms should be easy to fill on phone

### Simplicity for Cash-Only Users
- Tina hates paperwork - keep it simple
- Don't overwhelm with options
- Smart defaults
- Minimal required fields

---

## Testing Scenarios

### Test as Jess (Insurance LMT):
- All current functionality should work unchanged
- Claims, referrals, portal tracking all visible
- Dashboard shows copays, pending claims, referral alerts

### Test as Tina (Cash-Only LMT):
- No claims or referrals anywhere in UI
- Dashboard shows revenue (not copays), no claims card
- Client detail shows Intake, Sessions, Notes, Payments tabs
- Can send intake form to client
- Can add session notes to visits
- Can track payments by method including Venmo, CashApp
- Reports show all payment methods

### Test as School Admin (Future):
- Can see all students and their activity
- Can approve/reject student notes
- Aggregate reporting across clinic

---

## File Structure Suggestion

Follow existing project conventions. If adding new directories, consider this organization:

```
/components
  /dashboard
    DashboardCashOnly.tsx
    DashboardInsurance.tsx (existing)
    DashboardSchool.tsx
  /intake
    IntakeFormBuilder.tsx
    IntakeFormRenderer.tsx
    IntakeResponseViewer.tsx
  /notes
    SessionNoteForm.tsx
    SessionNoteViewer.tsx
    SOAPNoteForm.tsx
  /payments
    PaymentMethodSelector.tsx
    CardOnFileManager.tsx
    NoShowPolicyAgreement.tsx
/contexts (or wherever state management lives)
  PracticeConfigContext.tsx
/hooks
  usePracticeConfig.ts
  useFeatureFlag.ts
/types
  practiceTypes.ts
```

Adapt this to match existing project structure.

---

## Success Criteria

1. **Jess (Insurance LMT)** sees no change to her current experience
2. **Tina (Cash-Only LMT)** can:
   - Send intake forms to clients before appointments
   - Add quick session notes after each visit
   - Track payments by method (Card/Cash/Venmo/CashApp/Check)
   - Store card on file for no-shows
   - Export payment reports for taxes
3. **Practice type switching** works smoothly in settings
4. **Single codebase** serves all practice types
5. **School features** have clear hooks for future implementation

---

## Before Starting

1. Review the existing database schema and understand current table structures
2. Identify the existing settings/preferences implementation
3. Note the current state management approach (Context, Redux, Zustand, etc.)
4. Check for any existing form libraries in use (React Hook Form, Formik, etc.)
5. Review existing component patterns and styling conventions

Follow the existing patterns and conventions when adding new features.

---

## Start Here

Begin with **Phase 1: Foundation** - specifically:

1. Add `practice_type` to the practice/user model in the database
2. Create a `PracticeConfigContext` (or equivalent based on existing state management) that provides feature flags to the entire app
3. Create a `useFeatureFlag('claims')` hook for conditional rendering
4. Update the bottom navigation to conditionally render based on practice type
5. Add a "Practice Type" selector in Settings (even if it just toggles the type for now)

Once that skeleton is in place, all other features can be built incrementally by checking feature flags.

**Important:** Review existing code patterns before implementing. Match the existing coding style, component structure, and state management approach.

---

## Sample Code: PracticeConfigContext

```typescript
// contexts/PracticeConfigContext.tsx
import React, { createContext, useContext, useMemo } from 'react';

type PracticeType = 'cash_only' | 'insurance' | 'school';

interface PracticeConfig {
  type: PracticeType;
  features: {
    claims: boolean;
    referrals: boolean;
    portals: boolean;
    intakeForms: boolean;
    soapNotes: boolean;
    cardOnFile: boolean;
    noShowPolicy: boolean;
    multiUser: boolean;
    supervisorApproval: boolean;
  };
  terminology: {
    client: string;
    clients: string;
    visit: string;
    visits: string;
  };
  navigation: {
    showClaims: boolean;
    showReferrals: boolean;
    showStudents: boolean;
  };
  dashboard: {
    showPendingClaims: boolean;
    showReferralAlerts: boolean;
    showUpcomingIntakes: boolean;
    showPendingApprovals: boolean;
    revenueLabel: string; // "Copays" vs "Revenue"
  };
}

const practiceConfigs: Record<PracticeType, PracticeConfig> = {
  cash_only: {
    type: 'cash_only',
    features: {
      claims: false,
      referrals: false,
      portals: false,
      intakeForms: true,
      soapNotes: true,
      cardOnFile: true,
      noShowPolicy: true,
      multiUser: false,
      supervisorApproval: false,
    },
    terminology: {
      client: 'Client',
      clients: 'Clients',
      visit: 'Session',
      visits: 'Sessions',
    },
    navigation: {
      showClaims: false,
      showReferrals: false,
      showStudents: false,
    },
    dashboard: {
      showPendingClaims: false,
      showReferralAlerts: false,
      showUpcomingIntakes: true,
      showPendingApprovals: false,
      revenueLabel: 'Revenue',
    },
  },
  insurance: {
    type: 'insurance',
    features: {
      claims: true,
      referrals: true,
      portals: true,
      intakeForms: true, // Optional but available
      soapNotes: true,   // Optional but available
      cardOnFile: true,
      noShowPolicy: true,
      multiUser: false,
      supervisorApproval: false,
    },
    terminology: {
      client: 'Patient',
      clients: 'Patients',
      visit: 'Visit',
      visits: 'Visits',
    },
    navigation: {
      showClaims: true,
      showReferrals: false, // Managed within patient detail
      showStudents: false,
    },
    dashboard: {
      showPendingClaims: true,
      showReferralAlerts: true,
      showUpcomingIntakes: false,
      showPendingApprovals: false,
      revenueLabel: 'Copays',
    },
  },
  school: {
    type: 'school',
    features: {
      claims: false,
      referrals: false,
      portals: false,
      intakeForms: true,
      soapNotes: true,
      cardOnFile: true,
      noShowPolicy: true,
      multiUser: true,
      supervisorApproval: true,
    },
    terminology: {
      client: 'Client',
      clients: 'Clients',
      visit: 'Session',
      visits: 'Sessions',
    },
    navigation: {
      showClaims: false,
      showReferrals: false,
      showStudents: true,
    },
    dashboard: {
      showPendingClaims: false,
      showReferralAlerts: false,
      showUpcomingIntakes: true,
      showPendingApprovals: true,
      revenueLabel: 'Revenue',
    },
  },
};

const PracticeConfigContext = createContext<PracticeConfig>(practiceConfigs.insurance);

export const PracticeConfigProvider: React.FC<{
  practiceType: PracticeType;
  children: React.ReactNode;
}> = ({ practiceType, children }) => {
  const config = useMemo(() => practiceConfigs[practiceType], [practiceType]);
  
  return (
    <PracticeConfigContext.Provider value={config}>
      {children}
    </PracticeConfigContext.Provider>
  );
};

export const usePracticeConfig = () => useContext(PracticeConfigContext);

export const useFeature = (feature: keyof PracticeConfig['features']) => {
  const config = usePracticeConfig();
  return config.features[feature];
};

export const useTerm = (term: keyof PracticeConfig['terminology']) => {
  const config = usePracticeConfig();
  return config.terminology[term];
};
```

---

## Sample Code: Conditional Navigation

```typescript
// components/BottomNavigation.tsx
import { usePracticeConfig } from '../contexts/PracticeConfigContext';

const BottomNavigation = () => {
  const { navigation, terminology } = usePracticeConfig();
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '◐', show: true },
    { id: 'clients', label: terminology.clients, icon: '◉', show: true },
    { id: 'visits', label: terminology.visits, icon: '▦', show: true },
    { id: 'claims', label: 'Claims', icon: '◈', show: navigation.showClaims },
    { id: 'students', label: 'Students', icon: '👥', show: navigation.showStudents },
    { id: 'reports', label: 'Reports', icon: '▤', show: true },
  ].filter(item => item.show);

  return (
    <nav className="bottom-nav">
      {navItems.map(item => (
        <NavItem key={item.id} {...item} />
      ))}
    </nav>
  );
};
```

---

Execute Phase 1 first to establish the foundation. Each subsequent phase builds on the previous one. The practice type skeleton will make all other features plug in cleanly.
