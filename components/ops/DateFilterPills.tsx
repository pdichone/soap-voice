'use client';

interface DateFilterPillsProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const DATE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

export function DateFilterPills({ value, onChange, className = '' }: DateFilterPillsProps) {
  return (
    <div className={`flex gap-2 overflow-x-auto scrollbar-hide pb-1 ${className}`}>
      {DATE_FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
            value === filter.value
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

// Helper function to filter data by date range
export function getDateFilterRange(filter: string): { start: Date; end: Date } | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Sunday
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      return { start: weekStart, end: weekEnd };
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return { start: monthStart, end: monthEnd };
    case 'all':
    default:
      return null;
  }
}

// Helper to check if a date string falls within the filter range
// Handles both date-only strings (YYYY-MM-DD) and full ISO timestamps
export function isDateInRange(dateStr: string, filter: string): boolean {
  if (filter === 'all') return true;

  const range = getDateFilterRange(filter);
  if (!range) return true;

  // For date-only strings (YYYY-MM-DD), parse as local date by adding T12:00:00
  // This prevents timezone issues where "2025-12-06" gets parsed as UTC midnight
  // and then shifted to a different day in local timezone
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  const date = isDateOnly ? new Date(dateStr + 'T12:00:00') : new Date(dateStr);

  // Extract just the local date components for comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return dateOnly >= range.start && dateOnly < range.end;
}

// Alternative helper that uses the timestamp directly for more accurate filtering
export function isTimestampInRange(timestamp: string, filter: string): boolean {
  if (filter === 'all') return true;

  const now = new Date();
  const date = new Date(timestamp);

  switch (filter) {
    case 'today': {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      return date >= todayStart && date < todayEnd;
    }
    case 'week': {
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      return date >= weekStart && date < weekEnd;
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return date >= monthStart && date < monthEnd;
    }
    default:
      return true;
  }
}
