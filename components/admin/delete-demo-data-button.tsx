'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteDemoDataButtonProps {
  practitionerId: string;
  hasUserId: boolean;
}

export function DeleteDemoDataButton({ practitionerId, hasUserId }: DeleteDemoDataButtonProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ patients_deleted: number } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteDemoData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/practitioners/${practitionerId}/delete-demo-data`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete demo data');
        return;
      }

      setSuccess(true);
      setResult(data.data);
      setShowConfirm(false);

      // Refresh the page after 2 seconds to show updated stats
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Error deleting demo data:', err);
      setError('Failed to delete demo data');
    } finally {
      setLoading(false);
    }
  };

  // Don't show button if practitioner hasn't logged in yet
  if (!hasUserId) {
    return null;
  }

  if (success && result) {
    return (
      <Button variant="outline" disabled className="text-green-600">
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
            d="M5 13l4 4L19 7"
          />
        </svg>
        Deleted {result.patients_deleted} demo patients
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setShowConfirm(true)}
        className="text-red-600 hover:text-red-700 hover:border-red-300"
      >
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
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete Demo Data
      </Button>

      <Dialog open={showConfirm} onOpenChange={(open) => {
        setShowConfirm(open);
        if (!open) setError(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Demo Data</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all demo data for this practitioner? This will remove all patients with &quot;(Demo)&quot; in their name and their associated visits, referrals, and payments.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDemoData}
              disabled={loading}
            >
              {loading ? (
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
                  Deleting...
                </>
              ) : (
                'Delete Demo Data'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
