import { jsPDF } from 'jspdf';
import type { ChargesSummaryData } from '@/lib/types-ops';

// Result type for PDF generation
export interface GeneratedPDF {
  blob: Blob;
  filename: string;
  url: string;
}

// Helper to load image and get dimensions for proper aspect ratio
async function loadImageWithDimensions(url: string): Promise<{
  data: string;
  width: number;
  height: number;
} | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Create an image to get dimensions
        const img = new Image();
        img.onload = () => {
          resolve({
            data: dataUrl,
            width: img.width,
            height: img.height,
          });
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    console.error('Failed to load logo image');
    return null;
  }
}

export async function generateChargesSummaryPDF(data: ChargesSummaryData): Promise<GeneratedPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Try to load and add logo if available
  if (data.practice.logo_url) {
    try {
      const logoInfo = await loadImageWithDimensions(data.practice.logo_url);
      if (logoInfo) {
        // Calculate dimensions preserving aspect ratio
        // Max logo size: 25mm height, 40mm width
        const maxHeight = 18;
        const maxWidth = 30;

        const aspectRatio = logoInfo.width / logoInfo.height;
        let logoWidth = maxWidth;
        let logoHeight = logoWidth / aspectRatio;

        // If height exceeds max, scale down
        if (logoHeight > maxHeight) {
          logoHeight = maxHeight;
          logoWidth = logoHeight * aspectRatio;
        }

        // Position at top-right corner
        const logoX = pageWidth - margin - logoWidth;
        const logoY = y - 2;

        doc.addImage(logoInfo.data, 'PNG', logoX, logoY, logoWidth, logoHeight);
      }
    } catch (err) {
      console.error('Error adding logo to PDF:', err);
    }
  }

  // Header - Practice Info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text(data.practice.business_name || 'Practice Name', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  if (data.practice.address_line1) {
    doc.text(data.practice.address_line1, margin, y);
    y += 4;
  }
  if (data.practice.address_line2) {
    doc.text(data.practice.address_line2, margin, y);
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

  // Divider
  y += 6;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // Title
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('YEAR-END STATEMENT', margin, y);
  y += 10;

  // Patient Info Box
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 18, 2, 2, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(`Patient: ${data.patient.display_name}`, margin + 4, y + 2);
  doc.text(`Date Range: ${data.date_range.start} — ${data.date_range.end}`, margin + 4, y + 9);
  y += 20;

  // Table Header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text('Date', margin + 4, y);
  doc.text('Amount', 95, y);
  doc.text('Payment Method', 130, y);
  y += 6;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  let isAlternate = false;

  for (const payment of data.payments) {
    // Check for page break
    if (y > 260) {
      doc.addPage();
      y = 20;
      // Repeat header on new page
      doc.setFillColor(240, 240, 240);
      doc.rect(margin, y - 4, pageWidth - margin * 2, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text('Date', margin + 4, y);
      doc.text('Amount', 95, y);
      doc.text('Payment Method', 130, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      isAlternate = false;
    }

    // Alternate row background
    if (isAlternate) {
      doc.setFillColor(252, 252, 252);
      doc.rect(margin, y - 3.5, pageWidth - margin * 2, 6, 'F');
    }
    isAlternate = !isAlternate;

    doc.text(payment.date, margin + 4, y);
    doc.text(`$${payment.amount.toFixed(2)}`, 95, y);
    doc.text(formatPaymentMethod(payment.method), 130, y);
    y += 6;
  }

  // Totals Section
  y += 8;
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFillColor(245, 250, 245);
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 20, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`Total Visits: ${data.totals.visit_count}`, margin + 4, y + 3);
  doc.setFontSize(11);
  doc.text(`Total Amount Paid: $${data.totals.total_paid.toFixed(2)}`, margin + 4, y + 11);
  y += 26;

  // Disclaimer
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  const disclaimer = 'This statement reflects payments made directly by the patient. It does not include amounts billed to or paid by insurance.';
  const lines = doc.splitTextToSize(disclaimer, pageWidth - margin * 2);
  doc.text(lines, margin, y);

  // Footer
  const footerY = 285;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated on ${data.generated_at}`, margin, footerY);
  doc.text('ZenLeef', pageWidth - margin - 20, footerY);

  // Generate filename
  const safeName = data.patient.display_name.replace(/[^a-zA-Z0-9]/g, '-');
  const year = data.date_range.start.includes(',')
    ? data.date_range.start.split(',')[0].trim().split(' ').pop()
    : data.date_range.start.split('/')[2] || new Date().getFullYear();
  const filename = `year-end-statement-${safeName}-${year}.pdf`;

  // Return blob for download/share/email
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  return { blob, filename, url };
}

// Helper to download the PDF
export function downloadPDF(pdf: GeneratedPDF): void {
  const link = document.createElement('a');
  link.href = pdf.url;
  link.download = pdf.filename;
  link.click();
}

// Helper to share via native share sheet (mobile/desktop)
export async function sharePDF(pdf: GeneratedPDF, patientName: string): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    const file = new File([pdf.blob], pdf.filename, { type: 'application/pdf' });
    await navigator.share({
      title: `Year-End Statement - ${patientName}`,
      text: `Year-end payment statement for ${patientName}`,
      files: [file],
    });
    return true;
  } catch (error) {
    // User cancelled or share failed
    console.error('Share failed:', error);
    return false;
  }
}

// Helper to open email client with PDF info
export function emailPDF(pdf: GeneratedPDF, patientName: string, practiceName?: string): void {
  const subject = encodeURIComponent(`Your Year-End Statement - ${practiceName || 'Payment Summary'}`);
  const body = encodeURIComponent(
    `Hello ${patientName},\n\n` +
    `Please find attached your year-end payment statement for your records.\n\n` +
    `This document can be used for:\n` +
    `- Tax deductions (medical expenses)\n` +
    `- HSA/FSA reimbursement\n` +
    `- Personal financial records\n\n` +
    `If you have any questions, please don't hesitate to reach out.\n\n` +
    `Best regards,\n${practiceName || 'Your Healthcare Provider'}`
  );
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
}

// Helper to format payment method for display
function formatPaymentMethod(method: string): string {
  const methodMap: Record<string, string> = {
    'CASH': 'Cash',
    'CHECK': 'Check',
    'CARD': 'Credit/Debit Card',
    'HSA': 'HSA/FSA',
    'VENMO': 'Venmo',
    'CASHAPP': 'Cash App',
    'APPLEPAY': 'Apple Pay',
    'ZELLE': 'Zelle',
    'OTHER': 'Other',
  };
  return methodMap[method] || method;
}
