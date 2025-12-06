'use client';

import { ReactNode } from 'react';
import { PracticeConfigProvider, usePracticeConfig } from '@/lib/practice-config';
import { FeatureFlagsProvider } from '@/lib/feature-flags';
import { Onboarding } from './Onboarding';

interface OpsProvidersProps {
  children: ReactNode;
}

function OpsContent({ children }: { children: ReactNode }) {
  const { practice, loading } = usePracticeConfig();

  // Show loading state while checking practice config
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-gray-500 animate-pulse">Loading...</p>
      </div>
    );
  }

  // Show onboarding if no practice is set up
  if (!practice) {
    return <Onboarding />;
  }

  // Render normal app content
  return <>{children}</>;
}

export function OpsProviders({ children }: OpsProvidersProps) {
  return (
    <PracticeConfigProvider>
      <FeatureFlagsProvider>
        <OpsContent>{children}</OpsContent>
      </FeatureFlagsProvider>
    </PracticeConfigProvider>
  );
}
