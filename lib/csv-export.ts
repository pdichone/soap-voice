// CSV Export Utility

export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) return '';

  // Header row
  const header = columns.map(col => `"${col.label}"`).join(',');

  // Data rows
  const rows = data.map(row => {
    return columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '""';
      if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
      if (typeof value === 'boolean') return value ? '"Yes"' : '"No"';
      return `"${value}"`;
    }).join(',');
  });

  return [header, ...rows].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Pre-defined export configurations
export const WEEKLY_EARNINGS_COLUMNS = [
  { key: 'weekStart' as const, label: 'Week Start' },
  { key: 'weekEnd' as const, label: 'Week End' },
  { key: 'total' as const, label: 'Total Revenue' },
  { key: 'visitCount' as const, label: 'Visit Count' },
  { key: 'copays' as const, label: 'Copays' },
  { key: 'otherPayments' as const, label: 'Other Payments' },
];

export const MONTHLY_EARNINGS_COLUMNS = [
  { key: 'monthLabel' as const, label: 'Month' },
  { key: 'total' as const, label: 'Total Revenue' },
  { key: 'visitCount' as const, label: 'Visit Count' },
  { key: 'copays' as const, label: 'Copays' },
  { key: 'otherPayments' as const, label: 'Other Payments' },
];

export const YEARLY_EARNINGS_COLUMNS = [
  { key: 'year' as const, label: 'Year' },
  { key: 'total' as const, label: 'Total Revenue' },
  { key: 'visitCount' as const, label: 'Visit Count' },
  { key: 'copays' as const, label: 'Copays' },
  { key: 'otherPayments' as const, label: 'Other Payments' },
];

export const PAYMENTS_COLUMNS = [
  { key: 'date' as const, label: 'Date' },
  { key: 'patient' as const, label: 'Patient' },
  { key: 'amount' as const, label: 'Amount' },
  { key: 'method' as const, label: 'Method' },
  { key: 'isCopay' as const, label: 'Is Copay' },
];
