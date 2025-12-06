# BodyWorkFlow: Super Admin System
## V1 Implementation Spec for Manual LMT Management

**Version:** 1.0  
**Date:** December 2025  
**Purpose:** Give Paulo full control over practitioner accounts, impersonation, and basic analytics before self-serve signup exists.

---

## Overview

For V1, you are the gatekeeper. No self-signup. You manually:
- Create practitioner accounts
- Send magic links
- Track billing
- Debug issues by impersonating users

This spec covers everything needed to manage 5-10 LMTs without chaos.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           BODYWORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐         ┌─────────────────────────────────┐   │
│  │                     │         │                                 │   │
│  │   ADMIN PORTAL      │         │   LMT APP                       │   │
│  │   /admin/*          │         │   /dashboard, /patients, etc.   │   │
│  │                     │         │                                 │   │
│  │   • Practitioners   │         │   • Patient management          │   │
│  │   • Impersonation   │         │   • Visits & payments           │   │
│  │   • Event logs      │         │   • Claims & referrals          │   │
│  │   • Billing notes   │         │   • Reports                     │   │
│  │                     │         │                                 │   │
│  └────────┬────────────┘         └──────────────┬──────────────────┘   │
│           │                                      │                      │
│           │         ┌────────────────┐          │                      │
│           └────────▶│   Supabase     │◀─────────┘                      │
│                     │                │                                  │
│                     │ • Auth         │                                  │
│                     │ • Database     │                                  │
│                     │ • RLS policies │                                  │
│                     │ • Storage      │                                  │
│                     └────────────────┘                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. Core Tables

```sql
-- ============================================================
-- PRACTITIONERS (Workspaces)
-- One row per LMT account
-- ============================================================
CREATE TABLE practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  user_id UUID REFERENCES auth.users(id),  -- Supabase auth user
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Workspace
  workspace_id UUID UNIQUE DEFAULT gen_random_uuid(),
  workspace_name VARCHAR(255),             -- "Jess's Practice"
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',     -- active, paused, suspended, churned
  
  -- Plan & Billing (manual tracking for v1)
  plan_type VARCHAR(20) DEFAULT 'trial',   -- trial, founder, standard, enterprise
  monthly_price DECIMAL(10,2),             -- 29.00, 39.00, etc.
  billing_status VARCHAR(20) DEFAULT 'trial', -- trial, paying, paused, cancelled
  trial_ends_at TIMESTAMPTZ,
  billing_started_at TIMESTAMPTZ,
  billing_notes TEXT,                      -- Free text: "Jess – $29/mo founder price forever"
  
  -- Feature Flags (simple booleans for v1)
  feature_claims_tracking BOOLEAN DEFAULT true,
  feature_year_end_summary BOOLEAN DEFAULT true,
  feature_insurance_calculator BOOLEAN DEFAULT false,
  feature_bulk_operations BOOLEAN DEFAULT false,
  
  -- Activity tracking
  last_login_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,                         -- Admin who created this account
  
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_practitioners_email ON practitioners(email);
CREATE INDEX idx_practitioners_status ON practitioners(status);
CREATE INDEX idx_practitioners_workspace ON practitioners(workspace_id);


-- ============================================================
-- ADMIN USERS
-- Separate from practitioners - these are super admins
-- ============================================================
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',        -- admin, super_admin
  is_active BOOLEAN DEFAULT true,
  
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- ADMIN EVENT LOG
-- Track admin actions and user activity
-- ============================================================
CREATE TABLE admin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who
  actor_type VARCHAR(20) NOT NULL,         -- admin, practitioner, system
  actor_id UUID,                           -- admin_user.id or practitioner.id
  actor_email VARCHAR(255),
  
  -- What
  event_type VARCHAR(50) NOT NULL,         -- See event types below
  event_category VARCHAR(30),              -- auth, patient, visit, claim, admin
  
  -- Context
  practitioner_id UUID REFERENCES practitioners(id),
  workspace_id UUID,
  
  -- Details
  description TEXT,
  metadata JSONB,                          -- Flexible extra data
  
  -- When
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_created ON admin_events(created_at DESC);
CREATE INDEX idx_events_practitioner ON admin_events(practitioner_id);
CREATE INDEX idx_events_type ON admin_events(event_type);


-- ============================================================
-- IMPERSONATION SESSIONS
-- Track when admin impersonates a user
-- ============================================================
CREATE TABLE impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  admin_id UUID REFERENCES admin_users(id) NOT NULL,
  practitioner_id UUID REFERENCES practitioners(id) NOT NULL,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- For audit
  ip_address VARCHAR(50),
  user_agent TEXT
);

CREATE INDEX idx_impersonation_admin ON impersonation_sessions(admin_id);
CREATE INDEX idx_impersonation_active ON impersonation_sessions(ended_at) WHERE ended_at IS NULL;
```

### 2. Event Types Reference

```typescript
// Event types for admin_events table
const EVENT_TYPES = {
  // Auth events
  'auth.login': 'User logged in',
  'auth.logout': 'User logged out',
  'auth.magic_link_sent': 'Magic link email sent',
  'auth.magic_link_used': 'Magic link used to login',
  
  // Admin events
  'admin.login': 'Admin logged in',
  'admin.practitioner_created': 'New practitioner account created',
  'admin.practitioner_updated': 'Practitioner account updated',
  'admin.practitioner_suspended': 'Practitioner account suspended',
  'admin.impersonation_started': 'Admin started impersonating user',
  'admin.impersonation_ended': 'Admin ended impersonation',
  'admin.magic_link_resent': 'Admin resent magic link',
  'admin.feature_flag_changed': 'Feature flag toggled',
  'admin.billing_updated': 'Billing info updated',
  
  // User activity events
  'patient.created': 'New patient added',
  'patient.updated': 'Patient info updated',
  'visit.created': 'Visit recorded',
  'visit.updated': 'Visit updated',
  'payment.recorded': 'Payment recorded',
  'claim.created': 'Claim created',
  'claim.status_changed': 'Claim status changed',
  'referral.created': 'Referral added',
  'summary.generated': 'Year-end summary generated',
};
```

### 3. Practitioner Stats View

```sql
-- View for quick practitioner stats (used in admin dashboard)
CREATE OR REPLACE VIEW practitioner_stats AS
SELECT 
  p.id,
  p.name,
  p.email,
  p.workspace_id,
  p.status,
  p.plan_type,
  p.billing_status,
  p.last_login_at,
  p.last_activity_at,
  p.created_at,
  
  -- Counts (these reference your existing tables)
  (SELECT COUNT(*) FROM patients WHERE workspace_id = p.workspace_id) as patient_count,
  (SELECT COUNT(*) FROM visits WHERE workspace_id = p.workspace_id) as visit_count,
  (SELECT COUNT(*) FROM visits WHERE workspace_id = p.workspace_id 
    AND visit_date >= CURRENT_DATE - INTERVAL '7 days') as visits_this_week,
  (SELECT COUNT(*) FROM payments WHERE workspace_id = p.workspace_id) as payment_count,
  (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE workspace_id = p.workspace_id) as total_payments,
  (SELECT COUNT(*) FROM referrals WHERE workspace_id = p.workspace_id) as referral_count,
  (SELECT COUNT(*) FROM claims WHERE workspace_id = p.workspace_id) as claim_count,
  
  -- Days since activity
  EXTRACT(DAY FROM NOW() - p.last_activity_at) as days_since_activity,
  EXTRACT(DAY FROM NOW() - p.last_login_at) as days_since_login

FROM practitioners p
WHERE p.deleted_at IS NULL;
```

---

## RLS Policies

```sql
-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Practitioners can only see their own workspace data
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Policy: Practitioners see only their workspace
CREATE POLICY "practitioners_own_data" ON patients
  FOR ALL USING (
    workspace_id = (
      SELECT workspace_id FROM practitioners 
      WHERE user_id = auth.uid()
    )
  );

-- Repeat for other tables...

-- ============================================================
-- ADMIN BYPASS
-- Admins can see everything
-- ============================================================

-- Option 1: Check admin_users table
CREATE POLICY "admin_full_access" ON patients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM admin_users 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Option 2: Check JWT claim (set during impersonation)
-- auth.jwt() ->> 'role' = 'admin'


-- ============================================================
-- IMPERSONATION HANDLING
-- When admin impersonates, they get a special JWT with:
-- - original_user_id (the admin)
-- - impersonating_workspace_id (the target workspace)
-- ============================================================

CREATE POLICY "impersonation_access" ON patients
  FOR ALL USING (
    workspace_id = (auth.jwt() ->> 'impersonating_workspace_id')::uuid
  );
```

---

## API Endpoints

### Admin Authentication

```typescript
// POST /api/admin/login
// Admin uses email/password (not magic link)
interface AdminLoginRequest {
  email: string;
  password: string;
}

interface AdminLoginResponse {
  token: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}
```

### Practitioners CRUD

```typescript
// GET /api/admin/practitioners
// List all practitioners with stats
interface ListPractitionersResponse {
  practitioners: PractitionerWithStats[];
  total: number;
}

interface PractitionerWithStats {
  id: string;
  name: string;
  email: string;
  workspace_id: string;
  workspace_name: string;
  status: 'active' | 'paused' | 'suspended' | 'churned';
  plan_type: 'trial' | 'founder' | 'standard' | 'enterprise';
  billing_status: 'trial' | 'paying' | 'paused' | 'cancelled';
  monthly_price: number | null;
  
  // Stats
  patient_count: number;
  visit_count: number;
  visits_this_week: number;
  payment_count: number;
  total_payments: number;
  referral_count: number;
  claim_count: number;
  
  // Activity
  last_login_at: string | null;
  last_activity_at: string | null;
  days_since_activity: number | null;
  days_since_login: number | null;
  login_count: number;
  
  // Feature flags
  feature_claims_tracking: boolean;
  feature_year_end_summary: boolean;
  feature_insurance_calculator: boolean;
  feature_bulk_operations: boolean;
  
  created_at: string;
}


// GET /api/admin/practitioners/:id
// Get single practitioner detail
interface PractitionerDetailResponse extends PractitionerWithStats {
  billing_notes: string | null;
  trial_ends_at: string | null;
  billing_started_at: string | null;
  created_by: string | null;
  
  // Recent events for this practitioner
  recent_events: AdminEvent[];
}


// POST /api/admin/practitioners
// Create new practitioner
interface CreatePractitionerRequest {
  name: string;
  email: string;
  workspace_name?: string;
  plan_type: 'trial' | 'founder' | 'standard';
  monthly_price?: number;
  billing_notes?: string;
  send_magic_link?: boolean;  // Send welcome email immediately
}


// PUT /api/admin/practitioners/:id
// Update practitioner
interface UpdatePractitionerRequest {
  name?: string;
  email?: string;
  workspace_name?: string;
  status?: 'active' | 'paused' | 'suspended';
  plan_type?: 'trial' | 'founder' | 'standard' | 'enterprise';
  monthly_price?: number;
  billing_status?: 'trial' | 'paying' | 'paused' | 'cancelled';
  billing_notes?: string;
  
  // Feature flags
  feature_claims_tracking?: boolean;
  feature_year_end_summary?: boolean;
  feature_insurance_calculator?: boolean;
  feature_bulk_operations?: boolean;
}
```

### Impersonation

```typescript
// POST /api/admin/impersonate/:practitioner_id
// Start impersonation session
interface ImpersonateResponse {
  session_id: string;
  token: string;              // Special JWT for impersonation
  practitioner: {
    id: string;
    name: string;
    workspace_id: string;
  };
  redirect_url: string;       // Where to redirect (e.g., /dashboard)
}


// POST /api/admin/impersonate/end
// End impersonation, return to admin
interface EndImpersonationResponse {
  admin_token: string;        // Original admin JWT
  redirect_url: string;       // Back to /admin/practitioners
}
```

### Magic Link

```typescript
// POST /api/admin/practitioners/:id/send-magic-link
// Resend magic link to practitioner
interface SendMagicLinkRequest {
  custom_message?: string;    // Optional custom message in email
}

interface SendMagicLinkResponse {
  success: boolean;
  sent_to: string;
  sent_at: string;
}
```

### Events

```typescript
// GET /api/admin/events
// Get recent events across all practitioners
interface ListEventsRequest {
  limit?: number;             // Default 50
  offset?: number;
  practitioner_id?: string;   // Filter by practitioner
  event_type?: string;        // Filter by type
  event_category?: string;    // Filter by category
  start_date?: string;
  end_date?: string;
}

interface AdminEvent {
  id: string;
  actor_type: 'admin' | 'practitioner' | 'system';
  actor_email: string | null;
  event_type: string;
  event_category: string;
  practitioner_id: string | null;
  description: string;
  metadata: Record<string, any>;
  created_at: string;
}
```

---

## UI Screens

### 1. Admin Login

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    BodyWorkFlow Admin                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                                                         ││
│  │  Email                                                  ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │ paulo@example.com                                   │││
│  │  └─────────────────────────────────────────────────────┘││
│  │                                                         ││
│  │  Password                                               ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │ ••••••••••••                                        │││
│  │  └─────────────────────────────────────────────────────┘││
│  │                                                         ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │              [ Sign In as Admin ]                   │││
│  │  └─────────────────────────────────────────────────────┘││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  This is the admin portal. LMTs should use the regular     │
│  app login at bodyworkflow.app                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**URL:** `/admin/login`

**Security:**
- Email/password auth (not magic link)
- Rate limiting on login attempts
- Admin accounts created directly in database (not self-serve)

---

### 2. Practitioners List

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BodyWorkFlow Admin                              Paulo ▼  [ Logout ]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [ Practitioners ]  [ Events ]  [ Settings ]                           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Practitioners                                   [ + Add Practitioner ] │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Filter: [ All ▼ ]  Status: [ Active ▼ ]  Plan: [ All ▼ ]          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Name          Email              Plan      Status   Activity       │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │ 🟢 Jess M.    jess@example.com   Founder   Active   Today         │ │
│  │    47 patients • 12 visits this week • $29/mo                     │ │
│  │    [ View ] [ Impersonate ] [ Send Link ]                         │ │
│  │                                                                    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │ 🟢 Tina R.    tina@example.com   Standard  Active   2 days ago    │ │
│  │    23 patients • 5 visits this week • $39/mo                      │ │
│  │    [ View ] [ Impersonate ] [ Send Link ]                         │ │
│  │                                                                    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │ 🟡 Maria S.   maria@example.com  Trial     Active   5 days ago    │ │
│  │    8 patients • 2 visits this week • Trial ends Jan 15            │ │
│  │    [ View ] [ Impersonate ] [ Send Link ]                         │ │
│  │                                                                    │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │ 🔴 Sam K.     sam@example.com    Standard  Paused   14 days ago   │ │
│  │    15 patients • 0 visits this week • Payment failed              │ │
│  │    [ View ] [ Impersonate ] [ Send Link ]                         │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Showing 4 of 4 practitioners                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**URL:** `/admin/practitioners`

**Features:**
- Color-coded status indicators (🟢 active + recent, 🟡 trial/warning, 🔴 paused/inactive)
- Quick stats per row
- Quick action buttons
- Filters for status, plan type

---

### 3. Practitioner Detail

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BodyWorkFlow Admin                              Paulo ▼  [ Logout ]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ← Back to Practitioners                                                │
│                                                                         │
│  Jess M.                                         🟢 Active              │
│  jess@example.com                                                       │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Impersonate  │  │ Send Magic   │  │ Edit Account │                  │
│  │ 👤 Log in as │  │ 📧 Link      │  │ ✏️           │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [ Overview ]  [ Activity ]  [ Billing ]  [ Features ]                 │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  OVERVIEW                                                               │
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │
│  │ PATIENTS                    │  │ VISITS                      │      │
│  │                             │  │                             │      │
│  │  47                         │  │  312 total                  │      │
│  │  total patients             │  │  12 this week               │      │
│  │                             │  │                             │      │
│  └─────────────────────────────┘  └─────────────────────────────┘      │
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │
│  │ PAYMENTS                    │  │ CLAIMS                      │      │
│  │                             │  │                             │      │
│  │  $14,250                    │  │  89 total                   │      │
│  │  total collected            │  │  3 pending                  │      │
│  │                             │  │                             │      │
│  └─────────────────────────────┘  └─────────────────────────────┘      │
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐      │
│  │ REFERRALS                   │  │ SUMMARIES                   │      │
│  │                             │  │                             │      │
│  │  23                         │  │  5                          │      │
│  │  active referrals           │  │  PDFs generated             │      │
│  │                             │  │                             │      │
│  └─────────────────────────────┘  └─────────────────────────────┘      │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  ACCOUNT INFO                                                           │
│                                                                         │
│  Workspace ID:     ws_abc123def456                                     │
│  Created:          November 15, 2025                                    │
│  Created by:       Paulo (admin)                                        │
│  Last login:       Today at 10:32 AM                                   │
│  Login count:      47                                                   │
│  Last activity:    Today at 11:15 AM                                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  RECENT ACTIVITY                                                        │
│                                                                         │
│  Today 11:15 AM    Added visit for Sarah J.                            │
│  Today 10:45 AM    Created new patient Mike R.                         │
│  Today 10:32 AM    Logged in                                           │
│  Yesterday 4:12 PM Generated year-end summary for Lisa K.              │
│  Yesterday 3:30 PM Updated claim status to "Paid"                      │
│                                                                         │
│  [ View all activity → ]                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**URL:** `/admin/practitioners/[id]`

---

### 4. Practitioner Detail - Billing Tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [ Overview ]  [ Activity ]  [ Billing ]  [ Features ]                 │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  BILLING INFORMATION                                                    │
│                                                                         │
│  Plan Type                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Founder                                                          ▼ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Monthly Price                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ $29.00                                                              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Billing Status                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Paying                                                           ▼ ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Billing Started                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ December 1, 2025                                                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Notes                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Jess – Founder pricing at $29/mo. Never increase.                  ││
│  │ Paid via Stripe. Customer ID: cus_abc123                           ││
│  │ Very engaged user, helped with early feedback.                     ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │               [ Save Billing Info ]                                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  💡 Billing is tracked manually for V1. Stripe integration coming.     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Practitioner Detail - Features Tab

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  [ Overview ]  [ Activity ]  [ Billing ]  [ Features ]                 │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FEATURE FLAGS                                                          │
│                                                                         │
│  Control which features are enabled for this practitioner.              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  Claims Tracking                                         [  ON  ]  ││
│  │  Submit and track insurance claims                                  ││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────     ││
│  │                                                                     ││
│  │  Year-End Summary PDFs                                   [  ON  ]  ││
│  │  Generate printable payment summaries for patients                  ││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────     ││
│  │                                                                     ││
│  │  Insurance Calculator                                    [ OFF  ]  ││
│  │  Calculate expected reimbursement amounts                           ││
│  │  ⚠️ Beta feature - enable for testing only                         ││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────     ││
│  │                                                                     ││
│  │  Bulk Operations                                         [ OFF  ]  ││
│  │  Bulk import/export and batch updates                               ││
│  │  ⚠️ Beta feature - enable for testing only                         ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Changes are saved automatically.                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 6. Create Practitioner Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     Add New Practitioner                            ✕   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ACCOUNT INFORMATION                                                    │
│                                                                         │
│  Name *                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Tina Rodriguez                                                      ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Email *                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ tina@healinghands.com                                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Practice Name (optional)                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Healing Hands Massage                                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  PLAN & BILLING                                                         │
│                                                                         │
│  Plan Type *                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ○ Trial (14 days free)                                              ││
│  │ ● Founder ($29/mo - early adopter rate)                             ││
│  │ ○ Standard ($39/mo)                                                 ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Monthly Price                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ $29.00                                                              ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  Billing Notes                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Referred by Jess. Founder pricing.                                  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ─────────────────────────────────────────────────────────────────     │
│                                                                         │
│  ☑ Send welcome email with magic link immediately                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │               [ Create Practitioner ]                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 7. Events Log

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BodyWorkFlow Admin                              Paulo ▼  [ Logout ]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [ Practitioners ]  [ Events ]  [ Settings ]                           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Event Log                                                              │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Filter: [ All Users ▼ ]  Type: [ All Events ▼ ]  [ Last 7 days ▼] │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                                                                    │ │
│  │  Today                                                             │ │
│  │                                                                    │ │
│  │  11:15 AM   Jess M.        Added visit for Sarah J.               │ │
│  │  10:45 AM   Jess M.        Created new patient Mike R.            │ │
│  │  10:32 AM   Jess M.        Logged in                              │ │
│  │  10:15 AM   Paulo (admin)  Sent magic link to Tina R.             │ │
│  │  09:30 AM   Tina R.        Generated year-end summary             │ │
│  │  09:12 AM   Tina R.        Logged in                              │ │
│  │                                                                    │ │
│  │  Yesterday                                                         │ │
│  │                                                                    │ │
│  │  4:45 PM    Paulo (admin)  Created practitioner account: Maria S. │ │
│  │  4:12 PM    Jess M.        Generated year-end summary for Lisa K. │ │
│  │  3:30 PM    Jess M.        Updated claim status to "Paid"         │ │
│  │  2:15 PM    Jess M.        Created claim for patient Sarah J.     │ │
│  │  11:30 AM   Paulo (admin)  Started impersonation of Jess M.       │ │
│  │  11:45 AM   Paulo (admin)  Ended impersonation                    │ │
│  │                                                                    │ │
│  │  December 2                                                        │ │
│  │                                                                    │ │
│  │  3:20 PM    Tina R.        Added referral for patient John D.     │ │
│  │  2:00 PM    Jess M.        Logged in                              │ │
│  │  ...                                                               │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  [ Load more ]                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**URL:** `/admin/events`

---

### 8. Impersonation Banner

When admin is impersonating a user, show a persistent banner:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ IMPERSONATING: Jess M. (jess@example.com)         [ End Session ]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  (Normal LMT app UI appears below)                                     │
│                                                                         │
│  Dashboard                                                              │
│  Good morning, Jess!                                                   │
│  ...                                                                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Banner is sticky at top
- Different background color (yellow/orange)
- "End Session" returns admin to `/admin/practitioners/[id]`
- All actions are logged with `actor_type: 'admin'`

---

## Implementation Details

### 1. Admin Authentication Flow

```typescript
// Supabase setup for admin auth
// Admin users are created directly in the database, not via signUp

async function adminLogin(email: string, password: string) {
  // 1. Sign in with Supabase Auth
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  
  // 2. Verify user is in admin_users table
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)
    .single();
  
  if (!adminUser) {
    await supabase.auth.signOut();
    throw new Error('Not authorized as admin');
  }
  
  // 3. Update last login
  await supabase
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', adminUser.id);
  
  // 4. Log event
  await logAdminEvent({
    actor_type: 'admin',
    actor_id: adminUser.id,
    actor_email: email,
    event_type: 'admin.login',
    description: 'Admin logged in',
  });
  
  return { authData, adminUser };
}
```

### 2. Impersonation Flow

```typescript
async function startImpersonation(adminId: string, practitionerId: string) {
  // 1. Get practitioner
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('*')
    .eq('id', practitionerId)
    .single();
  
  if (!practitioner) throw new Error('Practitioner not found');
  
  // 2. Create impersonation session
  const { data: session } = await supabase
    .from('impersonation_sessions')
    .insert({
      admin_id: adminId,
      practitioner_id: practitionerId,
    })
    .select()
    .single();
  
  // 3. Generate special JWT with impersonation claims
  // This is done via Supabase Edge Function or custom JWT
  const impersonationToken = await generateImpersonationToken({
    admin_id: adminId,
    practitioner_id: practitionerId,
    workspace_id: practitioner.workspace_id,
    session_id: session.id,
  });
  
  // 4. Log event
  await logAdminEvent({
    actor_type: 'admin',
    actor_id: adminId,
    event_type: 'admin.impersonation_started',
    practitioner_id: practitionerId,
    description: `Started impersonating ${practitioner.name}`,
  });
  
  // 5. Store original admin token for later
  // (in httpOnly cookie or secure storage)
  
  return {
    session_id: session.id,
    token: impersonationToken,
    redirect_url: '/dashboard',
  };
}


async function endImpersonation(sessionId: string, adminId: string) {
  // 1. Close impersonation session
  const { data: session } = await supabase
    .from('impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)
    .select('practitioner_id')
    .single();
  
  // 2. Log event
  await logAdminEvent({
    actor_type: 'admin',
    actor_id: adminId,
    event_type: 'admin.impersonation_ended',
    practitioner_id: session.practitioner_id,
    description: 'Ended impersonation',
  });
  
  // 3. Return original admin token
  // (retrieved from httpOnly cookie or secure storage)
  
  return {
    redirect_url: `/admin/practitioners/${session.practitioner_id}`,
  };
}
```

### 3. Event Logging Helper

```typescript
interface LogEventParams {
  actor_type: 'admin' | 'practitioner' | 'system';
  actor_id?: string;
  actor_email?: string;
  event_type: string;
  event_category?: string;
  practitioner_id?: string;
  workspace_id?: string;
  description: string;
  metadata?: Record<string, any>;
}

async function logEvent(params: LogEventParams) {
  // Infer category from event type
  const category = params.event_category || params.event_type.split('.')[0];
  
  await supabase.from('admin_events').insert({
    actor_type: params.actor_type,
    actor_id: params.actor_id,
    actor_email: params.actor_email,
    event_type: params.event_type,
    event_category: category,
    practitioner_id: params.practitioner_id,
    workspace_id: params.workspace_id,
    description: params.description,
    metadata: params.metadata || {},
  });
}

// Usage throughout the app:
// When practitioner creates a patient
await logEvent({
  actor_type: 'practitioner',
  actor_id: practitioner.id,
  actor_email: practitioner.email,
  event_type: 'patient.created',
  practitioner_id: practitioner.id,
  workspace_id: practitioner.workspace_id,
  description: `Created patient ${patient.display_name}`,
  metadata: { patient_id: patient.id },
});
```

### 4. Feature Flag Check

```typescript
// Hook to check feature flags
function useFeatureFlag(flag: string): boolean {
  const { practitioner } = usePractitioner();
  
  if (!practitioner) return false;
  
  // Check the flag on practitioner record
  const flagKey = `feature_${flag}` as keyof typeof practitioner;
  return practitioner[flagKey] === true;
}

// Usage in components
function ClaimsPage() {
  const claimsEnabled = useFeatureFlag('claims_tracking');
  
  if (!claimsEnabled) {
    return <FeatureNotAvailable feature="Claims Tracking" />;
  }
  
  return <ClaimsContent />;
}
```

---

## Implementation Checklist

### Phase 1: Database & Auth (Day 1-2)

- [ ] Create `practitioners` table with all fields
- [ ] Create `admin_users` table
- [ ] Create `admin_events` table
- [ ] Create `impersonation_sessions` table
- [ ] Create `practitioner_stats` view
- [ ] Set up RLS policies for admin access
- [ ] Create admin user directly in database (Paulo)
- [ ] Test admin login flow

### Phase 2: Admin UI - Practitioners (Day 3-4)

- [ ] Create `/admin/login` page
- [ ] Create `/admin/practitioners` list page
- [ ] Create `/admin/practitioners/[id]` detail page
- [ ] Create "Add Practitioner" modal
- [ ] Create "Edit Practitioner" form
- [ ] Implement billing tab
- [ ] Implement features tab (toggles)

### Phase 3: Impersonation (Day 5)

- [ ] Implement impersonation token generation
- [ ] Create "Impersonate" button flow
- [ ] Create impersonation banner component
- [ ] Implement "End Session" flow
- [ ] Store/restore original admin token
- [ ] Test RLS with impersonation token

### Phase 4: Magic Links & Events (Day 6)

- [ ] Implement "Send Magic Link" endpoint
- [ ] Create `/admin/events` page
- [ ] Add event logging throughout LMT app
- [ ] Add event logging to admin actions
- [ ] Add filters to events page

### Phase 5: Polish & Testing (Day 7)

- [ ] Test full onboarding flow (create → send link → login as user)
- [ ] Test impersonation with real data
- [ ] Verify RLS policies work correctly
- [ ] Add loading states and error handling
- [ ] Mobile responsiveness for admin (optional)

---

## Security Checklist

- [ ] Admin login uses email/password, not magic link
- [ ] Admin routes are protected server-side
- [ ] `/admin/*` not accessible without admin JWT
- [ ] Impersonation creates separate token, doesn't modify user's token
- [ ] Impersonation sessions are logged and auditable
- [ ] Original admin token stored securely during impersonation
- [ ] RLS policies prevent practitioners from seeing each other's data
- [ ] Admin bypass in RLS only works for verified admin users
- [ ] Rate limiting on admin login
- [ ] All admin actions logged to events table

---

## Future Enhancements (V2+)

| Feature | Description |
|---------|-------------|
| Self-serve signup | Public signup with email verification |
| Stripe integration | Automatic billing, subscription management |
| Multiple admins | Support team access with roles |
| Advanced analytics | Charts, trends, cohort analysis |
| Bulk operations | Import/export practitioners |
| Email templates | Customizable onboarding emails |
| API keys | For practitioners who want API access |
| Audit log export | Download events as CSV |
| Health checks | Automated alerts for inactive users |

---

## Summary

This admin system gives you complete control for V1:

1. **Secure admin access** - Separate login, not visible to LMTs
2. **Full practitioner management** - Create, edit, suspend accounts
3. **Impersonation** - See exactly what users see, debug issues fast
4. **Manual billing tracking** - Know who's paying what
5. **Feature flags** - Control feature rollout per user
6. **Event logging** - Understand what's happening in the system

With this foundation, you can confidently onboard Jess, Tina, and 3-5 more LMTs while maintaining full visibility and control.

**Total estimated implementation: ~7 working days**
