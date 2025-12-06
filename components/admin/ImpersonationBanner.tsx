'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { ImpersonationContext } from '@/lib/types-ops';

interface ImpersonationBannerProps {
  context: ImpersonationContext;
}

export function ImpersonationBanner({ context }: ImpersonationBannerProps) {
  const router = useRouter();

  if (!context.isImpersonating) {
    return null;
  }

  const handleEndSession = async () => {
    try {
      const response = await fetch(
        `/api/admin/impersonate?session_id=${context.sessionId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      }
    } catch (error) {
      console.error('Error ending impersonation:', error);
    }
  };

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span className="font-medium">
          ADMIN IMPERSONATION MODE: Viewing as {context.practitionerName}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-amber-100">
          All actions are being logged
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleEndSession}
          className="bg-white text-amber-600 hover:bg-amber-50"
        >
          End Session
        </Button>
      </div>
    </div>
  );
}
