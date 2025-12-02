'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { RecordButton } from '@/components/clinical/RecordButton';
import { SOAPNote } from '@/components/clinical/SOAPNote';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { Client, SOAPNote as SOAPNoteType } from '@/lib/types';

type Step = 'record' | 'select-client' | 'processing' | 'review';

function RecordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');

  const [step, setStep] = useState<Step>('record');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [processingMessage, setProcessingMessage] = useState('');
  const [transcript, setTranscript] = useState('');
  const [soapNote, setSoapNote] = useState<SOAPNoteType | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { isRecording, audioBlob, duration, error: recordError, startRecording, stopRecording, resetRecording } = useAudioRecorder();

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (preselectedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === preselectedClientId);
      if (client) {
        setSelectedClient(client);
      }
    }
  }, [preselectedClientId, clients]);

  const loadClients = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('therapist_id', user.id)
        .order('name');
      if (data) setClients(data);
    }
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      resetRecording();
      startRecording();
    }
  };

  const handleContinue = () => {
    if (audioBlob) {
      // If client was preselected, skip selection and go straight to processing
      if (selectedClient) {
        setStep('processing');
        processRecording();
      } else {
        setStep('select-client');
      }
    }
  };

  const handleClientSelect = async (client: Client) => {
    setSelectedClient(client);
    setStep('processing');
    await processRecording();
  };

  const processRecording = async () => {
    if (!audioBlob) return;

    try {
      setError(null);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload audio
      setProcessingMessage('Uploading audio...');
      const fileName = `${user.id}/${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(fileName, audioBlob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('recordings')
        .getPublicUrl(fileName);
      setAudioUrl(publicUrl);

      // Transcribe
      setProcessingMessage('Transcribing audio...');
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json();
        throw new Error(err.error || 'Transcription failed');
      }

      const { transcript: transcribedText } = await transcribeRes.json();
      setTranscript(transcribedText);

      // Generate SOAP note
      setProcessingMessage('Generating SOAP note...');
      const soapRes = await fetch('/api/generate-soap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: transcribedText }),
      });

      if (!soapRes.ok) {
        const err = await soapRes.json();
        throw new Error(err.error || 'SOAP generation failed');
      }

      const { soapNote: generatedNote } = await soapRes.json();
      setSoapNote(generatedNote);
      setStep('review');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStep('select-client');
    }
  };

  const handleSave = async () => {
    if (!selectedClient || !soapNote) return;

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase.from('sessions').insert({
        client_id: selectedClient.id,
        therapist_id: user.id,
        audio_url: audioUrl,
        transcript,
        soap_note: soapNote,
        session_date: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      router.push(`/clients/${selectedClient.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 pb-24">
      <header className="mb-6">
        <Link
          href={selectedClient ? `/clients/${selectedClient.id}` : '/'}
          className="text-blue-600 text-sm font-medium flex items-center gap-1 mb-2"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          {selectedClient ? 'Back to Client' : 'Cancel'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Record Session</h1>
        {selectedClient && step === 'record' && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-semibold text-xs">
                {selectedClient.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-blue-800">{selectedClient.name}</span>
          </div>
        )}
      </header>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}
      {recordError && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">
          {recordError}
        </div>
      )}

      {step === 'record' && (
        <div className="text-center">
          <div className="flex flex-col items-center justify-center py-8">
            <RecordButton isRecording={isRecording} onClick={handleRecordToggle} />
            <p className="mt-12 text-2xl font-mono text-gray-700">
              {formatDuration(duration)}
            </p>
            {audioBlob && !isRecording && (
              <p className="mt-2 text-green-600 font-medium">Recording complete</p>
            )}
          </div>

          {audioBlob && !isRecording && (
            <div className="mt-8 space-y-3">
              <button
                onClick={handleContinue}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors min-h-[48px]"
              >
                {selectedClient ? 'Process Recording' : 'Select Client'}
              </button>
              <button
                onClick={() => { resetRecording(); }}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors min-h-[48px]"
              >
                Record Again
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'select-client' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Client</h2>
          <div className="space-y-3">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleClientSelect(client)}
                className="w-full p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 text-left transition-colors min-h-[56px]"
              >
                <p className="font-medium text-gray-900">{client.name}</p>
                {(client.phone || client.email) && (
                  <p className="text-sm text-gray-500">{client.phone || client.email}</p>
                )}
              </button>
            ))}
            <Link
              href="/clients/new"
              className="block w-full p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 text-center text-blue-600 font-medium min-h-[56px] flex items-center justify-center"
            >
              + Add New Client
            </Link>
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="py-12">
          <LoadingSpinner message={processingMessage} size="lg" />
        </div>
      )}

      {step === 'review' && soapNote && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Review SOAP Note</h2>
            <span className="text-sm text-gray-500">{selectedClient?.name}</span>
          </div>

          <SOAPNote
            note={soapNote}
            editable
            onChange={setSoapNote}
          />

          <div className="mt-6 space-y-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[48px]"
            >
              {saving ? 'Saving...' : 'Save Session'}
            </button>
            <button
              onClick={() => setStep('record')}
              disabled={saving}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors min-h-[48px]"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading..." />}>
      <RecordPageContent />
    </Suspense>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}
