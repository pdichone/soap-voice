'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { X, CheckCircle } from 'lucide-react';

export function PaymentSuccessBanner() {
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setShow(true);
      // Clear the query param from URL without refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600" />
        <div>
          <p className="font-medium text-emerald-900">Payment successful!</p>
          <p className="text-sm text-emerald-700">Welcome to Zenleef. Your subscription is now active.</p>
        </div>
      </div>
      <button
        onClick={() => setShow(false)}
        className="p-1 hover:bg-emerald-100 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-emerald-600" />
      </button>
    </div>
  );
}
