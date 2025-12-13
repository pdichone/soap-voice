import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Session, Client } from '@/lib/types';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch profile to get timezone
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user?.id || '')
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';

  // Fetch recent sessions with client names
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      client:clients(name)
    `)
    .eq('therapist_id', user?.id || '')
    .order('session_date', { ascending: false })
    .limit(5) as { data: (Session & { client: Pick<Client, 'name'> | null })[] | null };

  return (
    <div className="p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">SOAP Voice</h1>
        <p className="text-gray-600">Record sessions, generate SOAP notes</p>
      </header>

      <div className="flex justify-center my-8">
        <Link
          href="/record"
          className="w-32 h-32 rounded-full bg-blue-600 hover:bg-blue-700 flex flex-col items-center justify-center text-white shadow-lg active:scale-95 transition-transform"
        >
          <MicIcon className="w-12 h-12" />
          <span className="text-sm mt-2 font-medium">Record</span>
        </Link>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sessions</h2>
          <Link href="/history" className="text-blue-600 text-sm font-medium">
            View all
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
                      {session.client?.name || 'Unknown Client'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(session.session_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: timezone,
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
            <p className="text-sm text-gray-400 mt-1">Tap Record to create your first session</p>
          </div>
        )}
      </section>
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
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
