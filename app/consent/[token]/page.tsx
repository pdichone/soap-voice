'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DocumentTemplate {
  id: string;
  title: string;
  content: string;
  document_type: string;
  is_required: boolean;
}

type PageState = 'loading' | 'form' | 'completed' | 'already_signed' | 'error' | 'expired';

export default function PublicConsentPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [document, setDocument] = useState<DocumentTemplate | null>(null);
  const [patientName, setPatientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadDocument();
  }, [token]);

  const loadDocument = async () => {
    try {
      const res = await fetch(`/api/consent/${token}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          setState('expired');
        } else {
          setErrorMessage(data.error || 'Document not found');
          setState('error');
        }
        return;
      }

      if (data.already_signed) {
        setPatientName(data.patient_name);
        setState('already_signed');
        return;
      }

      setDocument(data.document);
      setPatientName(data.patient_name);
      setState('form');
    } catch {
      setErrorMessage('Failed to load document');
      setState('error');
    }
  };

  const handleSign = async () => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/consent/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to sign document');
        setSubmitting(false);
        return;
      }

      setState('completed');
    } catch {
      setErrorMessage('Failed to sign document. Please try again.');
      setSubmitting(false);
    }
  };

  // Loading State
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-gray-500 mt-4 animate-pulse">Loading document...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Document Not Found</h2>
            <p className="text-gray-500">{errorMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired State
  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <ClockIcon className="w-6 h-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Link Expired</h2>
            <p className="text-gray-500">This consent form link has expired. Please contact your provider for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already Signed State
  if (state === 'already_signed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Signed</h2>
            <p className="text-gray-500">
              This document has already been signed. Thank you, {patientName}!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Completed State
  if (state === 'completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-500">
              Your signature has been recorded. We look forward to seeing you!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form State
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader className="text-center pb-2">
            <p className="text-sm text-gray-500 mb-1">Welcome, {patientName}</p>
            <CardTitle className="text-2xl">{document?.title}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="py-6">
            {errorMessage && (
              <div className="mb-6 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
                {errorMessage}
              </div>
            )}

            {/* Document Content */}
            <div className="prose prose-sm max-w-none mb-8">
              {document?.content
                .replace(/\{\{\s*client_name\s*\}\}/gi, patientName)
                .replace(/\{\{\s*date\s*\}\}/gi, new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
                .split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-4 text-gray-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Signature Section */}
            <div className="border-t pt-6 mt-6">
              <p className="text-sm text-gray-600 mb-4">
                By clicking &quot;Sign Document&quot; below, I, <strong>{patientName}</strong>, acknowledge that I have read and understand this document.
              </p>
              <Button
                onClick={handleSign}
                disabled={submitting}
                className="w-full py-6 text-lg"
              >
                {submitting ? 'Signing...' : 'Sign Document'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your signature is secure and will only be shared with your healthcare provider.
        </p>
      </div>
    </div>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
