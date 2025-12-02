import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { ReferringProvider } from '@/lib/types';

export default async function ProvidersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: providers } = await supabase
    .from('referring_providers')
    .select('*')
    .eq('therapist_id', user?.id || '')
    .order('name', { ascending: true }) as { data: ReferringProvider[] | null };

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referring Providers</h1>
          <p className="text-sm text-gray-500">Doctors, chiropractors, PTs who refer clients</p>
        </div>
        <Link
          href="/providers/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors min-h-[48px] flex items-center"
        >
          Add Provider
        </Link>
      </header>

      {providers && providers.length > 0 ? (
        <div className="space-y-3">
          {providers.map((provider) => (
            <Link
              key={provider.id}
              href={`/providers/${provider.id}`}
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">{provider.name}</h3>
                  <div className="flex flex-wrap gap-x-3 text-sm text-gray-500 mt-0.5">
                    {provider.specialty && <span>{provider.specialty}</span>}
                    {provider.practice_name && <span>• {provider.practice_name}</span>}
                  </div>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <MedicalIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No referring providers yet</p>
          <p className="text-sm text-gray-400 mt-1">Add doctors, chiropractors, and other healthcare providers who refer clients to you</p>
          <Link
            href="/providers/new"
            className="inline-block mt-4 text-blue-600 font-medium"
          >
            Add your first provider
          </Link>
        </div>
      )}
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function MedicalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
