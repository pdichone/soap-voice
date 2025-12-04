'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuestionRenderer } from '@/components/intake/QuestionRenderer';
import type { IntakeForm, IntakeQuestion, IntakeResponseData } from '@/lib/types-intake';

type PageState = 'loading' | 'form' | 'completed' | 'already_completed' | 'error' | 'expired';

export default function PublicIntakeFormPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [form, setForm] = useState<IntakeForm | null>(null);
  const [patientName, setPatientName] = useState('');
  const [responses, setResponses] = useState<IntakeResponseData>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadForm();
  }, [token]);

  const loadForm = async () => {
    try {
      const res = await fetch(`/api/intake/${token}`);
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 410) {
          setState('expired');
        } else {
          setErrorMessage(data.error || 'Form not found');
          setState('error');
        }
        return;
      }

      if (data.already_completed) {
        setPatientName(data.patient_name);
        setState('already_completed');
        return;
      }

      setForm(data.form);
      setPatientName(data.patient_name);
      setState('form');
    } catch {
      setErrorMessage('Failed to load form');
      setState('error');
    }
  };

  const validateForm = (): boolean => {
    if (!form) return false;

    const newErrors: Record<string, string> = {};
    let isValid = true;

    form.questions.forEach((question: IntakeQuestion) => {
      if (question.required && question.type !== 'section') {
        const value = responses[question.id];

        if (value === undefined || value === null || value === '') {
          newErrors[question.id] = 'This field is required';
          isValid = false;
        } else if (question.type === 'yesno' && typeof value !== 'boolean') {
          newErrors[question.id] = 'Please select Yes or No';
          isValid = false;
        } else if (question.type === 'multiselect' && Array.isArray(value) && value.length === 0) {
          newErrors[question.id] = 'Please select at least one option';
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorId = Object.keys(errors)[0];
      if (firstErrorId) {
        document.getElementById(firstErrorId)?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to submit form');
        setSubmitting(false);
        return;
      }

      setState('completed');
    } catch {
      setErrorMessage('Failed to submit form. Please try again.');
      setSubmitting(false);
    }
  };

  // Loading State
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-gray-500 mt-4 animate-pulse">Loading form...</p>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Form Not Found</h2>
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
            <p className="text-gray-500">This intake form link has expired. Please contact your provider for a new link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already Completed State
  if (state === 'already_completed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Already Submitted</h2>
            <p className="text-gray-500">
              This intake form has already been completed. Thank you, {patientName}!
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
              Your intake form has been submitted successfully. We look forward to seeing you!
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
            <CardTitle className="text-2xl">{form?.title}</CardTitle>
            {form?.description && (
              <p className="text-gray-500 text-sm mt-2">{form.description}</p>
            )}
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="py-6">
            {errorMessage && (
              <div className="mb-6 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
                {errorMessage}
              </div>
            )}

            <QuestionRenderer
              questions={form?.questions || []}
              responses={responses}
              onChange={setResponses}
              errors={errors}
            />

            <div className="mt-8 pt-6 border-t">
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-6 text-lg"
              >
                {submitting ? 'Submitting...' : 'Submit Form'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your information is secure and will only be shared with your healthcare provider.
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
