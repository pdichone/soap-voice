'use client';

import { useState, useRef } from 'react';
import type { ReferringProvider } from '@/lib/types';

interface ReferralUploadProps {
  clientId: string;
  providers: Pick<ReferringProvider, 'id' | 'name' | 'specialty'>[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReferralUpload({ clientId, providers, onSuccess, onCancel }: ReferralUploadProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append('client_id', clientId);

    // Get provider name from select or custom input
    const selectedProviderId = formData.get('referring_provider_id') as string;
    let providerName = formData.get('custom_provider_name') as string;

    if (selectedProviderId && selectedProviderId !== 'custom') {
      const provider = providers.find(p => p.id === selectedProviderId);
      providerName = provider?.name || '';
      formData.set('referring_provider_id', selectedProviderId);
    } else {
      formData.delete('referring_provider_id');
    }

    formData.set('provider_name', providerName);
    formData.delete('custom_provider_name');

    if (!providerName.trim()) {
      setError('Provider name is required');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create referral');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create referral');
    } finally {
      setSubmitting(false);
    }
  };

  const [showCustomProvider, setShowCustomProvider] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-4">Add Medical Referral</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Provider Selection */}
        <div>
          <label htmlFor="referring_provider_id" className="block text-sm font-medium text-gray-700 mb-1">
            Referring Provider *
          </label>
          {providers.length > 0 && !showCustomProvider ? (
            <div className="space-y-2">
              <select
                id="referring_provider_id"
                name="referring_provider_id"
                required={!showCustomProvider}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setShowCustomProvider(true);
                  }
                }}
              >
                <option value="">Select a provider...</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}{provider.specialty ? ` (${provider.specialty})` : ''}
                  </option>
                ))}
                <option value="custom">+ Add new provider</option>
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                name="custom_provider_name"
                placeholder="e.g., Dr. Smith, Valley Physical Therapy"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
              />
              {providers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCustomProvider(false)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Select from existing providers
                </button>
              )}
            </div>
          )}
        </div>

        {/* Referral Date */}
        <div>
          <label htmlFor="referral_date" className="block text-sm font-medium text-gray-700 mb-1">
            Referral Date *
          </label>
          <input
            type="date"
            id="referral_date"
            name="referral_date"
            required
            defaultValue={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
          />
        </div>

        {/* Diagnosis */}
        <div>
          <label htmlFor="diagnosis" className="block text-sm font-medium text-gray-700 mb-1">
            Diagnosis / Reason for Referral
          </label>
          <input
            type="text"
            id="diagnosis"
            name="diagnosis"
            placeholder="e.g., Lower back pain, Chronic tension headaches"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
          />
        </div>

        {/* ICD Code */}
        <div>
          <label htmlFor="icd_code" className="block text-sm font-medium text-gray-700 mb-1">
            ICD Code (if known)
          </label>
          <input
            type="text"
            id="icd_code"
            name="icd_code"
            placeholder="e.g., M54.5, G43.909"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
          />
        </div>

        {/* Visits & Expiration - Side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="visits_authorized" className="block text-sm font-medium text-gray-700 mb-1">
              Visits Authorized
            </label>
            <input
              type="number"
              id="visits_authorized"
              name="visits_authorized"
              min="1"
              placeholder="e.g., 6"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="expiration_date" className="block text-sm font-medium text-gray-700 mb-1">
              Expires On
            </label>
            <input
              type="date"
              id="expiration_date"
              name="expiration_date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
            />
          </div>
        </div>

        {/* Document Upload */}
        <div>
          <label htmlFor="document" className="block text-sm font-medium text-gray-700 mb-1">
            Referral Document
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="document"
            name="document"
            accept=".pdf,.jpg,.jpeg,.png,.heic"
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-gray-100 file:text-gray-700
              hover:file:bg-gray-200
              file:cursor-pointer file:min-h-[44px]"
          />
          <p className="mt-1 text-xs text-gray-500">
            PDF, JPG, PNG, or photo of paper referral
          </p>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="Any additional notes about this referral..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {submitting ? 'Saving...' : 'Save Referral'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
