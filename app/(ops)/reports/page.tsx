'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  generateCSV,
  downloadCSV,
  WEEKLY_EARNINGS_COLUMNS,
  MONTHLY_EARNINGS_COLUMNS,
  YEARLY_EARNINGS_COLUMNS,
  PAYMENTS_COLUMNS,
} from '@/lib/csv-export';
import type {
  EarningsSummary,
  WeeklyEarning,
  MonthlyEarning,
  YearlyEarning,
  PaymentMethodBreakdown,
  PaymentExport,
} from '@/lib/types-ops';
import { usePracticeConfig } from '@/lib/practice-config';
import { useFeatureFlags } from '@/lib/feature-flags';
import { createClient } from '@/lib/supabase';
import { generateChargesSummaryPDF, downloadPDF } from '@/components/ops/ChargesSummaryPDF';
import { GenerateBusinessStatementDialog } from '@/components/ops/GenerateBusinessStatementDialog';
import type { PracticeSettings, PatientNonPhi, PaymentNonPhi, ChargesSummaryData } from '@/lib/types-ops';

type ViewPeriod = 'weekly' | 'monthly' | 'yearly';

export default function ReportsPage() {
  // Get practice config for terminology
  const { features, practiceType } = usePracticeConfig();
  const { flags: featureFlags } = useFeatureFlags();
  const isCashOnly = practiceType === 'cash_only';
  const visitLabel = features.visitLabelPlural.toLowerCase();

  const [loading, setLoading] = useState(true);
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('monthly');
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyEarning[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyEarning[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyEarning[]>([]);
  const [methodBreakdown, setMethodBreakdown] = useState<PaymentMethodBreakdown[]>([]);
  const [exporting, setExporting] = useState(false);

  // Bulk summary generation state
  const currentYear = new Date().getFullYear();
  const [summaryYear, setSummaryYear] = useState(currentYear);
  const [patientsWithPayments, setPatientsWithPayments] = useState(0);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Business tax statement dialog
  const [showBusinessStatementDialog, setShowBusinessStatementDialog] = useState(false);

  useEffect(() => {
    loadData();
    // Refresh data when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
        loadBreakdown();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    loadBreakdown();
  }, [viewPeriod]);

  // Load patient count for summary year
  useEffect(() => {
    loadPatientsWithPaymentsCount();
  }, [summaryYear]);

  const loadPatientsWithPaymentsCount = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startDate = new Date(summaryYear, 0, 1).toISOString();
    const endDate = new Date(summaryYear, 11, 31, 23, 59, 59).toISOString();

    // Get distinct patient IDs with payments in this year
    const { data } = await supabase
      .from('payments_non_phi')
      .select('patient_id')
      .eq('owner_user_id', user.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const uniquePatients = new Set(data?.map(p => p.patient_id) || []);
    setPatientsWithPayments(uniquePatients.size);
  };

  const handleBulkGenerateSummaries = async () => {
    setGeneratingBulk(true);
    setBulkProgress({ current: 0, total: 0 });

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGeneratingBulk(false);
        return;
      }

      // Get practice settings for header
      const { data: profile } = await supabase
        .from('profiles')
        .select('practice_id')
        .eq('id', user.id)
        .single();

      let practiceSettings: PracticeSettings = {};
      if (profile?.practice_id) {
        const { data: practice } = await supabase
          .from('practices')
          .select('settings')
          .eq('id', profile.practice_id)
          .single();
        if (practice?.settings) {
          practiceSettings = practice.settings as PracticeSettings;
        }
      }

      // Get date range for the year
      const startDate = new Date(summaryYear, 0, 1).toISOString();
      const endDate = new Date(summaryYear, 11, 31, 23, 59, 59).toISOString();

      // Get all payments for this year
      const { data: payments } = await supabase
        .from('payments_non_phi')
        .select('*')
        .eq('owner_user_id', user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (!payments || payments.length === 0) {
        alert('No payments found for this year');
        setGeneratingBulk(false);
        return;
      }

      // Group payments by patient
      const paymentsByPatient: Record<string, PaymentNonPhi[]> = {};
      payments.forEach(p => {
        if (!paymentsByPatient[p.patient_id]) {
          paymentsByPatient[p.patient_id] = [];
        }
        paymentsByPatient[p.patient_id].push(p);
      });

      const patientIds = Object.keys(paymentsByPatient);
      setBulkProgress({ current: 0, total: patientIds.length });

      // Get patient names
      const { data: patients } = await supabase
        .from('patients_non_phi')
        .select('id, display_name')
        .in('id', patientIds);

      const patientMap = new Map<string, PatientNonPhi>();
      patients?.forEach(p => patientMap.set(p.id, p as PatientNonPhi));

      // Generate PDFs sequentially with a small delay
      for (let i = 0; i < patientIds.length; i++) {
        const patientId = patientIds[i];
        const patient = patientMap.get(patientId);
        const patientPayments = paymentsByPatient[patientId];

        if (!patient) continue;

        const totalPaid = patientPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const summaryData: ChargesSummaryData = {
          practice: practiceSettings,
          patient: {
            display_name: patient.display_name,
          },
          date_range: {
            start: `January 1, ${summaryYear}`,
            end: `December 31, ${summaryYear}`,
          },
          payments: patientPayments.map((p) => ({
            date: new Date(p.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }),
            amount: p.amount || 0,
            method: p.method,
          })),
          totals: {
            visit_count: patientPayments.length,
            total_paid: totalPaid,
          },
          generated_at: new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          }),
        };

        const pdf = await generateChargesSummaryPDF(summaryData);
        downloadPDF(pdf);
        // Clean up blob URL to prevent memory leaks
        URL.revokeObjectURL(pdf.url);
        setBulkProgress({ current: i + 1, total: patientIds.length });

        // Small delay between downloads to prevent browser issues
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Bulk generation failed:', error);
      alert('Failed to generate statements');
    }

    setGeneratingBulk(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, weeklyRes, monthlyRes, yearlyRes] = await Promise.all([
        fetch('/api/reports/summary'),
        fetch('/api/reports/weekly'),
        fetch('/api/reports/monthly'),
        fetch('/api/reports/yearly'),
      ]);

      const [summaryData, weekly, monthly, yearly] = await Promise.all([
        summaryRes.json(),
        weeklyRes.json(),
        monthlyRes.json(),
        yearlyRes.json(),
      ]);

      setSummary(summaryData);
      setWeeklyData(weekly);
      setMonthlyData(monthly);
      setYearlyData(yearly);
    } catch (error) {
      console.error('Failed to load reports data:', error);
    }
    setLoading(false);
  };

  const loadBreakdown = async () => {
    try {
      const period = viewPeriod === 'weekly' ? 'week' : viewPeriod === 'monthly' ? 'month' : 'year';
      const res = await fetch(`/api/reports/breakdown?period=${period}`);
      const data = await res.json();
      setMethodBreakdown(data);
    } catch (error) {
      console.error('Failed to load breakdown:', error);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      let data: unknown[];
      let columns: { key: string; label: string }[];
      let filename: string;

      if (viewPeriod === 'weekly') {
        data = weeklyData;
        columns = WEEKLY_EARNINGS_COLUMNS;
        filename = `weekly-earnings-${new Date().toISOString().split('T')[0]}.csv`;
      } else if (viewPeriod === 'monthly') {
        data = monthlyData;
        columns = MONTHLY_EARNINGS_COLUMNS;
        filename = `monthly-earnings-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        data = yearlyData;
        columns = YEARLY_EARNINGS_COLUMNS;
        filename = `yearly-earnings-${new Date().toISOString().split('T')[0]}.csv`;
      }

      const csv = generateCSV(data as Record<string, unknown>[], columns as { key: keyof Record<string, unknown>; label: string }[]);
      downloadCSV(csv, filename);
    } catch (error) {
      console.error('Export failed:', error);
    }
    setExporting(false);
  };

  const handleExportAllPayments = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/payments-export');
      const data: PaymentExport[] = await res.json();
      const csv = generateCSV(data as unknown as Record<string, unknown>[], PAYMENTS_COLUMNS as { key: keyof Record<string, unknown>; label: string }[]);
      downloadCSV(csv, `all-payments-${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error) {
      console.error('Export failed:', error);
    }
    setExporting(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatWeekLabel = (weekStart: string) => {
    const date = new Date(weekStart + 'T12:00:00');
    return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  const calculateTrend = (current: number, previous: number): { value: number; isUp: boolean } => {
    if (previous === 0) return { value: 0, isUp: true };
    const percentChange = Math.round(((current - previous) / previous) * 100);
    return { value: Math.abs(percentChange), isUp: percentChange >= 0 };
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-gray-500 animate-pulse">Loading reports...</p>
      </div>
    );
  }

  const currentData = viewPeriod === 'weekly' ? weeklyData : viewPeriod === 'monthly' ? monthlyData : yearlyData;

  // Calculate trends
  const weekTrend = summary ? calculateTrend(summary.thisWeek, summary.lastWeek) : null;
  const monthTrend = summary ? calculateTrend(summary.thisMonth, summary.lastMonth) : null;
  const yearTrend = summary ? calculateTrend(summary.thisYear, summary.lastYear) : null;

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm">Earnings & Analytics</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">This Week</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(summary?.thisWeek || 0)}
            </p>
            {weekTrend && weekTrend.value > 0 && (
              <p className={`text-xs mt-1 ${weekTrend.isUp ? 'text-green-600' : 'text-red-600'}`}>
                {weekTrend.isUp ? '↑' : '↓'} {weekTrend.value}% vs last week
              </p>
            )}
            {!isCashOnly && summary?.insuranceThisWeek && summary.insuranceThisWeek > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                {formatCurrency(summary.insuranceThisWeek)} insurance
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-accent/5 to-accent/10">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">This Month</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(summary?.thisMonth || 0)}
            </p>
            {monthTrend && monthTrend.value > 0 && (
              <p className={`text-xs mt-1 ${monthTrend.isUp ? 'text-green-600' : 'text-red-600'}`}>
                {monthTrend.isUp ? '↑' : '↓'} {monthTrend.value}% vs last month
              </p>
            )}
            {!isCashOnly && summary?.insuranceThisMonth && summary.insuranceThisMonth > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                {formatCurrency(summary.insuranceThisMonth)} insurance
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Year to Date Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50">
        <CardContent className="pt-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Year to Date</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {formatCurrency(summary?.thisYear || 0)}
              </p>
              {yearTrend && yearTrend.value > 0 && summary?.lastYear && summary.lastYear > 0 && (
                <p className={`text-xs mt-1 ${yearTrend.isUp ? 'text-green-600' : 'text-red-600'}`}>
                  {yearTrend.isUp ? '↑' : '↓'} {yearTrend.value}% vs same period last year
                </p>
              )}
              {!isCashOnly && summary?.insuranceThisYear && summary.insuranceThisYear > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  {formatCurrency(summary.insuranceThisYear)} from insurance
                </p>
              )}
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{new Date().getFullYear()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <Select value={viewPeriod} onValueChange={(v) => setViewPeriod(v as ViewPeriod)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={exporting}
        >
          <DownloadIcon className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Earnings Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {viewPeriod === 'weekly' ? 'Weekly' : viewPeriod === 'monthly' ? 'Monthly' : 'Yearly'} Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentData.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No data available</p>
            ) : (
              <>
                {viewPeriod === 'weekly' && weeklyData.map((week, idx) => (
                  <div
                    key={week.weekStart}
                    className={`flex justify-between items-center py-2 ${idx !== weeklyData.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{formatWeekLabel(week.weekStart)}</p>
                      <p className="text-xs text-gray-500">{week.visitCount} {visitLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(week.total)}</p>
                      {/* Show breakdown for insurance practices */}
                      {!isCashOnly && (week.copays > 0 || (week.insurancePayments && week.insurancePayments > 0)) && (
                        <div className="text-xs space-y-0.5">
                          {week.copays > 0 && (
                            <p className="text-gray-500">{formatCurrency(week.copays)} collected</p>
                          )}
                          {week.insurancePayments && week.insurancePayments > 0 && (
                            <p className="text-blue-600">{formatCurrency(week.insurancePayments)} insurance</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {viewPeriod === 'monthly' && monthlyData.map((month, idx) => (
                  <div
                    key={month.month}
                    className={`flex justify-between items-center py-2 ${idx !== monthlyData.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{month.monthLabel}</p>
                      <p className="text-xs text-gray-500">{month.visitCount} {visitLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(month.total)}</p>
                      {/* Show breakdown for insurance practices */}
                      {!isCashOnly && (month.copays > 0 || (month.insurancePayments && month.insurancePayments > 0)) && (
                        <div className="text-xs space-y-0.5">
                          {month.copays > 0 && (
                            <p className="text-gray-500">{formatCurrency(month.copays)} collected</p>
                          )}
                          {month.insurancePayments && month.insurancePayments > 0 && (
                            <p className="text-blue-600">{formatCurrency(month.insurancePayments)} insurance</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {viewPeriod === 'yearly' && yearlyData.map((year, idx) => (
                  <div
                    key={year.year}
                    className={`flex justify-between items-center py-2 ${idx !== yearlyData.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{year.year}</p>
                      <p className="text-xs text-gray-500">{year.visitCount} {visitLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(year.total)}</p>
                      {/* Show breakdown for insurance practices */}
                      {!isCashOnly && (year.copays > 0 || (year.insurancePayments && year.insurancePayments > 0)) && (
                        <div className="text-xs space-y-0.5">
                          {year.copays > 0 && (
                            <p className="text-gray-500">{formatCurrency(year.copays)} collected</p>
                          )}
                          {year.insurancePayments && year.insurancePayments > 0 && (
                            <p className="text-blue-600">{formatCurrency(year.insurancePayments)} insurance</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">By Payment Method</CardTitle>
          <CardDescription className="text-xs">
            {viewPeriod === 'weekly' ? 'This week' : viewPeriod === 'monthly' ? 'This month' : 'This year'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {methodBreakdown.length === 0 ? (
            <p className="text-center text-gray-500 py-4">No payments in this period</p>
          ) : (
            <div className="space-y-3">
              {methodBreakdown.map((item) => (
                <div key={item.method} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.method}</span>
                      <span className="text-sm text-gray-500">{item.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-20 text-right">
                    {formatCurrency(item.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Year-End Statements - Prominent Feature Section (controlled by feature flag) */}
      {featureFlags.feature_year_end_summary && (
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <FileTextIcon className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <CardTitle className="text-lg text-amber-900">Year-End Statements</CardTitle>
                <CardDescription className="text-amber-700">
                  Generate tax-ready payment statements for {isCashOnly ? 'clients' : 'patients'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-amber-800">Year:</label>
              <Select
                value={summaryYear.toString()}
                onValueChange={(v) => setSummaryYear(parseInt(v))}
              >
                <SelectTrigger className="w-24 border-amber-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={currentYear.toString()}>{currentYear}</SelectItem>
                  <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1}</SelectItem>
                  <SelectItem value={(currentYear - 2).toString()}>{currentYear - 2}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="bg-white/80 rounded-lg p-4 border border-amber-200">
              {generatingBulk ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-800">Generating statements...</span>
                    <span className="text-sm text-amber-600">
                      {bulkProgress.current} / {bulkProgress.total}
                    </span>
                  </div>
                  <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{
                        width: bulkProgress.total > 0
                          ? `${(bulkProgress.current / bulkProgress.total) * 100}%`
                          : '0%'
                      }}
                    />
                  </div>
                </div>
              ) : patientsWithPayments > 0 ? (
                <div className="space-y-3">
                  <Button
                    onClick={handleBulkGenerateSummaries}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3"
                    size="lg"
                  >
                    <FileTextIcon className="w-5 h-5 mr-2" />
                    Generate All {summaryYear} Statements
                  </Button>
                  <p className="text-sm text-amber-700 text-center">
                    Creates PDFs for <span className="font-semibold">{patientsWithPayments}</span> {isCashOnly ? 'client' : 'patient'}{patientsWithPayments !== 1 ? 's' : ''} with payments in {summaryYear}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-600 text-center py-2">
                  No payments found for {summaryYear}
                </p>
              )}
            </div>

            <p className="text-xs text-amber-600 text-center">
              Or generate individually from each {isCashOnly ? "client's" : "patient's"} Payments tab.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Business Tax Statement - For the Business Owner/Accountant */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BriefcaseIcon className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <CardTitle className="text-lg text-blue-900">Annual Income Statement</CardTitle>
              <CardDescription className="text-blue-700">
                Comprehensive tax statement for your accountant or bookkeeper
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-blue-600 space-y-1">
            <p className="font-medium">Includes:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-1">
              <li>Monthly & quarterly revenue breakdown</li>
              <li>Payment method analysis (cash vs. card)</li>
              <li>Client statistics & averages</li>
              <li>Tax preparation notes</li>
            </ul>
          </div>
          <Button
            onClick={() => setShowBusinessStatementDialog(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <BriefcaseIcon className="w-4 h-4 mr-2" />
            Generate Income Statement
          </Button>
        </CardContent>
      </Card>

      {/* Export All Payments */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">Export All Payments</p>
              <p className="text-xs text-gray-500">Download complete payment history as CSV</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAllPayments}
              disabled={exporting}
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Business Statement Dialog */}
      <GenerateBusinessStatementDialog
        open={showBusinessStatementDialog}
        onOpenChange={setShowBusinessStatementDialog}
      />
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
