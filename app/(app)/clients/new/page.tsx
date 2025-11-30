'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import type { ReferringProvider } from '@/lib/types';

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ReferringProvider[]>([]);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('referring_providers')
        .select('id, name, specialty')
        .eq('therapist_id', user.id)
        .order('name');
      if (data) setProviders(data as ReferringProvider[]);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const notes = formData.get('notes') as string;
    const referringProviderId = formData.get('referring_provider_id') as string;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('clients').insert({
      therapist_id: user.id,
      name,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
      referring_provider_id: referringProviderId || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push('/clients');
    router.refresh();
  };

  return (
    <div className="p-4">
      <header className="mb-6">
        <Link href="/clients" className="text-blue-600 text-sm font-medium flex items-center gap-1 mb-2">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Clients
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Add Client</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Full name"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="client@email.com"
          />
        </div>

        <div>
          <label htmlFor="referring_provider_id" className="block text-sm font-medium text-gray-700 mb-1">
            Referring Provider
          </label>
          <select
            id="referring_provider_id"
            name="referring_provider_id"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">No referral</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}{provider.specialty ? ` (${provider.specialty})` : ''}
              </option>
            ))}
          </select>
          {providers.length === 0 && (
            <Link href="/providers/new" className="text-sm text-blue-600 mt-1 inline-block">
              + Add a referring provider
            </Link>
          )}
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            placeholder="Allergies, preferences, etc."
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[48px]"
        >
          {loading ? 'Saving...' : 'Save Client'}
        </button>
      </form>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
