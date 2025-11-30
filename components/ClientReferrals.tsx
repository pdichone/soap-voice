'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReferralUpload } from '@/components/ReferralUpload';
import { ReferralCard } from '@/components/ReferralCard';
import type { Referral, ReferringProvider } from '@/lib/types';

interface ClientReferralsProps {
  clientId: string;
  referrals: Referral[];
  providers: Pick<ReferringProvider, 'id' | 'name' | 'specialty'>[];
}

export function ClientReferrals({ clientId, referrals, providers }: ClientReferralsProps) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleSuccess = () => {
    setShowAddForm(false);
    router.refresh();
  };

  const handleDelete = () => {
    router.refresh();
  };

  // Check for any expiring/expired referrals
  const hasExpiredReferrals = referrals.some(
    r => r.expiration_date && new Date(r.expiration_date) < new Date()
  );
  const hasExpiringSoon = referrals.some(r => {
    if (!r.expiration_date) return false;
    const expDate = new Date(r.expiration_date);
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return expDate > now && expDate < thirtyDaysFromNow;
  });

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Referrals & Documents</h2>
          {hasExpiredReferrals && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
              Expired
            </span>
          )}
          {!hasExpiredReferrals && hasExpiringSoon && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              Expiring soon
            </span>
          )}
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors min-h-[36px] flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            Add Referral
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-4">
          <ReferralUpload
            clientId={clientId}
            providers={providers}
            onSuccess={handleSuccess}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {referrals.length > 0 ? (
        <div className="space-y-3">
          {referrals.map((referral) => (
            <ReferralCard
              key={referral.id}
              referral={referral}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : !showAddForm ? (
        <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
          <DocumentIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 mb-3">No referrals on file</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="text-blue-600 font-medium text-sm"
          >
            Add the first referral
          </button>
        </div>
      ) : null}
    </section>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
