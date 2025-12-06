'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

interface FeatureFlag {
  key: string;
  label: string;
  enabled: boolean;
}

interface FeatureFlagsCardProps {
  practitionerId: string;
  featureFlags: FeatureFlag[];
}

export function FeatureFlagsCard({ practitionerId, featureFlags }: FeatureFlagsCardProps) {
  const router = useRouter();
  const [flags, setFlags] = useState(featureFlags);
  const [updating, setUpdating] = useState<string | null>(null);

  const handleToggle = async (flagKey: string, currentValue: boolean) => {
    setUpdating(flagKey);

    try {
      const response = await fetch(`/api/admin/practitioners/${practitionerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [flagKey]: !currentValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update feature flag');
      }

      // Update local state
      setFlags((prev) =>
        prev.map((flag) =>
          flag.key === flagKey ? { ...flag, enabled: !currentValue } : flag
        )
      );

      // Refresh the page data
      router.refresh();
    } catch (error) {
      console.error('Error updating feature flag:', error);
      alert('Failed to update feature flag');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Flags</CardTitle>
        <CardDescription>Control which features this practitioner can access</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {flags.map((flag) => (
            <div
              key={flag.key}
              className={`p-4 rounded-lg border transition-colors ${
                flag.enabled ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
              } ${updating === flag.key ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm ${flag.enabled ? 'text-green-800' : 'text-slate-600'}`}>
                  {flag.label}
                </span>
                <Switch
                  checked={flag.enabled}
                  onCheckedChange={() => handleToggle(flag.key, flag.enabled)}
                  disabled={updating === flag.key}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
