'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase';
import type { Practice, PracticeType } from '@/lib/types-ops';

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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Get user's profile to find their practice_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('practice_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        // If profiles table doesn't have practice_id yet (migration not run),
        // default to insurance type
        console.warn('Could not fetch practice_id from profile:', profileError);
        setLoading(false);
        return;
      }

      if (!profile?.practice_id) {
        // No practice associated yet - use default
        setLoading(false);
        return;
      }

      // Fetch the practice details
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('*')
        .eq('id', profile.practice_id)
        .single();

      if (practiceError) {
        console.warn('Could not fetch practice:', practiceError);
        setLoading(false);
        return;
      }

      setPractice(practiceData);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (practice) {
        // Update existing practice
        console.log('Updating existing practice:', practice.id, 'to type:', type);
        const { error: updateError } = await supabase
          .from('practices')
          .update({ practice_type: type })
          .eq('id', practice.id);

        if (updateError) {
          console.error('Failed to update practice:', updateError);
          throw updateError;
        }

        setPractice({ ...practice, practice_type: type });
      } else {
        // First check if user already has a practice_id in profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('practice_id')
          .eq('id', user.id)
          .single();

        if (profile?.practice_id) {
          // User has a practice, just update it directly
          console.log('Found existing practice_id in profile:', profile.practice_id);
          const { data: existingPractice, error: fetchError } = await supabase
            .from('practices')
            .select('*')
            .eq('id', profile.practice_id)
            .single();

          if (fetchError) {
            console.error('Failed to fetch existing practice:', fetchError);
            throw fetchError;
          }

          const { error: updateError } = await supabase
            .from('practices')
            .update({ practice_type: type })
            .eq('id', profile.practice_id);

          if (updateError) {
            console.error('Failed to update existing practice:', updateError);
            throw updateError;
          }

          setPractice({ ...existingPractice, practice_type: type });
        } else {
          // Create a new practice for this user
          console.log('Creating new practice for user');
          const { data: newPractice, error: createError } = await supabase
            .from('practices')
            .insert({
              name: 'My Practice',
              practice_type: type,
              settings: {},
            })
            .select()
            .single();

          if (createError) {
            console.error('Failed to create practice:', createError);
            throw createError;
          }

          console.log('Created practice:', newPractice.id);

          // Link the practice to the user's profile
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ practice_id: newPractice.id })
            .eq('id', user.id);

          if (profileError) {
            console.error('Failed to update profile with practice_id:', profileError);
            throw profileError;
          }

          console.log('Updated profile with practice_id');

          // Also add user to practice_users junction table
          const { error: practiceUserError } = await supabase
            .from('practice_users')
            .insert({
              practice_id: newPractice.id,
              user_id: user.id,
              role: 'admin',
            });

          if (practiceUserError) {
            console.error('Failed to add user to practice_users:', practiceUserError);
            // Don't throw - this is not critical
          }

          setPractice(newPractice);
        }
      }
    } catch (err) {
      console.error('Error updating practice type:', err);
      throw err;
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
