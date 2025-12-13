import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Session, Client } from '@/lib/types';

export default async function HistoryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch profile to get timezone
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user?.id || '')
    .single();

  const timezone = profile?.timezone || 'America/Los_Angeles';

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      client:clients(name)
    `)
    .eq('therapist_id', user?.id || '')
    .order('session_date', { ascending: false }) as { data: (Session & { client: Pick<Client, 'name'> | null })[] | null };

  // Group sessions by date
  const groupedSessions: Record<string, typeof sessions> = {};
  sessions?.forEach((session) => {
    const date = new Date(session.session_date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    });
    if (!groupedSessions[date]) {
      groupedSessions[date] = [];
    }
    groupedSessions[date]!.push(session);
  });

  return (
    <div className="p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">History</h1>
        <p className="text-gray-600">All session records</p>
      </header>

      {Object.keys(groupedSessions).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedSessions).map(([date, dateSessions]) => (
            <section key={date}>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">{date}</h2>
              <div className="space-y-3">
                {dateSessions?.map((session) => (
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
                          {new Date(session.session_date).toLocaleTimeString('en-US', {
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
            </section>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No sessions yet</p>
          <Link href="/" className="inline-block mt-4 text-blue-600 font-medium">
            Record your first session
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
