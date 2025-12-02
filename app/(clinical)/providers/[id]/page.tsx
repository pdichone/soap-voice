import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { ReferringProvider, Client } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProviderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: provider } = await supabase
    .from('referring_providers')
    .select('*')
    .eq('id', id)
    .eq('therapist_id', user?.id || '')
    .single() as { data: ReferringProvider | null };

  if (!provider) {
    notFound();
  }

  // Get clients referred by this provider
  const { data: referredClients } = await supabase
    .from('clients')
    .select('id, name, created_at')
    .eq('referring_provider_id', id)
    .order('name') as { data: Pick<Client, 'id' | 'name' | 'created_at'>[] | null };

  return (
    <div className="p-4">
      <header className="mb-6">
        <Link href="/providers" className="text-blue-600 text-sm font-medium flex items-center gap-1 mb-2">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Providers
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{provider.name}</h1>
        {provider.specialty && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-sm rounded">
            {provider.specialty}
          </span>
        )}
      </header>

      <div className="space-y-4">
        {provider.practice_name && (
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <h2 className="text-sm font-medium text-gray-500 mb-1">Practice</h2>
            <p className="text-gray-900">{provider.practice_name}</p>
          </div>
        )}

        <div className="p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h2>
          <div className="space-y-2 text-gray-700">
            {provider.phone && (
              <p className="flex items-center gap-2">
                <PhoneIcon className="w-4 h-4 text-gray-400" />
                <a href={`tel:${provider.phone}`} className="text-blue-600">{provider.phone}</a>
              </p>
            )}
            {provider.fax && (
              <p className="flex items-center gap-2">
                <FaxIcon className="w-4 h-4 text-gray-400" />
                <span>Fax: {provider.fax}</span>
              </p>
            )}
            {provider.email && (
              <p className="flex items-center gap-2">
                <EmailIcon className="w-4 h-4 text-gray-400" />
                <a href={`mailto:${provider.email}`} className="text-blue-600">{provider.email}</a>
              </p>
            )}
            {provider.address && (
              <p className="flex items-start gap-2">
                <LocationIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                <span className="whitespace-pre-wrap">{provider.address}</span>
              </p>
            )}
          </div>
        </div>

        {provider.notes && (
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <h2 className="text-sm font-medium text-gray-500 mb-1">Notes</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{provider.notes}</p>
          </div>
        )}

        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <h2 className="text-sm font-medium text-green-800 mb-2">
            Referred Clients ({referredClients?.length || 0})
          </h2>
          {referredClients && referredClients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {referredClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="px-3 py-1 bg-white rounded-full text-sm text-green-700 border border-green-300 hover:bg-green-100 transition-colors"
                >
                  {client.name}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-green-600">No clients referred yet</p>
          )}
        </div>
      </div>
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

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function FaxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
