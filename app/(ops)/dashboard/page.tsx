export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  getDashboardSummary,
  getPendingClaims,
  getProfile,
  getTodaysVisitsWithCollections,
  getTodaysPayments,
  getWeeklyPaymentsSummary,
  getReferralAlerts,
  getOverdueClaimsCount,
  getPracticeConfig,
  getAdminFeatureFlags,
  getRecentPatients,
} from '@/lib/db/ops-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/date-utils';
import { PaymentSuccessBanner } from '@/components/ops/PaymentSuccessBanner';
import { Suspense } from 'react';

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
    adminFlags,
    summary,
    pendingClaims,
    todaysVisits,
    todaysPayments,
    weeklyPayments,
    referralAlerts,
    overdueClaimsCount,
    recentPatients,
  ] = await Promise.all([
    getProfile(),
    getPracticeConfig(),
    getAdminFeatureFlags(),
    getDashboardSummary(),
    getPendingClaims(),
    getTodaysVisitsWithCollections(),
    getTodaysPayments(),
    getWeeklyPaymentsSummary(),
    getReferralAlerts(),
    getOverdueClaimsCount(14), // 14 days threshold per reference
    getRecentPatients(5),
  ]);

  const userName = profile?.full_name || 'there';
  const { features } = practiceConfig;

  // Claims are shown only if: practice type supports it AND admin has enabled the feature
  const showClaims = features.showClaims && adminFlags.feature_claims_tracking;
  const totalReferralAlerts = features.showReferrals
    ? referralAlerts.critical.length + referralAlerts.warning.length
    : 0;

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      {/* Payment Success Banner (client component) */}
      <Suspense fallback={null}>
        <PaymentSuccessBanner />
      </Suspense>

      {/* Header with Greeting and Action Buttons */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 break-words">
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
      <div className={`grid gap-3 ${showClaims ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 lg:grid-cols-3'}`}>
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
              {showClaims ? "Today's Collections" : "Today's Payments"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${todaysPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</div>
            <p className="text-sm text-gray-500">
              {todaysVisits.length} {todaysVisits.length === 1 ? features.visitLabel.toLowerCase() : features.visitLabelPlural.toLowerCase()} today
            </p>
          </CardContent>
        </Card>

        {/* Pending Claims - only show for insurance practice */}
        {showClaims && (
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
        {!showClaims && (
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
          <Card className={todaysVisits.length > 0 ? 'border-emerald-200 bg-emerald-50/30' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Today&apos;s {features.visitLabelPlural}</CardTitle>
            </CardHeader>
            <CardContent>
              {todaysVisits.length > 0 ? (
                <div className="space-y-3">
                  {todaysVisits.slice(0, 6).map((visit) => {
                    const isPaid = visit.paidAmount !== null;
                    const displayAmount = isPaid ? visit.paidAmount : visit.collectAmount;
                    return (
                      <div key={visit.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
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
                        <div className="text-right">
                          {displayAmount && displayAmount > 0 ? (
                            <div className="flex items-center gap-2 justify-end">
                              <span className={`font-semibold ${isPaid ? 'text-emerald-600' : 'text-gray-900'}`}>
                                ${displayAmount.toFixed(2)}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                {isPaid ? 'Paid' : 'Collect'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No {features.visitLabelPlural.toLowerCase()} logged today</p>
                  <Link href="/visits?action=new" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
                    Add your first {features.visitLabel.toLowerCase()} →
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Claims Table - only for insurance practice */}
          {showClaims && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Pending Claims</CardTitle>
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
                <CardTitle className="text-base font-semibold">Referral Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                {totalReferralAlerts > 0 ? (
                  <div className="space-y-3">
                    {/* Critical alerts */}
                    {referralAlerts.critical.slice(0, 3).map(({ patient, referral, visitsUsed }) => {
                      const limit = referral.visit_limit_count || 0;
                      const percentage = limit > 0 ? Math.min((visitsUsed / limit) * 100, 100) : 0;
                      const icd10Display = referral.icd10_codes?.slice(0, 2).join(', ') || '';
                      return (
                        <div key={referral.id} className="p-3 rounded-lg border border-red-200 bg-red-50/50">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-red-600 text-xs font-bold">!</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{patient?.display_name}</p>
                              <p className="text-xs text-gray-500">
                                {patient?.insurer_name}
                                {referral.physician_name && ` • Dr. ${referral.physician_name}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                Expires {referral.referral_expiration_date
                                  ? formatDate(referral.referral_expiration_date, { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'N/A'}
                                {icd10Display && ` • ${icd10Display}`}
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
                      const icd10Display = referral.icd10_codes?.slice(0, 2).join(', ') || '';
                      return (
                        <div key={referral.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-amber-600 text-xs font-bold">⚠</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{patient?.display_name}</p>
                              <p className="text-xs text-gray-500">
                                {patient?.insurer_name}
                                {referral.physician_name && ` • Dr. ${referral.physician_name}`}
                              </p>
                              <p className="text-xs text-gray-500">
                                Expires {referral.referral_expiration_date
                                  ? formatDate(referral.referral_expiration_date, { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'N/A'}
                                {icd10Display && ` • ${icd10Display}`}
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
              <CardTitle className="text-base font-semibold">Today&apos;s Payments</CardTitle>
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
            </CardContent>
          </Card>

          {/* Recent Patients */}
          {recentPatients.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Recent {features.patientLabelPlural}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentPatients.map((patient) => (
                    <Link
                      key={patient.id}
                      href={`/patients/${patient.id}`}
                      className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 text-sm font-medium">
                            {patient.display_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{patient.display_name}</p>
                          {features.showInsuranceFields && patient.insurer_name && (
                            <p className="text-xs text-gray-500">{patient.insurer_name}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {formatDate(patient.last_visit_date, { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}

// Icons
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
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
