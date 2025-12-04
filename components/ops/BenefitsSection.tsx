'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PatientBenefits, PatientNonPhi } from '@/lib/types-ops';
import { getCollectAmount, calculateProgress, getCollectionColorClass } from '@/lib/benefits-calculator';
import { EditBenefitsModal } from './EditBenefitsModal';

interface BenefitsSectionProps {
  patient: PatientNonPhi;
  benefits: PatientBenefits | null;
  onBenefitsUpdate: () => void;
}

export function BenefitsSection({ patient, benefits, onBenefitsUpdate }: BenefitsSectionProps) {
  const [showEditModal, setShowEditModal] = useState(false);

  // Calculate what to collect
  const collectionResult = getCollectAmount(patient, benefits);
  const colorClass = getCollectionColorClass(collectionResult);

  // Calculate progress percentages
  const deductibleProgress = benefits ? calculateProgress(benefits.deductible_paid, benefits.deductible_amount) : 0;
  const oopProgress = benefits ? calculateProgress(benefits.oop_paid, benefits.oop_max) : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Insurance Benefits</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Collection Amount Card */}
          <div className={`rounded-lg p-4 ${colorClass}`}>
            <div className="flex items-center gap-2 mb-1">
              <DollarIcon className="w-5 h-5" />
              <span className="text-lg font-bold">
                COLLECT TODAY: ${collectionResult.collect_amount.toFixed(2)}
              </span>
            </div>
            <p className="text-sm opacity-80">
              {collectionResult.explanation}
            </p>
          </div>

          {/* Benefit Notes */}
          {benefits?.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <NoteIcon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">BENEFIT NOTES</span>
              </div>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{benefits.notes}</p>
            </div>
          )}

          {/* Benefits Details */}
          {benefits && benefits.allowed_amount > 0 ? (
            <div className="space-y-4 pt-2">
              {/* Deductible Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">DEDUCTIBLE</span>
                  <span className="text-sm text-gray-500">
                    ${benefits.deductible_paid.toFixed(2)} / ${benefits.deductible_amount.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${deductibleProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${deductibleProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">{deductibleProgress}%</span>
                  <span className="text-xs text-gray-500">
                    ${(benefits.deductible_amount - benefits.deductible_paid).toFixed(2)} remaining
                  </span>
                </div>
              </div>

              {/* OOP Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">OUT-OF-POCKET MAX</span>
                  <span className="text-sm text-gray-500">
                    ${benefits.oop_paid.toFixed(2)} / ${benefits.oop_max.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${oopProgress >= 100 ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${oopProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">{oopProgress}%</span>
                  <span className="text-xs text-gray-500">
                    ${(benefits.oop_max - benefits.oop_paid).toFixed(2)} remaining
                  </span>
                </div>
              </div>

              {/* Coinsurance & Allowed Amount */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 uppercase">Coinsurance</p>
                  <p className="text-lg font-semibold text-gray-900">{benefits.coinsurance_percent}%</p>
                  <p className="text-xs text-gray-500">after deductible</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 uppercase">Allowed Amount</p>
                  <p className="text-lg font-semibold text-gray-900">${benefits.allowed_amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">per visit</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm mb-3">No benefits configured yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                Set Up Benefits
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <EditBenefitsModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        patient={patient}
        benefits={benefits}
        onSave={() => {
          setShowEditModal(false);
          onBenefitsUpdate();
        }}
      />
    </>
  );
}

// Icons
function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function NoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
