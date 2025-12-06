# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**BodyWorkFlow** is a practice management PWA for Licensed Massage Therapists (LMTs). It has two main modules:

1. **Clinical Module** - Voice-to-SOAP notes using Deepgram transcription + Claude AI
2. **Ops Module** - Practice management: patients, visits, claims, referrals, payments, reports

The app supports multiple practice types: Cash-Only, Insurance-Billing, and School (multi-user).

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, Database, Storage)
- **Voice**: Browser MediaRecorder API (webm/opus)
- **Transcription**: Deepgram API (Nova-2 model)
- **AI**: Claude API for SOAP note generation
- **PDF**: jsPDF for client-side PDF generation
- **PWA**: next-pwa for installability

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

### App Router Structure
```
/app
  /(clinical)/      # SOAP notes module
    page.tsx        # Home - record button + recent sessions
    /record/        # Recording flow
    /sessions/      # Session detail view
  /(ops)/           # Practice management module
    /dashboard/     # Today's visits, copays, alerts
    /patients/      # Patient list + detail view
    /visits/        # Visit management
    /claims/        # Insurance claims tracking
    /referrals/     # Referral management
    /reports/       # Earnings, payments, year-end statements
    /settings/      # Practice settings, branding
    /documents/     # Document templates
    /intake-forms/  # Intake form builder
  /(admin)/admin/   # Super Admin portal (protected)
    page.tsx        # Admin dashboard with stats
    /practitioners/ # Practitioners list
    /practitioners/[id]/ # Practitioner detail
    /events/        # Audit event log
  /admin/login/     # Admin login (outside route group)
  /(auth)/
    /login/         # Magic link auth
  /intake/[token]/  # Client-facing intake form
  /api/
    /transcribe/    # Deepgram integration
    /generate-soap/ # Claude API integration
    /admin/         # Admin API routes
      /login/       # Admin email/password auth
      /logout/      # Admin logout
      /practitioners/ # Practitioner CRUD
      /impersonate/ # Impersonation start/end
```

### Key Files
- `middleware.ts` - Auth protection
- `lib/supabase.ts` - Browser Supabase client
- `lib/practice-config.tsx` - Practice type configuration (cash_only/insurance/school)
- `lib/benefits-calculator.ts` - Insurance benefits calculation
- `components/ops/` - Practice management components
- `components/clinical/` - SOAP notes components
- `components/intake/` - Intake form components

## Database Schema

Key tables with RLS enabled:
- `profiles` - User profiles with practice_id
- `practices` - Practice settings (type, branding, etc.)
- `patients_non_phi` - Patient records (display_name only, no PHI)
- `visits_non_phi` - Visit records
- `payments_non_phi` - Payment records
- `claims_non_phi` - Insurance claims
- `referrals_non_phi` - Referral tracking
- `intake_templates` - Intake form definitions
- `intake_responses` - Client intake submissions
- `sessions` - SOAP notes with audio_url, transcript, soap_note (JSONB)

## Environment Variables

Required in `.env`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEEPGRAM_API_KEY=
ANTHROPIC_API_KEY=
```

## Implemented Features

### Phase 1 - Foundation (COMPLETE)
- [x] Practice type configuration (cash_only, insurance, school)
- [x] Feature flags and conditional navigation
- [x] Terminology switching (Patient/Client, Visit/Session)

### Phase 2 - Cash-Only Features (COMPLETE)
- [x] Expanded payment methods (Card, Cash, Check, HSA, Venmo, CashApp, Zelle, Apple Pay)
- [x] Intake forms system (builder + renderer + client-facing form)
- [x] SOAP notes / session notes
- [x] Benefits calculator for insurance

### Year-End Statements (COMPLETE) - See `bodyworkflow-charges-summary-pdf.md`
- [x] Patient year-end statement PDF generation
- [x] Practice branding on PDFs (logo, address, phone)
- [x] Date range picker (current year / previous year)
- [x] Download, Share, Email options
- [x] Bulk generation from Reports page
- [x] Business Tax Statement for practice owner
- [x] Quarterly/monthly revenue breakdown
- [x] Payment method analysis for tax purposes

### Jess Feedback Features (COMPLETE) - See `bodyworkflow-new-features-consolidated.md`

#### Feature 1: Customizable Portals Management
- [x] Portals table for insurance claim submission portals
- [x] Manage Portals settings screen with add/edit/delete/reorder
- [x] Portal dropdown on claims form
- [x] Default portals seeded (Office Ally, Availity, etc.)
- [x] Portal filter on Claims list
- [x] Drag-to-reorder functionality

#### Feature 2: Enhanced Referral Management
- [x] Enhanced referral form with physician info (name, NPI, specialty, phone, fax, clinic)
- [x] Authorization tracking (auth number, payer)
- [x] ICD-10 and CPT code search with massage therapy presets
- [x] Physicians table for auto-complete from previous referrals
- [x] Visit limit tracking (Per Referral / Per Year / Unlimited)
- [x] Referral status calculation (active, expiring_soon, visits_low, exhausted, expired)
- [x] Enhanced referral cards with progress bars
- [x] Dashboard referral alerts with physician/codes info
- [x] Renew Referral button (pre-fills form with existing data)
- [x] Database triggers for auto-saving physicians and auto-updating status
- [x] Migration: `supabase/migrations/20241207_enhance_referrals.sql`

#### Feature 3: Year-End PDF Charges Summary
- [x] Already complete (see Year-End Statements section above)

### Super Admin System (COMPLETE) - See `bodyworkflow-super-admin-spec.md`
- [x] Admin authentication (email/password login)
- [x] Practitioners management (list, detail, feature flags)
- [x] Impersonation system with audit trail
- [x] Admin events logging (all admin/practitioner actions)
- [x] Dashboard with platform-wide statistics
- [x] Cookie-based impersonation context
- [x] Migration: `supabase/migrations/20241208_super_admin.sql`

### Phase 3 - Payment & Policy (PENDING)
- [ ] Card on File (Stripe integration)
- [ ] No-Show Policy Agreement

### Phase 4 - School Features (PENDING)
- [ ] Multi-user support with roles
- [ ] Supervisor approval workflow

## Key Components

### PDF Generation
- `components/ops/ChargesSummaryPDF.ts` - Patient year-end statement
- `components/ops/BusinessTaxStatementPDF.ts` - Business tax statement
- `components/ops/GenerateSummaryDialog.tsx` - Patient statement dialog
- `components/ops/GenerateBusinessStatementDialog.tsx` - Business statement dialog

### Enhanced Referrals
- `components/ops/EnhancedReferralForm.tsx` - Full referral form with physician auto-complete, ICD-10/CPT codes
- `lib/referral-presets.ts` - Physician specialties, ICD-10 codes, CPT codes presets
- `lib/types-ops.ts` - ReferralNonPhi, Physician types

### Portals Management
- `app/(ops)/settings/portals/page.tsx` - Manage portals screen
- `lib/types-ops.ts` - Portal, PortalWithClaimCount types

### Practice Configuration
- `lib/practice-config.tsx` - PracticeConfigProvider, usePracticeConfig hook
- Controls which features are visible based on practice type

### Intake Forms
- `components/intake/QuestionBuilder.tsx` - Build intake form templates
- `components/intake/QuestionRenderer.tsx` - Render questions for clients
- `app/intake/[token]/page.tsx` - Client-facing intake form

### Super Admin Portal
- `lib/admin-auth.ts` - Admin authentication helpers (getAdminUser, isAdmin, impersonation cookies)
- `lib/db/admin-queries.ts` - Admin database operations (practitioners, events, impersonation)
- `components/admin/AdminNav.tsx` - Admin navigation sidebar
- `components/admin/ImpersonationBanner.tsx` - Banner showing impersonation status
- `app/(admin)/admin/layout.tsx` - Protected admin layout with auth check
- `app/(admin)/admin/page.tsx` - Admin dashboard with platform stats
- `app/(admin)/admin/practitioners/page.tsx` - Practitioners list with search/filter
- `app/(admin)/admin/practitioners/[id]/page.tsx` - Practitioner detail with feature flags
- `app/(admin)/admin/events/page.tsx` - Audit event log grouped by date