/**
 * Date utilities for handling timezone-safe date parsing and formatting
 */

/**
 * Get today's date in local timezone as YYYY-MM-DD string
 */
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a YYYY-MM-DD date string without timezone shifting.
 * JavaScript's Date constructor interprets "YYYY-MM-DD" as UTC midnight,
 * which can cause the date to shift when displayed in local time.
 * This function adds T12:00:00 to avoid that issue.
 */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Add T12:00:00 to avoid timezone shift issues
  return new Date(dateStr + 'T12:00:00');
}

/**
 * Format a YYYY-MM-DD date string for display without timezone shifting
 */
export function formatDate(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!dateStr) return '';
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format a full timestamp (ISO string with time) for display
 * Use this for created_at, updated_at fields
 */
export function formatTimestamp(
  timestamp: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('en-US', options);
}
