export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  getDashboardSummary,
  getPendingClaims,
  getProfile,
  getTodaysVisitsWithCollections,
  getTodaysPayments,
  getWeeklyPaymentsSummary,
  getTodaysCopaysCollected,
  getClaimsPaidThisWeek,
  getInsurancePaymentsThisWeek,
  getReferralAlerts,
  getOverdueClaimsCount,
  getPracticeConfig,
} from '@/lib/db/ops-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date-utils';

// Helper to get greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Helper to calculate days since a date
function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const today = new Date();
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// Days pending badge color
function getDaysPendingStyle(days: number): string {
  if (days >= 21) return 'bg-red-100 text-red-700 border-red-200';
  if (days >= 14) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

export default async function DashboardPage() {
  // Fetch all data in parallel
  const [
    profile,
    practiceConfig,
    summary,
    pendingClaims,
    todaysVisits,
    todaysPayments,
    weeklyPayments,
    copaysCollected,
    claimsPaidThisWeek,
    insuranceThisWeek,
    referralAlerts,
    overdueClaimsCount,
  ] = await Promise.all([
    getProfile(),
    getPracticeConfig(),
    getDashboardSummary(),
    getPendingClaims(),
    getTodaysVisitsWithCollections(),
    getTodaysPayments(),
    getWeeklyPaymentsSummary(),
    getTodaysCopaysCollected(),
    getClaimsPaidThisWeek(),
    getInsurancePaymentsThisWeek(),
    getReferralAlerts(),
    getOverdueClaimsCount(14), // 14 days threshold per reference
  ]);

  const userName = profile?.full_name?.split(' ')[0] || 'there';
  const { features } = practiceConfig;
  const totalReferralAlerts = features.showReferrals
    ? referralAlerts.critical.length + referralAlerts.warning.length
    : 0;

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Header with Greeting and Action Buttons */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-gray-500 text-sm">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/patients?action=new">
            <Button variant="outline" size="sm">
              + New {features.patientLabel}
            </Button>
          </Link>
          <Link href="/visits?action=new">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              + Add {features.visitLabel}
            </Button>
          </Link>
        </div>
      </header>

      {/* Top Summary Cards - dynamic based on practice type */}
      <div className={`grid gap-3 ${features.showClaims ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
        {/* Today's Visits/Sessions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Today&apos;s {features.visitLabelPlural}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todaysVisits.length}</div>
            <p className="text-sm text-gray-500">
              {summary.visits_this_week} this week
            </p>
          </CardContent>
        </Card>

        {/* Today's Collections / Payments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {features.showClaims ? "Today's Collections" : "Today's Payments"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${copaysCollected.toFixed(2)}</div>
            <p className="text-sm text-gray-500">
              {todaysVisits.length} {todaysVisits.length === 1 ? features.visitLabel.toLowerCase() : features.visitLabelPlural.toLowerCase()} today
            </p>
          </CardContent>
        </Card>

        {/* Pending Claims - only show for insurance practice */}
        {features.showClaims && (
          <Card className={overdueClaimsCount > 0 ? 'border-red-200' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Pending Claims
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{summary.pending_claims_count}</div>
              <p className={`text-sm ${overdueClaimsCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {overdueClaimsCount > 0 ? `${overdueClaimsCount} overdue (>14 days)` : `$${summary.pending_claims_amount.toLocaleString()} pending`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Referral Alerts - only show for insurance practice */}
        {features.showReferrals && (
          <Card className={totalReferralAlerts > 0 ? 'border-amber-200' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Referral Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalReferralAlerts}</div>
              <p className="text-sm text-gray-500">
                {totalReferralAlerts > 0 ? 'Need attention' : 'All good'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Weekly Collected - show for cash_only instead of claims/referrals */}
        {!features.showClaims && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">${weeklyPayments.thisWeek.toLocaleString()}</div>
              <p className="text-sm text-gray-500">
                {summary.visits_this_week} {features.visitLabelPlural.toLowerCase()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Today's Visits/Sessions List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Today&apos;s {features.visitLabelPlural}</CardTitle>
                <Link href="/visits" className="text-sm text-blue-600 hover:underline">
                  View All →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {todaysVisits.length > 0 ? (
                <div className="space-y-3">
                  {todaysVisits.slice(0, 6).map((visit) => {
                    const isPaid = visit.paidAmount !== null;
                    const displayAmount = isPaid ? visit.paidAmount : visit.collectAmount;
                    return (
                      <div key={visit.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          <div>
                            <p className="font-medium text-gray-900">
                              {visit.patient?.display_name || 'Unknown'}
                            </p>
                            {features.showInsuranceFields && (
                            <p className="text-xs text-gray-500">
                              {visit.patient?.insurer_name || 'Self-pay'}
                            </p>
                          )}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-1">
                          {displayAmount && displayAmount > 0 ? (
                            <>
                              <span className={`font-semibold ${isPaid ? 'text-emerald-600' : 'text-gray-900'}`}>
                                ${displayAmount.toFixed(2)}
                              </span>
                              {isPaid && (
                                <CheckIcon className="w-4 h-4 text-emerald-500" />
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-4 text-center">No {features.visitLabelPlural.toLowerCase()} logged today</p>
              )}
            </CardContent>
          </Card>

          {/* Pending Claims Table - only for insurance practice */}
          {features.showClaims && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Pending Claims</CardTitle>
                  <Link href="/claims" className="text-sm text-blue-600 hover:underline">
                    View All Claims →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {pendingClaims.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">{features.patientLabel}</th>
                          <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Payer</th>
                          <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">DOS</th>
                          <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Amount</th>
                          <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingClaims.slice(0, 5).map((claim) => {
                          const days = daysSince(claim.date_submitted);
                          return (
                            <tr key={claim.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-2 font-medium text-gray-900">
                                {claim.patient?.display_name || 'Unknown'}
                              </td>
                              <td className="py-2 text-gray-600">
                                {claim.insurer_name || '-'}
                              </td>
                              <td className="py-2 text-gray-600 hidden sm:table-cell">
                                {claim.date_of_service
                                  ? formatDate(claim.date_of_service, { month: 'short', day: 'numeric' })
                                  : '-'}
                              </td>
                              <td className="py-2 text-right font-medium">
                                ${claim.billed_amount?.toFixed(0) || '0'}
                              </td>
                              <td className="py-2 text-right">
                                {days !== null && days > 0 ? (
                                  <Badge variant="outline" className={`text-xs ${getDaysPendingStyle(days)}`}>
                                    {days}d {days >= 21 && '⚠'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600">
                                    New
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm py-4 text-center">No pending claims</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Referral Alerts - only for insurance practice */}
          {features.showReferrals && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold">Referral Alerts</CardTitle>
                  <Link href="/patients" className="text-sm text-blue-600 hover:underline">
                    Manage Referrals →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {totalReferralAlerts > 0 ? (
                  <div className="space-y-3">
                    {/* Critical alerts */}
                    {referralAlerts.critical.slice(0, 3).map(({ patient, referral, visitsUsed }) => {
                      const limit = referral.visit_limit_count || 0;
                      const percentage = limit > 0 ? Math.min((visitsUsed / limit) * 100, 100) : 0;
                      return (
                        <div key={referral.id} className="p-3 rounded-lg border border-red-200 bg-red-50/50">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-red-600 text-xs font-bold">!</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{patient?.display_name}</p>
                              <p className="text-xs text-gray-500">
                                {patient?.insurer_name} • Expires {referral.referral_expiration_date
                                  ? formatDate(referral.referral_expiration_date, { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'N/A'}
                              </p>
                              {limit > 0 && (
                                <>
                                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-red-500 transition-all"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 text-right">{visitsUsed}/{limit}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Warning alerts */}
                    {referralAlerts.warning.slice(0, 3).map(({ patient, referral, visitsUsed }) => {
                      const limit = referral.visit_limit_count || 0;
                      const percentage = limit > 0 ? Math.min((visitsUsed / limit) * 100, 100) : 0;
                      return (
                        <div key={referral.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-amber-600 text-xs font-bold">⚠</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{patient?.display_name}</p>
                              <p className="text-xs text-gray-500">
                                {patient?.insurer_name} • Expires {referral.referral_expiration_date
                                  ? formatDate(referral.referral_expiration_date, { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'N/A'}
                              </p>
                              {limit > 0 && (
                                <>
                                  <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-500 transition-all"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 text-right">{visitsUsed}/{limit}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm py-4 text-center">No alerts - all referrals look good!</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Today's Payments */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Today&apos;s Payments</CardTitle>
                <Link href="/payments" className="text-sm text-blue-600 hover:underline">
                  Payment History →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {todaysPayments.length > 0 ? (
                <div className="space-y-2">
                  {todaysPayments.slice(0, 4).map((payment) => {
                    const patient = payment.patient as { display_name?: string } | undefined;
                    const time = new Date(payment.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                    return (
                      <div key={payment.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            payment.method === 'CASH' ? 'bg-emerald-100' : 'bg-blue-100'
                          }`}>
                            {payment.method === 'CASH' ? (
                              <span className="text-emerald-600 text-sm">$</span>
                            ) : (
                              <CreditCardIcon className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{patient?.display_name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{time} • {payment.method}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-gray-900">${payment.amount}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm py-4 text-center">No payments today</p>
              )}

              {/* This Week's Snapshot */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">This Week&apos;s Snapshot</p>
                <div className={`grid gap-3 ${features.showClaims ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">{summary.visits_this_week}</div>
                    <p className="text-xs text-gray-500">{features.visitLabelPlural}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-gray-900">
                      ${(weeklyPayments.thisWeek + insuranceThisWeek).toLocaleString()}
                    </div>
                    <p className="text-xs text-gray-500">
                      {features.showClaims && insuranceThisWeek > 0 ? 'Total Revenue' : 'Collected'}
                    </p>
                    {features.showClaims && insuranceThisWeek > 0 && (
                      <p className="text-xs text-blue-600 mt-0.5">
                        ${insuranceThisWeek.toLocaleString()} ins
                      </p>
                    )}
                  </div>
                  {features.showClaims && (
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-xl font-bold text-gray-900">{claimsPaidThisWeek}</div>
                      <p className="text-xs text-gray-500">Claims Paid</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
        <div className={`grid gap-3 ${features.showClaims ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
          <Link
            href="/visits?action=new"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">Add {features.visitLabel}</span>
          </Link>

          {features.showClaims && (
            <Link
              href="/claims?action=new"
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
            >
              <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
                <ClaimIcon className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">Submit Claim</span>
            </Link>
          )}

          <Link
            href="/patients?action=new"
            className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
          >
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-900">New {features.patientLabel}</span>
          </Link>

          {features.showReferrals && (
            <Link
              href="/patients"
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-center"
            >
              <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                <RefreshIcon className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-sm font-medium text-gray-900">New Referral</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function ClaimIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  );
}
