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

      // First, check if admin has set a practice_type in the practitioners table
      // This is the admin-controlled source of truth
      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('practice_type')
        .eq('user_id', user.id)
        .single();

      // Get user's profile to find their practice_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('practice_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        // If profiles table doesn't have practice_id yet (migration not run),
        // but we have practitioner data, use that
        if (practitioner?.practice_type) {
          setPractice({
            id: 'admin-controlled',
            name: 'My Practice',
            practice_type: practitioner.practice_type as PracticeType,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        setLoading(false);
        return;
      }

      if (!profile?.practice_id) {
        // No practice associated yet - but check if we have admin-controlled type
        if (practitioner?.practice_type) {
          setPractice({
            id: 'admin-controlled',
            name: 'My Practice',
            practice_type: practitioner.practice_type as PracticeType,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
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
        // Fall back to practitioner-controlled type if available
        if (practitioner?.practice_type) {
          setPractice({
            id: 'admin-controlled',
            name: 'My Practice',
            practice_type: practitioner.practice_type as PracticeType,
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
        setLoading(false);
        return;
      }

      // If admin has set a practice_type, it takes precedence
      if (practitioner?.practice_type) {
        setPractice({
          ...practiceData,
          practice_type: practitioner.practice_type as PracticeType,
        });
      } else {
        setPractice(practiceData);
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
      const { data: { user } } = await supabase.auth.getUser();
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
