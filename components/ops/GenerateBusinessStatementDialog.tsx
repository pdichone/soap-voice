'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase';
import {
  generateBusinessTaxStatementPDF,
  downloadPDF,
  sharePDF,
  type BusinessTaxStatementData,
  type GeneratedPDF,
} from './BusinessTaxStatementPDF';
import type { PracticeSettings, PaymentNonPhi } from '@/lib/types-ops';

interface GenerateBusinessStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogState = 'select' | 'generating' | 'success';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  'CASH': 'Cash',
  'CHECK': 'Check',
  'CARD': 'Credit/Debit Card',
  'HSA': 'HSA/FSA',
  'VENMO': 'Venmo',
  'CASHAPP': 'Cash App',
  'APPLEPAY': 'Apple Pay',
  'ZELLE': 'Zelle',
  'OTHER': 'Other',
};

export function GenerateBusinessStatementDialog({
  open,
  onOpenChange,
}: GenerateBusinessStatementDialogProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>('select');
  const [practiceSettings, setPracticeSettings] = useState<PracticeSettings>({});
  const [generatedPDF, setGeneratedPDF] = useState<GeneratedPDF | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [previewData, setPreviewData] = useState<{
    totalRevenue: number;
    totalVisits: number;
    totalClients: number;
  } | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare);
  }, []);

  useEffect(() => {
    if (!open) {
      if (generatedPDF?.url) {
        URL.revokeObjectURL(generatedPDF.url);
      }
      setDialogState('select');
      setGeneratedPDF(null);
    }
  }, [open, generatedPDF?.url]);

  const loadPracticeSettings = useCallback(async () => {
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
  }, []);

  const loadPreviewData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const startDate = new Date(selectedYear, 0, 1).toISOString();
    const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

    const { data: payments } = await supabase
      .from('payments_non_phi')
      .select('*')
      .eq('owner_user_id', user.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (payments) {
      const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const uniqueClients = new Set(payments.map(p => p.patient_id));
      setPreviewData({
        totalRevenue,
        totalVisits: payments.length,
        totalClients: uniqueClients.size,
      });
    } else {
      setPreviewData({ totalRevenue: 0, totalVisits: 0, totalClients: 0 });
    }
    setLoading(false);
  }, [selectedYear]);

  useEffect(() => {
    if (open && dialogState === 'select') {
      loadPreviewData();
      loadPracticeSettings();
    }
  }, [open, selectedYear, dialogState, loadPreviewData, loadPracticeSettings]);

  const handleGenerate = async () => {
    setDialogState('generating');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDialogState('select');
        return;
      }

      const startDate = new Date(selectedYear, 0, 1).toISOString();
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

      // Get all payments for the year
      const { data: payments } = await supabase
        .from('payments_non_phi')
        .select('*')
        .eq('owner_user_id', user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (!payments || payments.length === 0) {
        alert('No payment data found for this year');
        setDialogState('select');
        return;
      }

      // Get patient data for new client count
      const { data: patients } = await supabase
        .from('patients_non_phi')
        .select('id, created_at')
        .eq('owner_user_id', user.id);

      // Calculate all the data
      const statementData = calculateStatementData(payments, patients || [], selectedYear, practiceSettings);

      const pdf = await generateBusinessTaxStatementPDF(statementData);
      setGeneratedPDF(pdf);
      setDialogState('success');
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate statement');
      setDialogState('select');
    }
  };

  const calculateStatementData = (
    payments: PaymentNonPhi[],
    patients: { id: string; created_at: string }[],
    year: number,
    practice: PracticeSettings
  ): BusinessTaxStatementData => {
    // Monthly breakdown
    const monthlyData: Record<number, { revenue: number; visits: number }> = {};
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = { revenue: 0, visits: 0 };
    }

    // Payment method breakdown
    const methodData: Record<string, { total: number; count: number }> = {};

    // Track unique clients and insurance data
    const uniqueClients = new Set<string>();
    let copaysCollected = 0;
    const insurancePayments = 0;

    for (const payment of payments) {
      const date = new Date(payment.created_at);
      const month = date.getMonth();

      monthlyData[month].revenue += payment.amount || 0;
      monthlyData[month].visits += 1;

      // Payment method
      const method = payment.method || 'OTHER';
      if (!methodData[method]) {
        methodData[method] = { total: 0, count: 0 };
      }
      methodData[method].total += payment.amount || 0;
      methodData[method].count += 1;

      // Track clients
      if (payment.patient_id) {
        uniqueClients.add(payment.patient_id);
      }

      // Track insurance-related payments
      if (payment.is_copay) {
        copaysCollected += payment.amount || 0;
      }
      // Note: Insurance payments come from paid claims, not from payments table
    }

    // Calculate gross revenue
    const grossRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Build monthly breakdown array
    const monthlyBreakdown = Object.entries(monthlyData).map(([monthIdx, data]) => ({
      month: MONTHS[parseInt(monthIdx)],
      revenue: data.revenue,
      visits: data.visits,
    }));

    // Build quarterly totals
    const quarterlyTotals = [
      { quarter: 'Q1 (Jan-Mar)', revenue: 0, visits: 0 },
      { quarter: 'Q2 (Apr-Jun)', revenue: 0, visits: 0 },
      { quarter: 'Q3 (Jul-Sep)', revenue: 0, visits: 0 },
      { quarter: 'Q4 (Oct-Dec)', revenue: 0, visits: 0 },
    ];

    for (let i = 0; i < 12; i++) {
      const quarterIdx = Math.floor(i / 3);
      quarterlyTotals[quarterIdx].revenue += monthlyData[i].revenue;
      quarterlyTotals[quarterIdx].visits += monthlyData[i].visits;
    }

    // Build payment methods array
    const paymentMethods = Object.entries(methodData)
      .map(([method, data]) => ({
        method: PAYMENT_METHOD_LABELS[method] || method,
        total: data.total,
        count: data.count,
        percentage: grossRevenue > 0 ? (data.total / grossRevenue) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Count new clients this year
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);
    const newClients = patients.filter(p => {
      const createdAt = new Date(p.created_at);
      return createdAt >= yearStart && createdAt <= yearEnd && uniqueClients.has(p.id);
    }).length;

    // Build final data object
    const data: BusinessTaxStatementData = {
      practice,
      year,
      income: {
        gross_revenue: grossRevenue,
        monthly_breakdown: monthlyBreakdown,
        quarterly_totals: quarterlyTotals,
      },
      payment_methods: paymentMethods,
      client_stats: {
        total_unique_clients: uniqueClients.size,
        new_clients: newClients,
        total_visits: payments.length,
        average_per_visit: payments.length > 0 ? grossRevenue / payments.length : 0,
      },
      generated_at: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    };

    // Add insurance breakdown if applicable
    if (copaysCollected > 0 || insurancePayments > 0) {
      data.insurance_breakdown = {
        copays_collected: copaysCollected,
        insurance_payments: insurancePayments,
      };
    }

    return data;
  };

  const handleDownload = () => {
    if (generatedPDF) {
      downloadPDF(generatedPDF);
    }
  };

  const handleShare = async () => {
    if (generatedPDF) {
      const success = await sharePDF(generatedPDF, practiceSettings.business_name || 'Business');
      if (!success) {
        alert('Sharing not available. The file will be downloaded instead.');
        downloadPDF(generatedPDF);
      }
    }
  };

  const handleEmail = async () => {
    if (!generatedPDF) return;

    if (navigator.share && navigator.canShare) {
      try {
        const file = new File([generatedPDF.blob], generatedPDF.filename, { type: 'application/pdf' });
        const shareData = {
          title: `Annual Income Statement - ${selectedYear}`,
          text: `Annual income statement for ${practiceSettings.business_name || 'my business'} for tax year ${selectedYear}.`,
          files: [file],
        };

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      } catch {
        console.log('Share cancelled or failed, using mailto fallback');
      }
    }

    // Fallback: download and open mailto
    downloadPDF(generatedPDF);
    const subject = encodeURIComponent(`Annual Income Statement - ${selectedYear}`);
    const body = encodeURIComponent(
      `Hi,\n\n` +
      `Please find attached the annual income statement for ${practiceSettings.business_name || 'my business'} for tax year ${selectedYear}.\n\n` +
      `This document contains:\n` +
      `- Gross revenue and monthly breakdown\n` +
      `- Quarterly totals (for estimated tax payments)\n` +
      `- Payment method breakdown\n` +
      `- Client/practice statistics\n\n` +
      `Please let me know if you need any additional information.\n\n` +
      `Best regards`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleBack = () => {
    if (generatedPDF?.url) {
      URL.revokeObjectURL(generatedPDF.url);
    }
    setGeneratedPDF(null);
    setDialogState('select');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {dialogState === 'success' ? 'Statement Ready' : 'Annual Income Statement'}
          </DialogTitle>
        </DialogHeader>

        {/* Select State */}
        {dialogState === 'select' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Generate a comprehensive income statement for your accountant or tax preparation.
            </p>

            {/* Year Selection */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Tax Year</label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(v) => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                  <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                  <SelectItem value={(currentYear - 2).toString()}>{currentYear - 2}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-sm font-medium text-blue-800 mb-2">Preview for {selectedYear}</p>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  <span className="text-sm text-blue-600">Loading...</span>
                </div>
              ) : previewData && previewData.totalVisits > 0 ? (
                <div className="space-y-1 text-sm text-blue-700">
                  <p>Gross Revenue: <span className="font-semibold">{formatCurrency(previewData.totalRevenue)}</span></p>
                  <p>Total Visits: <span className="font-semibold">{previewData.totalVisits}</span></p>
                  <p>Unique Clients: <span className="font-semibold">{previewData.totalClients}</span></p>
                </div>
              ) : (
                <p className="text-sm text-blue-600">No payment data found for this year.</p>
              )}
            </div>

            {/* What's included */}
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-700">Statement includes:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>Monthly & quarterly revenue breakdown</li>
                <li>Payment method analysis (cash vs. card)</li>
                <li>Client statistics & averages</li>
                <li>Tax notes for your accountant</li>
              </ul>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={loading || !previewData || previewData.totalVisits === 0}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <DocumentIcon className="w-4 h-4 mr-2" />
              Generate Income Statement
            </Button>

            {!practiceSettings.business_name && (
              <p className="text-xs text-amber-600 text-center">
                Tip: Add your business info in Settings for a complete header.
              </p>
            )}
          </div>
        )}

        {/* Generating State */}
        {dialogState === 'generating' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-gray-600">Generating your statement...</p>
          </div>
        )}

        {/* Success State */}
        {dialogState === 'success' && generatedPDF && (
          <div className="space-y-4 py-2">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckIcon className="w-6 h-6 text-green-600" />
              </div>
              <p className="font-medium text-green-800">Statement Generated!</p>
              <p className="text-sm text-green-600 mt-1">
                {practiceSettings.business_name || 'Business'} - {selectedYear}
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
