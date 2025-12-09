'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Onboarding' },
  { value: 'not_started', label: 'Not Started' },
  { value: 'questionnaire_sent', label: 'Questionnaire Sent' },
  { value: 'questionnaire_received', label: 'Questionnaire Received' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
] as const;

export function OnboardingStatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get('onboarding') || 'all';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all') {
      params.delete('onboarding');
    } else {
      params.set('onboarding', value);
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="onboarding-filter" className="text-sm text-slate-600">
        Onboarding:
      </label>
      <select
        id="onboarding-filter"
        value={currentStatus}
        onChange={handleChange}
        className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
