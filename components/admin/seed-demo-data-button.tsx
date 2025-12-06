'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface SeedDemoDataButtonProps {
  practitionerId: string;
  hasUserId: boolean;
  hasPatients?: boolean; // Kept for backwards compatibility, but no longer used
}

export function SeedDemoDataButton({ practitionerId, hasUserId }: SeedDemoDataButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ patients: number; visits: number; referrals: number } | null>(null);

  const handleSeedDemoData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/practitioners/${practitionerId}/seed-demo-data`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to seed demo data');
        return;
      }

      setSuccess(true);
      setResult(data.data);

      // Refresh the page after 2 seconds to show updated stats
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Error seeding demo data:', err);
      setError('Failed to seed demo data');
    } finally {
      setLoading(false);
    }
  };

  // Don't show button if practitioner hasn't logged in yet
  if (!hasUserId) {
    return (
      <Button variant="outline" disabled title="Practitioner must log in first">
        <svg
          className="w-4 h-4 mr-2 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        Seed Demo Data
      </Button>
    );
  }

  if (success && result) {
    return (
      <Button variant="outline" disabled className="text-green-600">
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Seeded: {result.patients} patients, {result.visits} visits
      </Button>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={handleSeedDemoData} disabled={loading}>
          <svg
            className="w-4 h-4 mr-2 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Retry
        </Button>
        <span className="text-sm text-red-600">{error}</span>
      </div>
    );
  }

  return (
    <Button variant="outline" onClick={handleSeedDemoData} disabled={loading}>
      {loading ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Seeding...
        </>
      ) : (
        <>
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          Seed Demo Data
        </>
      )}
    </Button>
  );
}
