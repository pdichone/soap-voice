import Link from 'next/link';
import type { Client } from '@/lib/types';

interface ClientCardProps {
  client: Client;
}

export function ClientCard({ client }: ClientCardProps) {
  // Get initials for avatar
  const initials = client.name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Link
      href={`/clients/${client.id}`}
      className="card-interactive block p-4"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
          {(client.phone || client.email) && (
            <p className="text-sm text-gray-500 truncate mt-0.5">
              {client.phone || client.email}
            </p>
          )}
        </div>

        {/* Arrow */}
        <ChevronRightIcon className="w-5 h-5 text-gray-300 flex-shrink-0" />
      </div>
    </Link>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
