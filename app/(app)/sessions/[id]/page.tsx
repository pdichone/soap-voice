import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { SOAPNote } from '@/components/SOAPNote';
import { ExportPDFButton } from '@/components/ExportPDFButton';
import type { Client } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      *,
      client:clients(id, name)
    `)
    .eq('id', id)
    .eq('therapist_id', user?.id || '')
    .single() as { data: { id: string; client_id: string; therapist_id: string; audio_url: string | null; transcript: string | null; soap_note: { subjective: string; objective: string; assessment: string; plan: string } | null; raw_soap_text: string | null; session_date: string; created_at: string; client: Pick<Client, 'id' | 'name'> | null } | null };

  if (!session) {
    notFound();
  }

  return (
    <div className="p-4 pb-24">
      <header className="mb-6">
        <Link href="/history" className="text-blue-600 text-sm font-medium flex items-center gap-1 mb-2">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to History
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Session Notes</h1>
        <div className="mt-1 text-gray-600">
          <p>{session.client?.name || 'Unknown Client'}</p>
          <p className="text-sm">
            {new Date(session.session_date).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      </header>

      {session.soap_note && (
        <div className="mb-4 flex justify-end">
          <ExportPDFButton
            clientName={session.client?.name || 'Unknown Client'}
            sessionDate={session.session_date}
            soapNote={session.soap_note}
          />
        </div>
      )}

      {session.soap_note ? (
        <SOAPNote note={session.soap_note} />
      ) : session.raw_soap_text ? (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-900 mb-2">Session Notes</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{session.raw_soap_text}</p>
        </div>
      ) : (
        <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No SOAP notes available</p>
        </div>
      )}

      {session.transcript && (
        <section className="mt-6">
          <details className="bg-white rounded-lg border border-gray-200">
            <summary className="p-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
              View Transcript
            </summary>
            <div className="p-4 pt-0 border-t border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap text-sm">{session.transcript}</p>
            </div>
          </details>
        </section>
      )}

      {session.client && (
        <div className="mt-6">
          <Link
            href={`/clients/${session.client.id}`}
            className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-center transition-colors"
          >
            View Client Profile
          </Link>
        </div>
      )}
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
