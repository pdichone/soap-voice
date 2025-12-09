'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function DangerZonePage() {
  const router = useRouter();
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    results?: { table: string; deleted: number; error?: string }[];
    note?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    if (confirmationText !== 'DELETE ALL DATA') {
      setError('Please type "DELETE ALL DATA" exactly to confirm');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/reset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'DELETE ALL DATA' }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset data');
        setIsDeleting(false);
        return;
      }

      setResult(data);
      setShowConfirmDialog(false);
      setConfirmationText('');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <WarningIcon className="w-7 h-7" />
              Danger Zone
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Testing phase only — destructive operations
            </p>
          </div>
          <Link href="/admin" className="text-sm text-blue-600 hover:underline">
            ← Back to Admin
          </Link>
        </header>

        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <InfoIcon className="w-5 h-5 text-amber-600 mt-0.5" />
            </div>
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">⚠️ Testing Phase Only</p>
              <p>
                This page is intended for the development and testing phase.
                These operations permanently delete data and cannot be undone.
                Remove this page before going to production.
              </p>
            </div>
          </div>
        </div>

        {/* Success Result */}
        {result && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckIcon className="w-5 h-5" />
                <span className="font-medium">{result.message}</span>
              </div>

              {result.note && (
                <div className="bg-white/50 rounded-lg p-3 text-sm text-emerald-800">
                  <p className="font-medium">Important:</p>
                  <p>{result.note}</p>
                </div>
              )}

              {result.results && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-emerald-700 font-medium">
                    View deletion details
                  </summary>
                  <div className="mt-2 bg-white/50 rounded-lg p-3 space-y-1">
                    {result.results.map(({ table, deleted, error }) => (
                      <div key={table} className="flex justify-between text-gray-600">
                        <span>{table}</span>
                        {error ? (
                          <span className="text-red-600 text-xs">{error}</span>
                        ) : (
                          <span>{deleted} deleted</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <Button
                onClick={() => router.push('/admin')}
                className="w-full"
              >
                Return to Admin Dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Reset All Data Card */}
        {!result && (
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                <TrashIcon className="w-5 h-5" />
                Reset All Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                This will permanently delete all data from the database including:
              </p>
              <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
                <li>All patients/clients and their records</li>
                <li>All visits and SOAP notes</li>
                <li>All referrals and claims</li>
                <li>All payments</li>
                <li>All intake forms and responses</li>
                <li>All practitioners and profiles</li>
                <li>All practice configuration</li>
              </ul>

              <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
                <p className="font-medium">Note:</p>
                <p>
                  Auth users must be deleted manually from the Supabase Dashboard
                  (Authentication → Users) after running this reset.
                </p>
              </div>

              {!showConfirmDialog ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowConfirmDialog(true)}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  Reset All Data...
                </Button>
              ) : (
                <div className="space-y-4 border-t border-red-100 pt-4">
                  <p className="text-sm font-medium text-gray-700">
                    Type <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600">DELETE ALL DATA</code> to confirm:
                  </p>
                  <Input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Type confirmation phrase..."
                    className="border-red-200 focus:border-red-400 focus:ring-red-400"
                  />

                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowConfirmDialog(false);
                        setConfirmationText('');
                        setError(null);
                      }}
                      className="flex-1"
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReset}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                      disabled={isDeleting || confirmationText !== 'DELETE ALL DATA'}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Everything'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
