import { jsPDF } from 'jspdf';
import type { PracticeSettings } from '@/lib/types-ops';

export interface BusinessTaxStatementData {
  practice: PracticeSettings;
  year: number;
  income: {
    gross_revenue: number;
    monthly_breakdown: {
      month: string;
      revenue: number;
      visits: number;
    }[];
    quarterly_totals: {
      quarter: string;
      revenue: number;
      visits: number;
    }[];
  };
  payment_methods: {
    method: string;
    total: number;
    count: number;
    percentage: number;
  }[];
  client_stats: {
    total_unique_clients: number;
    new_clients: number;
    total_visits: number;
    average_per_visit: number;
  };
  // For insurance practices
  insurance_breakdown?: {
    copays_collected: number;
    insurance_payments: number;
    total_billed?: number;
  };
  generated_at: string;
}

export interface GeneratedPDF {
  blob: Blob;
  filename: string;
  url: string;
}

export async function generateBusinessTaxStatementPDF(data: BusinessTaxStatementData): Promise<GeneratedPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header - Business Info
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(data.practice.business_name || 'Business Name', margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  if (data.practice.address_line1) {
    doc.text(data.practice.address_line1, margin, y);
    y += 4;
  }
  if (data.practice.city && data.practice.state) {
    doc.text(`${data.practice.city}, ${data.practice.state} ${data.practice.zip || ''}`.trim(), margin, y);
    y += 4;
  }
  if (data.practice.phone) {
    doc.text(data.practice.phone, margin, y);
    y += 4;
  }

  // Title
  y += 8;
  doc.setFillColor(37, 99, 235); // Blue background
  doc.rect(margin, y - 5, pageWidth - margin * 2, 12, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text(`ANNUAL INCOME STATEMENT - ${data.year}`, margin + 4, y + 3);
  y += 14;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('For Tax Preparation & Bookkeeping Purposes', margin, y);
  y += 10;

  // ===== INCOME SUMMARY SECTION =====
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('INCOME SUMMARY', margin, y);
  y += 6;

  // Gross Revenue Box
  doc.setFillColor(240, 253, 244); // Light green
  doc.roundedRect(margin, y - 3, pageWidth - margin * 2, 16, 2, 2, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 101, 52);
  doc.text('Total Gross Revenue:', margin + 4, y + 3);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.income.gross_revenue), margin + 4, y + 10);
  y += 20;

  // ===== QUARTERLY BREAKDOWN =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Quarterly Breakdown (for Estimated Tax Payments)', margin, y);
  y += 5;

  // Quarter headers
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Quarter', margin + 4, y + 5);
  doc.text('Revenue', 85, y + 5);
  doc.text('Visits', 130, y + 5);
  doc.text('Avg/Visit', 160, y + 5);
  y += 8;

  // Quarter rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  for (const q of data.income.quarterly_totals) {
    const avgPerVisit = q.visits > 0 ? q.revenue / q.visits : 0;
    doc.text(q.quarter, margin + 4, y + 4);
    doc.text(formatCurrency(q.revenue), 85, y + 4);
    doc.text(q.visits.toString(), 130, y + 4);
    doc.text(formatCurrency(avgPerVisit), 160, y + 4);
    y += 6;
  }
  y += 6;

  // ===== MONTHLY BREAKDOWN =====
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(50, 50, 50);
  doc.text('Monthly Breakdown', margin, y);
  y += 5;

  // Month headers
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Month', margin + 4, y + 5);
  doc.text('Revenue', 85, y + 5);
  doc.text('Visits', 130, y + 5);
  doc.text('Avg/Visit', 160, y + 5);
  y += 8;

  // Month rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  let isAlt = false;
  for (const m of data.income.monthly_breakdown) {
    if (isAlt) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 1, pageWidth - margin * 2, 6, 'F');
    }
    isAlt = !isAlt;
    const avgPerVisit = m.visits > 0 ? m.revenue / m.visits : 0;
    doc.text(m.month, margin + 4, y + 3);
    doc.text(formatCurrency(m.revenue), 85, y + 3);
    doc.text(m.visits.toString(), 130, y + 3);
    doc.text(formatCurrency(avgPerVisit), 160, y + 3);
    y += 6;
  }
  y += 8;

  // ===== PAYMENT METHOD BREAKDOWN =====
  // Check if we need a new page
  if (y > 200) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('PAYMENT METHOD BREAKDOWN', margin, y);
  y += 3;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Important for tracking cash vs. card transactions and potential processing fees', margin, y);
  y += 6;

  // Payment method headers
  doc.setFillColor(243, 244, 246);
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Payment Method', margin + 4, y + 5);
  doc.text('Total', 85, y + 5);
  doc.text('# Trans.', 125, y + 5);
  doc.text('% of Revenue', 155, y + 5);
  y += 8;

  // Payment method rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  isAlt = false;
  for (const pm of data.payment_methods) {
    if (isAlt) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 1, pageWidth - margin * 2, 6, 'F');
    }
    isAlt = !isAlt;
    doc.text(pm.method, margin + 4, y + 3);
    doc.text(formatCurrency(pm.total), 85, y + 3);
    doc.text(pm.count.toString(), 125, y + 3);
    doc.text(`${pm.percentage.toFixed(1)}%`, 155, y + 3);
    y += 6;
  }
  y += 8;

  // Cash vs Non-Cash Summary (important for tax)
  const cashMethods = ['Cash'];
  const cardMethods = ['Credit/Debit Card', 'CARD'];
  const cashTotal = data.payment_methods
    .filter(pm => cashMethods.some(c => pm.method.toUpperCase().includes(c.toUpperCase())))
    .reduce((sum, pm) => sum + pm.total, 0);
  const cardTotal = data.payment_methods
    .filter(pm => cardMethods.some(c => pm.method.toUpperCase().includes(c.toUpperCase())))
    .reduce((sum, pm) => sum + pm.total, 0);

  doc.setFillColor(254, 249, 195); // Yellow highlight
  doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 14, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(113, 63, 18);
  doc.text('Tax Note:', margin + 4, y + 3);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cash Received: ${formatCurrency(cashTotal)} | Card Payments: ${formatCurrency(cardTotal)} (may have processing fees to deduct)`, margin + 24, y + 3);
  doc.text(`Digital Payments (Venmo, Zelle, etc.): ${formatCurrency(data.income.gross_revenue - cashTotal - cardTotal)}`, margin + 4, y + 9);
  y += 18;

  // ===== CLIENT/PRACTICE STATISTICS =====
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('PRACTICE STATISTICS', margin, y);
  y += 6;

  doc.setFillColor(239, 246, 255); // Light blue
  doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 28, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 64, 175);

  const col1 = margin + 4;
  const col2 = 110;

  doc.text(`Total Unique Clients: ${data.client_stats.total_unique_clients}`, col1, y + 5);
  doc.text(`New Clients (${data.year}): ${data.client_stats.new_clients}`, col2, y + 5);
  doc.text(`Total Sessions/Visits: ${data.client_stats.total_visits}`, col1, y + 12);
  doc.text(`Average Revenue/Visit: ${formatCurrency(data.client_stats.average_per_visit)}`, col2, y + 12);

  const avgVisitsPerClient = data.client_stats.total_unique_clients > 0
    ? (data.client_stats.total_visits / data.client_stats.total_unique_clients).toFixed(1)
    : '0';
  doc.text(`Avg Visits/Client: ${avgVisitsPerClient}`, col1, y + 19);

  const revenuePerClient = data.client_stats.total_unique_clients > 0
    ? data.income.gross_revenue / data.client_stats.total_unique_clients
    : 0;
  doc.text(`Avg Revenue/Client: ${formatCurrency(revenuePerClient)}`, col2, y + 19);
  y += 34;

  // ===== INSURANCE BREAKDOWN (if applicable) =====
  if (data.insurance_breakdown && (data.insurance_breakdown.copays_collected > 0 || data.insurance_breakdown.insurance_payments > 0)) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('INSURANCE & COPAY BREAKDOWN', margin, y);
    y += 6;

    doc.setFillColor(243, 232, 255); // Light purple
    doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 16, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(88, 28, 135);
    doc.text(`Copays Collected from Patients: ${formatCurrency(data.insurance_breakdown.copays_collected)}`, col1, y + 5);
    doc.text(`Insurance Reimbursements Received: ${formatCurrency(data.insurance_breakdown.insurance_payments)}`, col1, y + 11);
    y += 22;
  }

  // ===== DISCLAIMER =====
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  const disclaimer = [
    'This statement is provided for informational and bookkeeping purposes only. It is not a substitute for professional',
    'tax advice. Please consult with a qualified tax professional or CPA for tax preparation and filing.',
    'Figures are based on payment records in the system and may not reflect all business transactions.',
  ];
  for (const line of disclaimer) {
    doc.text(line, margin, y);
    y += 3.5;
  }

  // Footer
  const footerY = 285;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated on ${data.generated_at}`, margin, footerY);
  doc.text('BodyWorkFlow', pageWidth - margin - 20, footerY);

  // Generate filename
  const safeName = (data.practice.business_name || 'business').replace(/[^a-zA-Z0-9]/g, '-');
  const filename = `annual-income-statement-${safeName}-${data.year}.pdf`;

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  return { blob, filename, url };
}

export function downloadPDF(pdf: GeneratedPDF): void {
  const link = document.createElement('a');
  link.href = pdf.url;
  link.download = pdf.filename;
  link.click();
}

export async function sharePDF(pdf: GeneratedPDF, businessName: string): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    const file = new File([pdf.blob], pdf.filename, { type: 'application/pdf' });
    await navigator.share({
      title: `Annual Income Statement - ${businessName}`,
      text: `Annual income statement for tax preparation`,
      files: [file],
    });
    return true;
  } catch (error) {
    console.error('Share failed:', error);
    return false;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}
