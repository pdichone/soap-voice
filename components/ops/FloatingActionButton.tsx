'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePracticeConfig } from '@/lib/practice-config';

// Pages that already have their own add button - hide FAB on these
const PAGES_WITH_ADD_BUTTON = ['/visits', '/patients', '/claims', '/referrals', '/payments'];

export function FloatingActionButton() {
  const { features } = usePracticeConfig();
  const pathname = usePathname();

  // Hide FAB on pages that already have an add button in the header
  const isPageWithAddButton = PAGES_WITH_ADD_BUTTON.some(page => pathname === page);
  if (isPageWithAddButton) {
    return null;
  }

  // Check if we're on a patient detail page and extract the patient ID
  const patientDetailMatch = pathname.match(/^\/patients\/([^/]+)$/);
  const patientId = patientDetailMatch ? patientDetailMatch[1] : null;

  // Build the href - include patientId if we're on a patient detail page
  const href = patientId
    ? `/visits?patientId=${patientId}&action=new`
    : '/visits?action=new';

  return (
    <Link
      href={href}
      className="fixed right-4 bottom-24 z-30 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-95"
      aria-label={`Add ${features.visitLabel}`}
    >
      <PlusIcon className="w-5 h-5" />
      <span className="font-medium text-sm">Add {features.visitLabel}</span>
    </Link>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
