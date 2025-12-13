'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// =============================================
// Feature Flags Type
// =============================================
export interface FeatureFlags {
  feature_claims_tracking: boolean;
  feature_year_end_summary: boolean;
  feature_insurance_calculator: boolean;
  feature_bulk_operations: boolean;
  feature_intake_forms: boolean;
  feature_documents: boolean;
  feature_referrals: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  feature_claims_tracking: true,
  feature_year_end_summary: true,
  feature_insurance_calculator: false,
  feature_bulk_operations: false,
  feature_intake_forms: true,
  feature_documents: true,
  feature_referrals: true,
};

// =============================================
// Context Definition
// =============================================
interface FeatureFlagsContextType {
  flags: FeatureFlags;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  // Convenience methods
  hasFeature: (feature: keyof FeatureFlags) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

// =============================================
// Provider Component
// =============================================
interface FeatureFlagsProviderProps {
  children: ReactNode;
}

export function FeatureFlagsProvider({ children }: FeatureFlagsProviderProps) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/feature-flags');

      if (!response.ok) {
        // If unauthorized or error, use defaults
        setFlags(DEFAULT_FLAGS);
        return;
      }

      const data = await response.json();
      setFlags(data);
    } catch (err) {
      console.error('Error fetching feature flags:', err);
      setError('Failed to load feature flags');
      // Use defaults on error
      setFlags(DEFAULT_FLAGS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  const hasFeature = (feature: keyof FeatureFlags): boolean => {
    return flags[feature] ?? false;
  };

  const value: FeatureFlagsContextType = {
    flags,
    loading,
    error,
    refetch: fetchFlags,
    hasFeature,
  };

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

// =============================================
// Hook for consuming the context
// =============================================
export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}

// =============================================
// Convenience hooks for specific features
// =============================================
export function useHasClaimsTracking(): boolean {
  const { flags } = useFeatureFlags();
  return flags.feature_claims_tracking;
}

export function useHasYearEndSummary(): boolean {
  const { flags } = useFeatureFlags();
  return flags.feature_year_end_summary;
}

export function useHasInsuranceCalculator(): boolean {
  const { flags } = useFeatureFlags();
  return flags.feature_insurance_calculator;
}

export function useHasBulkOperations(): boolean {
  const { flags } = useFeatureFlags();
  return flags.feature_bulk_operations;
}

export function useHasIntakeForms(): boolean {
  const { flags } = useFeatureFlags();
  return flags.feature_intake_forms;
}

export function useHasDocuments(): boolean {
  const { flags } = useFeatureFlags();
  return flags.feature_documents;
}

export function useHasReferrals(): boolean {
  const { flags } = useFeatureFlags();
  return flags.feature_referrals;
}
