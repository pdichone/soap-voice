# BodyWorkFlow: Year-End Printable Charges Summary
## PDF Generator for Patient Payment Records

---

## Why This Feature is Critical

**The Problem:**
Every January, patients ask their massage therapist for a summary of what they paid for the year — they need it for:
- Tax deductions (medical expenses)
- HSA/FSA reimbursement documentation
- Insurance reimbursement claims
- Personal financial records

**Current Pain:**
- Jess manually types up each summary
- Searches through payment records
- Creates Word docs or handwritten notes
- Time-consuming, error-prone, looks unprofessional

**The Solution:**
One-click PDF generation with professional formatting.

**Why It's Non-HIPAA Safe:**
- Contains only dates and dollar amounts
- NO diagnosis codes, treatment notes, or medical conditions
- It's financial data, not clinical data
- Similar to a receipt from any service business

---

## Feature Overview

### User Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PDF GENERATION FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

  1. THERAPIST                          2. SYSTEM
     
  ┌──────────────────────┐            ┌──────────────────────┐
  │ Goes to Patient      │            │                      │
  │ Detail → Payments    │            │                      │
  │ tab                  │            │                      │
  └──────────────────────┘            └──────────────────────┘
           │                                   
           ▼                                   
  ┌──────────────────────┐            ┌──────────────────────┐
  │ Taps "Generate       │───────────▶│ Shows date range     │
  │ Summary" button      │            │ picker modal         │
  └──────────────────────┘            └──────────────────────┘
                                               │
                                               ▼
                                      ┌──────────────────────┐
                                      │ Generates PDF        │
                                      │ with all visits in   │
                                      │ date range           │
                                      └──────────────────────┘
                                               │
           ┌───────────────────────────────────┘
           ▼
  ┌──────────────────────┐
  │ • Preview PDF        │
  │ • Download PDF       │
  │ • Share/Email to     │
  │   patient            │
  └──────────────────────┘
```

---

## PDF Content Structure

### What's Included (Non-PHI)

| Field | Example | PHI? |
|-------|---------|------|
| Practice name | Healing Touch Massage Therapy | No |
| Practice address | 123 Main St, Seattle WA 98101 | No |
| Practice phone | (206) 555-1234 | No |
| Practice logo | [Image] | No |
| Patient name | Sarah Johnson | No* |
| Date range | January 1 - December 31, 2025 | No |
| Visit date | March 15, 2025 | No |
| Amount paid | $45.00 | No |
| Payment method | Card | No |
| Total visits | 12 | No |
| Total paid | $540.00 | No |
| Total billed | $1,056.00 | No |
| Total outstanding | $0.00 | No |
| Generated timestamp | Generated Dec 15, 2025 | No |

*Patient name alone is not PHI — it becomes PHI when linked to health information.

### What's NOT Included (PHI)

- ❌ Diagnosis codes (ICD-10)
- ❌ Treatment descriptions
- ❌ CPT/procedure codes
- ❌ SOAP notes
- ❌ Health conditions
- ❌ Insurance claim details
- ❌ Referral information

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
│  │ Apr 1, 2025     │ 60 min session │ $45.00        │ Cash           │ │
│  │ Apr 22, 2025    │ 60 min session │ $45.00        │ Card           │ │
│  │ May 10, 2025    │ 90 min session │ $65.00        │ Card           │ │
│  │ Jun 5, 2025     │ 60 min session │ $45.00        │ HSA            │ │
│  │ Jul 18, 2025    │ 60 min session │ $45.00        │ Card           │ │
│  │ Aug 8, 2025     │ 60 min session │ $45.00        │ Card           │ │
│  │ Sep 22, 2025    │ 90 min session │ $65.00        │ Card           │ │
│  │ Nov 5, 2025     │ 60 min session │ $45.00        │ Card           │ │
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
│                                                                         │
│  _________________________________          _______________             │
│  Provider Signature                         Date                        │
│                                                                         │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────   │
│  Generated on December 15, 2025 at 2:34 PM                             │
│  BodyWorkFlow • bodyworkflow.app                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UI Components

### 1. Entry Point: Patient Detail → Payments Tab

Add a "Generate Summary" button to the Payments tab:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back                                                     │
│  Sarah Johnson                                              │
│  Blue Cross                                     Collect: $45│
├─────────────────────────────────────────────────────────────┤
│  [ Visits ]  [ Claims ]  [ Referrals ]  [ Payments ]        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Payment History                    [ 📄 Generate Summary ] │
│                                                             │
│  December 2025                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Dec 5      60 min session      $45.00      Card       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  November 2025                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Nov 15     60 min session      $45.00      Card       ││
│  │  Nov 3      90 min session      $65.00      HSA        ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ... more months ...                                        │
│                                                             │
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
│  ─── If Custom Range selected ───                          │
│                                                             │
│  From:                        To:                           │
│  ┌────────────────────┐      ┌────────────────────┐        │
│  │ Jan 1, 2025       │      │ Dec 31, 2025       │        │
│  └────────────────────┘      └────────────────────┘        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
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
│  │                                                         ││
│  │              [ PDF PREVIEW ]                            ││
│  │                                                         ││
│  │         (Scrollable preview of the PDF)                ││
│  │                                                         ││
│  │                                                         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Sarah Johnson • 2025 • 12 visits • $600.00                │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  📥 Download │  │  📧 Email    │  │  📤 Share    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Reports Screen - Bulk Generate Option

Add to Reports screen for generating multiple summaries at once:

```
┌─────────────────────────────────────────────────────────────┐
│  Reports                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ... existing reports content ...                           │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  📄 PATIENT SUMMARIES                                       │
│                                                             │
│  Generate year-end charges summaries for patients           │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  [ Generate All 2025 Summaries ]                        ││
│  │                                                         ││
│  │  Creates PDFs for all 47 patients with visits in 2025  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Or generate individually from each patient's profile.      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Requirements

No new tables needed! This feature uses existing data:

```sql
-- Query to get payment summary for a patient
SELECT 
  v.visit_date,
  v.service_type,        -- "60 min session", "90 min session"
  p.amount,
  p.method,              -- "card", "cash", "hsa", "check"
  p.created_at
FROM visits v
JOIN payments p ON p.visit_id = v.id
WHERE v.patient_id = :patient_id
  AND v.visit_date BETWEEN :start_date AND :end_date
  AND p.amount > 0       -- Only include actual payments
ORDER BY v.visit_date ASC;

-- Summary totals
SELECT 
  COUNT(*) as total_visits,
  SUM(p.amount) as total_paid
FROM visits v
JOIN payments p ON p.visit_id = v.id
WHERE v.patient_id = :patient_id
  AND v.visit_date BETWEEN :start_date AND :end_date
  AND p.amount > 0;
```

### Practice Settings (Add if not exists)

```sql
-- Practice branding for PDF header
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

## Technical Implementation

### Option A: Client-Side PDF Generation (Simpler)

Use a library like `jspdf` or `@react-pdf/renderer` to generate PDFs directly in the browser/app.

**Pros:**
- No server costs
- Works offline
- Instant generation

**Cons:**
- Larger bundle size
- Limited styling options

```typescript
// Using @react-pdf/renderer (React Native / Web)
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';

interface ChargesSummaryProps {
  practice: Practice;
  patient: Patient;
  visits: VisitPayment[];
  dateRange: { start: string; end: string };
  totals: { visits: number; paid: number };
}

const ChargesSummaryPDF = ({ practice, patient, visits, dateRange, totals }: ChargesSummaryProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        {practice.logo_url && <Image src={practice.logo_url} style={styles.logo} />}
        <View style={styles.practiceInfo}>
          <Text style={styles.practiceName}>{practice.business_name}</Text>
          <Text style={styles.practiceAddress}>{practice.address_line1}</Text>
          <Text style={styles.practiceAddress}>
            {practice.city}, {practice.state} {practice.zip}
          </Text>
          <Text style={styles.practiceAddress}>{practice.phone}</Text>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>PATIENT CHARGES SUMMARY</Text>

      {/* Patient Info */}
      <View style={styles.patientInfo}>
        <Text>Patient: {patient.display_name}</Text>
        <Text>Date Range: {dateRange.start} — {dateRange.end}</Text>
      </View>

      {/* Visit Table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colService}>Service</Text>
          <Text style={styles.colAmount}>Paid</Text>
          <Text style={styles.colMethod}>Method</Text>
        </View>
        {visits.map((visit, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={styles.colDate}>{formatDate(visit.visit_date)}</Text>
            <Text style={styles.colService}>{visit.service_type}</Text>
            <Text style={styles.colAmount}>${visit.amount.toFixed(2)}</Text>
            <Text style={styles.colMethod}>{visit.method}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totals}>
        <Text>Total Visits: {totals.visits}</Text>
        <Text style={styles.totalAmount}>Total Amount Paid: ${totals.paid.toFixed(2)}</Text>
      </View>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        This statement reflects payments made directly by the patient.
        It does not include amounts billed to or paid by insurance.
      </Text>

      {/* Signature Line */}
      <View style={styles.signatureLine}>
        <View style={styles.signatureBox}>
          <Text>_______________________________</Text>
          <Text style={styles.signatureLabel}>Provider Signature</Text>
        </View>
        <View style={styles.signatureBox}>
          <Text>_______________</Text>
          <Text style={styles.signatureLabel}>Date</Text>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Generated on {formatDateTime(new Date())} • BodyWorkFlow
      </Text>
    </Page>
  </Document>
);

// Generate and download
async function generateChargesSummary(props: ChargesSummaryProps) {
  const blob = await pdf(<ChargesSummaryPDF {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  
  // For download
  const link = document.createElement('a');
  link.href = url;
  link.download = `charges-summary-${props.patient.display_name}-${props.dateRange.start}-${props.dateRange.end}.pdf`;
  link.click();
  
  // Cleanup
  URL.revokeObjectURL(url);
}
```

### Option B: Server-Side PDF Generation (More Flexible)

Use a server endpoint with a library like `puppeteer` or `pdf-lib`.

**Pros:**
- Smaller client bundle
- More consistent rendering
- Can store generated PDFs

**Cons:**
- Server costs (minimal)
- Requires API call

```typescript
// API Route (Next.js / Node.js example)
import puppeteer from 'puppeteer';

export async function POST(req: Request) {
  const { practiceId, patientId, startDate, endDate } = await req.json();
  
  // Fetch data
  const practice = await getPractice(practiceId);
  const patient = await getPatient(patientId);
  const visits = await getVisitsWithPayments(patientId, startDate, endDate);
  
  // Generate HTML
  const html = generateChargesSummaryHTML({ practice, patient, visits, startDate, endDate });
  
  // Convert to PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdfBuffer = await page.pdf({ format: 'A4' });
  await browser.close();
  
  // Return PDF
  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="charges-summary-${patient.display_name}.pdf"`
    }
  });
}
```

---

## Data Types

```typescript
interface VisitPayment {
  visit_id: string;
  visit_date: string;        // ISO date
  service_type: string;      // "60 min session", "90 min session"
  amount: number;            // Amount paid by patient
  method: string;            // "card", "cash", "hsa", "check"
}

interface ChargesSummaryRequest {
  patient_id: string;
  start_date: string;        // ISO date
  end_date: string;          // ISO date
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
  generated_at: string;      // ISO datetime
}
```

---

## Settings Screen Addition

Add practice branding settings for the PDF header:

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

## Implementation Checklist

> **STATUS: COMPLETE** - All features implemented as of December 2025

### Phase 1: Foundation
- [x] Add practice branding fields to database — `practices.settings` JSONB column
- [x] Create Settings screen for practice info + logo upload — `app/(ops)/settings/page.tsx`
- [x] Store logo in cloud storage — Supabase Storage `practice-assets` bucket

### Phase 2: PDF Generation
- [x] Install PDF library — using `jspdf`
- [x] Create PDF template component — `components/ops/ChargesSummaryPDF.ts`
- [x] Style the PDF to match mockup
- [x] Test with sample data

### Phase 3: UI Integration
- [x] Add "Generate Summary" button to Patient → Payments tab — "Year-End Statement" button
- [x] Create date range picker modal — `components/ops/GenerateSummaryDialog.tsx`
- [x] Show preview of visits count + total before generating
- [x] Add download functionality

### Phase 4: Share Options
- [x] Implement "Download" (save to device) — `downloadPDF()`
- [x] Implement "Share" (native share sheet) — `sharePDF()`
- [x] Implement "Email" — `emailPDF()` with mailto fallback

### Phase 5: Bulk Generation (Optional Enhancement)
- [x] Add bulk generate option to Reports screen — `app/(ops)/reports/page.tsx`
- [x] Progress indicator for bulk generation — `bulkProgress` state with UI feedback
- [~] Generate ZIP file — N/A, using individual downloads instead

### Bonus Features Added
- [x] Business Tax Statement for practice owner — `components/ops/BusinessTaxStatementPDF.ts`
- [x] Quarterly/monthly revenue breakdown for accountants
- [x] Payment method analysis for tax purposes
- [x] Client statistics (unique clients, new clients, avg per visit)

---

## Testing Scenarios

### Test Case 1: Single Year Summary
```
Patient: Sarah Johnson
Date Range: Jan 1 - Dec 31, 2025
Visits: 12
Expected: PDF with 12 line items, correct totals
```

### Test Case 2: Partial Year
```
Patient: Mike R.
Date Range: Jul 1 - Dec 31, 2025
Visits: 6
Expected: PDF with only visits from July onward
```

### Test Case 3: No Visits in Range
```
Patient: New Client
Date Range: Jan 1 - Dec 31, 2024
Visits: 0
Expected: Show message "No visits found in this date range"
```

### Test Case 4: Mixed Payment Methods
```
Patient: Lisa K.
Payments: Card, Cash, HSA, Check
Expected: Each payment method shows correctly in Method column
```

### Test Case 5: No Logo Set
```
Practice: No logo uploaded
Expected: PDF generates without logo, header still looks clean
```

---

## Why Jess Will Love This

1. **Time Saver** - One click instead of 30+ minutes per patient
2. **Professional** - Branded PDFs look legitimate for tax purposes
3. **Accurate** - No manual counting errors
4. **On-Demand** - Generate any time, any date range
5. **Shareable** - Email directly to patient or download

---

## Future Enhancements

1. **Auto-generate in January** - Remind Jess to generate all 2024 summaries
2. **Email blast** - Send all summaries to patients at once
3. **Superbill format** - Add CPT codes for insurance reimbursement (separate feature)
4. **Multiple formats** - PDF, CSV export for accountants
5. **Digital signature** - Sign PDFs directly in app
