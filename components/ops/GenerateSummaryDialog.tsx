'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase';
import { generateChargesSummaryPDF, downloadPDF, sharePDF, emailPDF, type GeneratedPDF } from './ChargesSummaryPDF';
import type { ChargesSummaryData, PracticeSettings, PaymentNonPhi } from '@/lib/types-ops';

interface GenerateSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

type DateRangeOption = 'current_year' | 'previous_year' | 'custom';
type DialogState = 'select' | 'generating' | 'success';

export function GenerateSummaryDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
}: GenerateSummaryDialogProps) {
  const currentYear = new Date().getFullYear();
  const [dateRange, setDateRange] = useState<DateRangeOption>('current_year');
  const [loading, setLoading] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>('select');
  const [payments, setPayments] = useState<PaymentNonPhi[]>([]);
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({});
  const [generatedPDF, setGeneratedPDF] = useState<GeneratedPDF | null>(null);
  const [canShare, setCanShare] = useState(false);

  // Check if native share is available
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare);
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Cleanup URL when dialog closes
      if (generatedPDF?.url) {
        URL.revokeObjectURL(generatedPDF.url);
      }
      setDialogState('select');
      setGeneratedPDF(null);
    }
  }, [open, generatedPDF?.url]);

  // Load payments when dialog opens or date range changes
  useEffect(() => {
    if (open && dialogState === 'select') {
      loadPayments();
      loadPracticeSettings();
    }
  }, [open, dateRange, patientId, dialogState]);

  const getDateRange = (): { start: string; end: string; startDate: Date; endDate: Date } => {
    const year = dateRange === 'current_year' ? currentYear : currentYear - 1;
    const startDate = new Date(year, 0, 1); // Jan 1
    const endDate = new Date(year, 11, 31, 23, 59, 59); // Dec 31
    return {
      start: `January 1, ${year}`,
      end: `December 31, ${year}`,
      startDate,
      endDate,
    };
  };

  const loadPayments = async () => {
    setLoading(true);
    const supabase = createClient();
    const { startDate, endDate } = getDateRange();

    const { data } = await supabase
      .from('payments_non_phi')
      .select('*')
      .eq('patient_id', patientId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: true });

    setPayments(data || []);
    setLoading(false);
  };

  const loadPracticeSettings = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_id')
      .eq('id', user.id)
      .single();

    if (profile?.practice_id) {
      const { data: practice } = await supabase
        .from('practices')
        .select('settings')
        .eq('id', profile.practice_id)
        .single();

      if (practice?.settings) {
        setPracticeSettings(practice.settings as PracticeSettings);
      }
    }
  };

  const handleGenerate = async () => {
    setDialogState('generating');

    try {
      const { start, end } = getDateRange();
      const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      const summaryData: ChargesSummaryData = {
        practice: practiceSettings,
        patient: {
          display_name: patientName,
        },
        date_range: {
          start,
          end,
        },
        payments: payments.map((p) => ({
          date: new Date(p.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          amount: p.amount || 0,
          method: p.method,
        })),
        totals: {
          visit_count: payments.length,
          total_paid: totalPaid,
        },
        generated_at: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      };

      const pdf = await generateChargesSummaryPDF(summaryData);
      setGeneratedPDF(pdf);
      setDialogState('success');
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF');
      setDialogState('select');
    }
  };

  const handleDownload = () => {
    if (generatedPDF) {
      downloadPDF(generatedPDF);
    }
  };

  const handleShare = async () => {
    if (generatedPDF) {
      const success = await sharePDF(generatedPDF, patientName);
      if (!success) {
        // Fallback to download if share fails
        alert('Sharing not available on this device. The file will be downloaded instead.');
        downloadPDF(generatedPDF);
      }
    }
  };

  const handleEmail = async () => {
    if (!generatedPDF) return;

    // Try to use Web Share API first (works on mobile, attaches file)
    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([generatedPDF.blob], generatedPDF.filename, { type: 'application/pdf' });
        const shareData = {
          title: `Year-End Statement - ${patientName}`,
          text: `Please find attached your year-end payment statement for your records.\n\nThis document can be used for:\n- Tax deductions (medical expenses)\n- HSA/FSA reimbursement\n- Personal financial records`,
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch {
        // User cancelled or share failed, fall through to mailto
        console.log('Share cancelled or failed, using mailto fallback');
      }
    }

    // Fallback: download PDF and open mailto (desktop browsers)
    downloadPDF(generatedPDF);
    emailPDF(generatedPDF, patientName, practiceSettings.business_name);
  };

  const handleBack = () => {
    if (generatedPDF?.url) {
      URL.revokeObjectURL(generatedPDF.url);
    }
    setGeneratedPDF(null);
    setDialogState('select');
  };

  const { start, end } = getDateRange();
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {dialogState === 'success' ? 'Statement Ready' : 'Generate Year-End Statement'}
          </DialogTitle>
        </DialogHeader>

        {/* Select State - Choose date range */}
        {dialogState === 'select' && (
          <div className="space-y-4 py-2">
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Patient: <span className="font-medium text-gray-900">{patientName}</span>
              </p>
            </div>

            {/* Date Range Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Date Range</label>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    dateRange === 'current_year'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="dateRange"
                    value="current_year"
                    checked={dateRange === 'current_year'}
                    onChange={() => setDateRange('current_year')}
                  />
                  <span className="text-sm">{currentYear} (Full Year)</span>
                </label>
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    dateRange === 'previous_year'
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="dateRange"
                    value="previous_year"
                    checked={dateRange === 'previous_year'}
                    onChange={() => setDateRange('previous_year')}
                  />
                  <span className="text-sm">{currentYear - 1} (Full Year)</span>
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span className="text-sm text-gray-500">Loading...</span>
                </div>
              ) : payments.length === 0 ? (
                <p className="text-sm text-gray-500">No payments found for this period.</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">{payments.length}</span> payment{payments.length !== 1 ? 's' : ''} found
                  </p>
                  <p className="text-sm text-gray-600">
                    Total paid: <span className="font-medium">${totalPaid.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {start} — {end}
                  </p>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={loading || payments.length === 0}
              className="w-full"
            >
              <DocumentIcon className="w-4 h-4 mr-2" />
              Generate Statement
            </Button>

            {!practiceSettings.business_name && (
              <p className="text-xs text-amber-600 text-center">
                Tip: Add your practice info in Settings for a professional header.
              </p>
            )}
          </div>
        )}

        {/* Generating State */}
        {dialogState === 'generating' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-gray-600">Generating your statement...</p>
          </div>
        )}

        {/* Success State - Show share options */}
        {dialogState === 'success' && generatedPDF && (
          <div className="space-y-4 py-2">
            {/* Success indicator */}
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckIcon className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-medium text-green-800">Statement Generated!</p>
              <p className="text-sm text-green-600 mt-1">
                {patientName} • {dateRange === 'current_year' ? currentYear : currentYear - 1} • ${totalPaid.toFixed(2)}
              </p>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="flex flex-col items-center gap-1.5 h-auto py-4"
                onClick={handleDownload}
              >
                <DownloadIcon className="w-5 h-5" />
                <span className="text-xs">Download</span>
              </Button>

              <Button
                variant="outline"
                className="flex flex-col items-center gap-1.5 h-auto py-4"
                onClick={handleEmail}
              >
                <EmailIcon className="w-5 h-5" />
                <span className="text-xs">Email</span>
              </Button>

              {canShare ? (
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-4"
                  onClick={handleShare}
                >
                  <ShareIcon className="w-5 h-5" />
                  <span className="text-xs">Share</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1.5 h-auto py-4 opacity-50"
                  disabled
                  title="Share not available on this device"
                >
                  <ShareIcon className="w-5 h-5" />
                  <span className="text-xs">Share</span>
                </Button>
              )}
            </div>

            {/* Secondary actions */}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={handleBack}>
                Generate Another
              </Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
