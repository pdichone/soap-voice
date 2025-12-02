'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClientCard } from '@/components/clinical/ClientCard';
import { CSVUpload } from '@/components/clinical/CSVUpload';
import type { Client } from '@/lib/types';

interface ClientsListProps {
  initialClients: Client[];
}

export function ClientsList({ initialClients }: ClientsListProps) {
  const router = useRouter();
  const [showImport, setShowImport] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleImportSuccess = () => {
    router.refresh();
    setTimeout(() => setShowImport(false), 2000);
  };

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return initialClients;

    const query = searchQuery.toLowerCase();
    return initialClients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      client.phone?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.notes?.toLowerCase().includes(query)
    );
  }, [initialClients, searchQuery]);

  return (
    <div className="p-4">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <Link href="/providers" className="text-sm text-blue-600 hover:underline">
            Manage Referring Providers →
          </Link>
        </div>
        <Link
          href="/clients/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors min-h-[48px] flex items-center"
        >
          Add Client
        </Link>
      </header>

      {/* Search Bar */}
      {initialClients.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[44px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-500">
              {filteredClients.length} {filteredClients.length === 1 ? 'result' : 'results'} found
            </p>
          )}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={() => setShowImport(!showImport)}
          className="text-sm text-blue-600 font-medium flex items-center gap-1"
        >
          <UploadIcon className="w-4 h-4" />
          {showImport ? 'Hide Import' : 'Import from CSV'}
        </button>
      </div>

      {showImport && (
        <div className="mb-6">
          <CSVUpload onSuccess={handleImportSuccess} />
        </div>
      )}

      {initialClients.length > 0 ? (
        filteredClients.length > 0 ? (
          <div className="space-y-3">
            {filteredClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No clients match &ldquo;{searchQuery}&rdquo;</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-blue-600 font-medium text-sm"
            >
              Clear search
            </button>
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500">No clients yet</p>
          <div className="mt-4 space-y-2">
            <Link
              href="/clients/new"
              className="inline-block text-blue-600 font-medium"
            >
              Add your first client
            </Link>
            <p className="text-sm text-gray-400">or</p>
            <button
              onClick={() => setShowImport(true)}
              className="text-blue-600 font-medium text-sm"
            >
              Import from CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
