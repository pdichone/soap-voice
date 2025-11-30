import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { ClientReferrals } from '@/components/ClientReferrals';
import type { Session, ReferringProvider, Referral } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('therapist_id', user?.id || '')
    .single();

  if (!client) {
    notFound();
  }

  // Get referring provider if exists
  let referringProvider: Pick<ReferringProvider, 'id' | 'name' | 'specialty'> | null = null;
  if (client.referring_provider_id) {
    const { data } = await supabase
      .from('referring_providers')
      .select('id, name, specialty')
      .eq('id', client.referring_provider_id)
      .single();
    referringProvider = data;
  }

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('client_id', id)
    .order('session_date', { ascending: false }) as { data: Session[] | null };

  // Get referrals for this client
  const { data: referrals } = await supabase
    .from('referrals')
    .select('*')
    .eq('client_id', id)
    .order('referral_date', { ascending: false }) as { data: Referral[] | null };

  // Get all referring providers for the add referral form
  const { data: allProviders } = await supabase
    .from('referring_providers')
    .select('id, name, specialty')
    .eq('therapist_id', user?.id || '')
    .order('name') as { data: Pick<ReferringProvider, 'id' | 'name' | 'specialty'>[] | null };

  return (
    <div className="p-4">
      <header className="mb-6">
        <Link href="/clients" className="text-blue-600 text-sm font-medium flex items-center gap-1 mb-2">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Clients
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
        {(client.phone || client.email) && (
          <p className="text-gray-600 mt-1">
            {client.phone && <span>{client.phone}</span>}
            {client.phone && client.email && <span className="mx-2">•</span>}
            {client.email && <span>{client.email}</span>}
          </p>
        )}
      </header>

      {referringProvider && (
        <section className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Referred by:</span>{' '}
            <Link href={`/providers/${referringProvider.id}`} className="text-blue-600 hover:underline">
              {referringProvider.name}
            </Link>
            {referringProvider.specialty && (
              <span className="text-blue-600"> ({referringProvider.specialty})</span>
            )}
          </p>
        </section>
      )}

      {client.notes && (
        <section className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Notes</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{client.notes}</p>
        </section>
      )}

      <ClientReferrals
        clientId={client.id}
        referrals={referrals || []}
        providers={allProviders || []}
      />

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Sessions</h2>
          <Link
            href={`/record?clientId=${client.id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors min-h-[44px] flex items-center"
          >
            New Session
          </Link>
        </div>

        {sessions && sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(session.session_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(session.session_date).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">No sessions yet</p>
            <Link
              href={`/record?clientId=${client.id}`}
              className="inline-block mt-3 text-blue-600 font-medium"
            >
              Record first session
            </Link>
          </div>
        )}
      </section>
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

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
