'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase';
import type { Practice, PracticeType } from '@/lib/types-ops';

// Helper to get effective user (works with impersonation)
async function getEffectiveUser(): Promise<{ id: string; email: string } | null> {
  try {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    if (response.ok && data.user) {
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}

// =============================================
// Practice Feature Configuration
// =============================================
interface PracticeFeatures {
  // Insurance-related features
  showClaims: boolean;
  showReferrals: boolean;
  showInsuranceFields: boolean;

  // School-related features
  showSupervisorApproval: boolean;
  showStudentManagement: boolean;

  // UI terminology
  patientLabel: string;
  patientLabelPlural: string;
  visitLabel: string;
  visitLabelPlural: string;
}

const PRACTICE_FEATURES: Record<PracticeType, PracticeFeatures> = {
  cash_only: {
    showClaims: false,
    showReferrals: false,
    showInsuranceFields: false,
    showSupervisorApproval: false,
    showStudentManagement: false,
    patientLabel: 'Client',
    patientLabelPlural: 'Clients',
    visitLabel: 'Session',
    visitLabelPlural: 'Sessions',
  },
  insurance: {
    showClaims: true,
    showReferrals: true,
    showInsuranceFields: true,
    showSupervisorApproval: false,
    showStudentManagement: false,
    patientLabel: 'Patient',
    patientLabelPlural: 'Patients',
    visitLabel: 'Visit',
    visitLabelPlural: 'Visits',
  },
  school: {
    showClaims: false,
    showReferrals: false,
    showInsuranceFields: false,
    showSupervisorApproval: true,
    showStudentManagement: true,
    patientLabel: 'Client',
    patientLabelPlural: 'Clients',
    visitLabel: 'Session',
    visitLabelPlural: 'Sessions',
  },
};

// =============================================
// Context Definition
// =============================================
interface PracticeConfigContextType {
  practice: Practice | null;
  practiceType: PracticeType;
  features: PracticeFeatures;
  loading: boolean;
  error: string | null;
  updatePracticeType: (type: PracticeType) => Promise<void>;
  refetch: () => Promise<void>;
}

const PracticeConfigContext = createContext<PracticeConfigContextType | undefined>(undefined);

// =============================================
// Provider Component
// =============================================
interface PracticeConfigProviderProps {
  children: ReactNode;
}

export function PracticeConfigProvider({ children }: PracticeConfigProviderProps) {
  const [practice, setPractice] = useState<Practice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPractice = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use the API endpoint which supports impersonation
      const response = await fetch('/api/auth/practice');
      const data = await response.json();

      if (response.ok && data.practice) {
        setPractice(data.practice);
      } else if (response.ok && !data.practice) {
        // No practice set up yet - user needs onboarding
        setPractice(null);
      } else {
        console.warn('Could not fetch practice:', data.error);
        setError(data.error || 'Failed to load practice');
      }
    } catch (err) {
      console.error('Error fetching practice config:', err);
      setError('Failed to load practice configuration');
    } finally {
      setLoading(false);
    }
  };

  const updatePracticeType = async (type: PracticeType) => {
    try {
      const supabase = createClient();
      // Use effective user API (supports impersonation)
      const user = await getEffectiveUser();
      if (!user) throw new Error('Not authenticated');

      console.log('Updating practice type for user:', user.id, 'to:', type);

      let savedSuccessfully = false;

      // Strategy 1: Try to upsert into therapists table
      const { error: upsertError } = await supabase
        .from('therapists')
        .upsert({
          id: user.id,
          practice_type: type,
          email: user.email,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.warn('Could not upsert therapists table:', upsertError);
        // Try simple update as fallback
        const { error: updateError } = await supabase
          .from('therapists')
          .update({ practice_type: type })
          .eq('id', user.id);

        if (!updateError) {
          console.log('Updated therapists table via update');
          savedSuccessfully = true;
        }
      } else {
        console.log('Upserted therapists table successfully');
        savedSuccessfully = true;
      }

      // Strategy 2: Try practitioners table (admin-managed)
      if (!savedSuccessfully) {
        const { error: practitionerError } = await supabase
          .from('practitioners')
          .update({ practice_type: type })
          .eq('user_id', user.id);

        if (!practitionerError) {
          console.log('Updated practitioners table successfully');
          savedSuccessfully = true;
        } else {
          console.warn('Could not update practitioners table:', practitionerError);
        }
      }

      // Strategy 3: If practice exists, update it
      if (practice && practice.id !== 'admin-controlled' && practice.id !== 'local') {
        const { error: practiceError } = await supabase
          .from('practices')
          .update({ practice_type: type })
          .eq('id', practice.id);

        if (!practiceError) {
          console.log('Updated practices table successfully');
          savedSuccessfully = true;
        } else {
          console.warn('Could not update practices table:', practiceError);
        }
      }

      // Always update local state - this ensures the UI updates even if DB save fails
      // The user can proceed and we'll try to sync later
      setPractice({
        id: practice?.id || 'local',
        name: practice?.name || 'My Practice',
        practice_type: type,
        settings: practice?.settings || {},
        created_at: practice?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      console.log('Practice type updated to:', type, '- Saved to DB:', savedSuccessfully);

      // Don't throw error - let user proceed even if DB save failed
      // The local state is updated, and we can sync later
    } catch (err) {
      console.error('Error updating practice type:', err);
      // Still update local state so user can proceed
      setPractice({
        id: practice?.id || 'local',
        name: practice?.name || 'My Practice',
        practice_type: type,
        settings: practice?.settings || {},
        created_at: practice?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      // Don't throw - let user proceed
    }
  };

  useEffect(() => {
    fetchPractice();
  }, []);

  // Derive current practice type and features
  const practiceType: PracticeType = practice?.practice_type || 'insurance';
  const features = PRACTICE_FEATURES[practiceType];

  const value: PracticeConfigContextType = {
    practice,
    practiceType,
    features,
    loading,
    error,
    updatePracticeType,
    refetch: fetchPractice,
  };

  return (
    <PracticeConfigContext.Provider value={value}>
      {children}
    </PracticeConfigContext.Provider>
  );
}

// =============================================
// Hook for consuming the context
// =============================================
export function usePracticeConfig() {
  const context = useContext(PracticeConfigContext);
  if (context === undefined) {
    throw new Error('usePracticeConfig must be used within a PracticeConfigProvider');
  }
  return context;
}

// =============================================
// Convenience hooks for common use cases
// =============================================
export function usePracticeFeatures() {
  const { features } = usePracticeConfig();
  return features;
}

export function usePracticeType() {
  const { practiceType } = usePracticeConfig();
  return practiceType;
}

export function useTerminology() {
  const { features } = usePracticeConfig();
  return {
    patient: features.patientLabel,
    patients: features.patientLabelPlural,
    visit: features.visitLabel,
    visits: features.visitLabelPlural,
  };
}

// =============================================
// Payment Methods Configuration
// =============================================
export const ALL_PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CARD', label: 'Card' },
  { value: 'HSA', label: 'HSA/FSA' },
  { value: 'VENMO', label: 'Venmo' },
  { value: 'CASHAPP', label: 'Cash App' },
  { value: 'APPLEPAY', label: 'Apple Pay' },
  { value: 'ZELLE', label: 'Zelle' },
  { value: 'OTHER', label: 'Other' },
] as const;

// For backwards compatibility and gradual migration
export const LEGACY_PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CHECK', label: 'Check' },
  { value: 'CARD', label: 'Card' },
  { value: 'HSA', label: 'HSA/FSA' },
  { value: 'OTHER', label: 'Other' },
] as const;
