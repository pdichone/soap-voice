'use client';

import { useEffectiveUser } from '@/lib/contexts/effective-user-context';
import { useState } from 'react';

export function ImpersonationBanner() {
  const { isImpersonating, practitionerName, adminReturnUrl, loading } = useEffectiveUser();
  const [exiting, setExiting] = useState(false);

  if (loading || !isImpersonating) {
    return null;
  }

  const handleExit = async () => {
    setExiting(true);
    try {
      const response = await fetch('/api/admin/impersonate/end', {
        method: 'POST',
      });

      if (response.ok) {
        // Redirect to admin portal or return URL
        if (adminReturnUrl) {
          window.location.href = adminReturnUrl;
        } else {
          window.location.href = '/admin/practitioners';
        }
      } else {
        console.error('Failed to end impersonation');
        setExiting(false);
      }
    } catch (error) {
      console.error('Error ending impersonation:', error);
      setExiting(false);
    }
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>
          Viewing as <strong>{practitionerName || 'practitioner'}</strong>
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="bg-white text-amber-600 px-3 py-1 rounded text-xs font-medium hover:bg-amber-50 transition-colors disabled:opacity-50"
      >
        {exiting ? 'Exiting...' : 'Exit View'}
      </button>
    </div>
  );
}
