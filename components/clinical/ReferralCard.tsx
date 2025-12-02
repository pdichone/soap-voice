'use client';

import { useState } from 'react';
import type { Referral } from '@/lib/types';

interface ReferralCardProps {
  referral: Referral;
  onDelete: () => void;
}

export function ReferralCard({ referral, onDelete }: ReferralCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/referrals/${referral.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete');
      }

      onDelete();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete referral');
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  const isExpired = referral.expiration_date && new Date(referral.expiration_date) < new Date();
  const expiressSoon = referral.expiration_date && !isExpired &&
    new Date(referral.expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div className={`p-4 rounded-lg border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Provider & Date */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{referral.provider_name}</span>
            <span className="text-gray-400">•</span>
            <span className="text-sm text-gray-600">
              {new Date(referral.referral_date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {/* Diagnosis */}
          {referral.diagnosis && (
            <p className="mt-1 text-sm text-gray-700">
              <span className="font-medium">Dx:</span> {referral.diagnosis}
              {referral.icd_code && <span className="text-gray-500 ml-1">({referral.icd_code})</span>}
            </p>
          )}

          {/* Visits & Expiration */}
          <div className="mt-2 flex items-center gap-4 text-xs">
            {referral.visits_authorized && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {referral.visits_authorized} visits authorized
              </span>
            )}
            {referral.expiration_date && (
              <span className={`px-2 py-1 rounded ${
                isExpired
                  ? 'bg-red-100 text-red-700'
                  : expiressSoon
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
              }`}>
                {isExpired ? 'Expired' : 'Expires'}: {new Date(referral.expiration_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* Notes */}
          {referral.notes && (
            <p className="mt-2 text-sm text-gray-500 italic">{referral.notes}</p>
          )}

          {/* Document Link */}
          {referral.document_url && (
            <a
              href={referral.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <DocumentIcon className="w-4 h-4" />
              {referral.document_name || 'View Document'}
            </a>
          )}
        </div>

        {/* Delete Button */}
        <div className="flex-shrink-0">
          {showConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '...' : 'Yes'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete referral"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
