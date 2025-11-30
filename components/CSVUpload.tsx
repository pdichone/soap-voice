'use client';

import { useState, useRef } from 'react';

interface CSVUploadProps {
  onSuccess: () => void;
}

export function CSVUpload({ onSuccess }: CSVUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/clients/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess(data.message);
      onSuccess();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium text-gray-900 mb-2">Import Clients from CSV</h3>
      <p className="text-sm text-gray-500 mb-3">
        Upload a CSV file exported from your practice management software.
      </p>

      <div className="space-y-3">
        <label className="block">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleUpload}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              file:cursor-pointer file:min-h-[44px]
              disabled:opacity-50"
          />
        </label>

        {uploading && (
          <p className="text-sm text-blue-600">Importing clients...</p>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
        )}

        {success && (
          <p className="text-sm text-green-600 bg-green-50 p-2 rounded">{success}</p>
        )}

        <div className="flex items-center gap-4 text-sm">
          <a
            href="/sample-clients.csv"
            download
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <DownloadIcon className="w-4 h-4" />
            Download sample CSV
          </a>
          <details className="text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700">View format details</summary>
            <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
              <p className="text-sm mb-2">Supported columns:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>name</strong> or <strong>first_name, last_name</strong></li>
                <li><strong>phone</strong>, mobile, or cell</li>
                <li><strong>email</strong></li>
                <li><strong>notes</strong>, comments, or preferences</li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
