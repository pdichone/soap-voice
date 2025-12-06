'use client';

import { useState } from 'react';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePracticeConfig } from '@/lib/practice-config';
import type { PracticeType } from '@/lib/types-ops';
import Image from 'next/image';

interface PracticeOption {
  type: PracticeType;
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
}

const PRACTICE_OPTIONS: PracticeOption[] = [
  {
    type: 'cash_only',
    title: 'Private Practice',
    description: 'Cash/self-pay clients only',
    features: [
      'Simple client management',
      'Session tracking & payments',
      'No insurance paperwork',
      'Multiple payment methods',
    ],
    icon: <WalletIcon className="w-8 h-8 text-green-600" />,
  },
  {
    type: 'insurance',
    title: 'Insurance Practice',
    description: 'Bill insurance for services',
    features: [
      'Claims tracking & management',
      'Referral management',
      'Patient collections',
      'Patient visit tracking',
    ],
    icon: <ClipboardIcon className="w-8 h-8 text-blue-600" />,
  },
  {
    type: 'school',
    title: 'School/Student Clinic',
    description: 'Training & supervision',
    features: [
      'Student session tracking',
      'Supervisor approval workflow',
      'Client management',
      'Progress tracking',
    ],
    icon: <GraduationIcon className="w-8 h-8 text-purple-600" />,
  },
];

export function Onboarding() {
  const { updatePracticeType, loading: configLoading } = usePracticeConfig();
  const [selectedType, setSelectedType] = useState<PracticeType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!selectedType) return;

    setSaving(true);
    setError(null);

    try {
      await updatePracticeType(selectedType);
      // The page will automatically re-render with the new practice type
    } catch (err) {
      console.error('Failed to set practice type:', err);
      setError('Failed to save your selection. Please try again.');
      setSaving(false);
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary/5 to-background p-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header */}
      <div className="pt-12 pb-8 px-4 text-center">
        <div className="flex justify-center mb-4">
          <Image src="/logo-icon.svg" alt="ZenLeef" width={64} height={64} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to <span className="text-primary">Zen</span>
          <span className="text-accent">Leef</span>
        </h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Let&apos;s set up your practice. Choose the option that best describes how you work.
        </p>
      </div>

      {/* Practice Type Selection */}
      <div className="px-4 pb-8 space-y-4 max-w-lg mx-auto">
        {PRACTICE_OPTIONS.map((option) => (
          <Card
            key={option.type}
            className={`cursor-pointer transition-all ${
              selectedType === option.type
                ? 'ring-2 ring-primary border-primary shadow-md'
                : 'hover:border-gray-300 hover:shadow-sm'
            }`}
            onClick={() => setSelectedType(option.type)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg">
                  {option.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{option.title}</CardTitle>
                    {selectedType === option.type && (
                      <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <CardDescription className="mt-1">{option.description}</CardDescription>
                  <ul className="mt-3 space-y-1">
                    {option.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handleContinue}
          disabled={!selectedType || saving}
          className="w-full h-12 text-base"
        >
          {saving ? 'Setting up...' : 'Continue'}
        </Button>

        <p className="text-xs text-center text-gray-500">
          You can change this later in Settings
        </p>
      </div>
    </div>
  );
}

// Icons
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function GraduationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
