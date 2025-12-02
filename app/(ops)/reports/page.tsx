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

type ViewPeriod = 'weekly' | 'monthly' | 'yearly';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [viewPeriod, setViewPeriod] = useState<ViewPeriod>('monthly');
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyEarning[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyEarning[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyEarning[]>([]);
  const [methodBreakdown, setMethodBreakdown] = useState<PaymentMethodBreakdown[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadBreakdown();
  }, [viewPeriod]);

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
      <div className="p-4 space-y-4">
        <div className="h-8 bg-gray-200 rounded animate-pulse w-32"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
          <div className="h-24 bg-gray-100 rounded-lg animate-pulse"></div>
        </div>
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
                      <p className="text-xs text-gray-500">{week.visitCount} visits</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(week.total)}</p>
                      {week.copays > 0 && (
                        <p className="text-xs text-gray-500">{formatCurrency(week.copays)} copays</p>
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
                      <p className="text-xs text-gray-500">{month.visitCount} visits</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(month.total)}</p>
                      {month.copays > 0 && (
                        <p className="text-xs text-gray-500">{formatCurrency(month.copays)} copays</p>
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
                      <p className="text-xs text-gray-500">{year.visitCount} visits</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(year.total)}</p>
                      {year.copays > 0 && (
                        <p className="text-xs text-gray-500">{formatCurrency(year.copays)} copays</p>
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
