'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface SendMagicLinkButtonProps {
  practitionerId: string;
  practitionerEmail: string;
  hasUserId: boolean;
}

export function SendMagicLinkButton({
  practitionerId,
  practitionerEmail,
  hasUserId,
}: SendMagicLinkButtonProps) {
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMagicLink = async () => {
    setSending(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`/api/admin/practitioners/${practitionerId}/send-magic-link`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send magic link');
        return;
      }

      setSuccess(true);
      // Reset success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Error sending magic link:', err);
      setError('Failed to send magic link');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={handleSendMagicLink}
        disabled={sending}
      >
        {sending ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Sending...
          </>
        ) : success ? (
          <>
            <svg
              className="w-4 h-4 mr-2 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Sent!
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {hasUserId ? 'Resend Magic Link' : 'Send Magic Link'}
          </>
        )}
      </Button>

      {/* Error toast */}
      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm shadow-md whitespace-nowrap">
          {error}
        </div>
      )}

      {/* Success toast */}
      {success && (
        <div className="absolute top-full mt-2 right-0 bg-green-50 text-green-700 px-3 py-2 rounded-md text-sm shadow-md whitespace-nowrap">
          Magic link sent to {practitionerEmail}
        </div>
      )}
    </div>
  );
}
