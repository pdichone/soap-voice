'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PracticeType } from '@/lib/types-ops';

interface PracticeTypeOption {
  value: PracticeType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const practiceTypes: PracticeTypeOption[] = [
  {
    value: 'cash_only',
    label: 'Cash Only',
    description: 'Client/Session terminology, no insurance claims',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    value: 'insurance',
    label: 'Insurance',
    description: 'Patient/Visit terminology, with claims tracking',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    value: 'school',
    label: 'Massage School',
    description: 'Client/Session with supervisor features',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
];

interface PracticeTypeCardProps {
  practitionerId: string;
  currentPracticeType: PracticeType;
}

export function PracticeTypeCard({ practitionerId, currentPracticeType }: PracticeTypeCardProps) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<PracticeType>(currentPracticeType);
  const [updating, setUpdating] = useState(false);

  const handleSelect = async (newType: PracticeType) => {
    if (newType === selectedType) return;

    setUpdating(true);

    try {
      const response = await fetch(`/api/admin/practitioners/${practitionerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practice_type: newType }),
      });

      if (!response.ok) {
        throw new Error('Failed to update practice type');
      }

      setSelectedType(newType);
      router.refresh();
    } catch (error) {
      console.error('Error updating practice type:', error);
      alert('Failed to update practice type');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Practice Type</CardTitle>
        <CardDescription>
          Select the practice type to control terminology and features
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {practiceTypes.map((type) => {
            const isSelected = selectedType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => handleSelect(type.value)}
                disabled={updating}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                } ${updating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`${isSelected ? 'text-primary' : 'text-slate-400'}`}>
                    {type.icon}
                  </div>
                  <span className={`font-medium ${isSelected ? 'text-primary' : 'text-slate-900'}`}>
                    {type.label}
                  </span>
                  {isSelected && (
                    <svg className="w-4 h-4 text-primary ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-sm text-slate-500">{type.description}</p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
