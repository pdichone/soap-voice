'use client';

import { OnboardingSection } from './OnboardingSection';
import type {
  OnboardingStatus,
  OnboardingChecklist,
  OnboardingQuestionnaire,
  OnboardingUpdateInput,
} from '@/lib/types-onboarding';

interface OnboardingSectionWrapperProps {
  practitionerId: string;
  practitionerName: string;
  onboardingStatus: OnboardingStatus;
  onboardingNotes: string | null;
  onboardingStartedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingChecklist: OnboardingChecklist;
  questionnaire: OnboardingQuestionnaire | null;
}

export function OnboardingSectionWrapper(props: OnboardingSectionWrapperProps) {
  const handleUpdate = async (data: OnboardingUpdateInput) => {
    const response = await fetch(`/api/admin/practitioners/${props.practitionerId}/onboarding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update onboarding');
    }
  };

  return <OnboardingSection {...props} onUpdate={handleUpdate} />;
}
