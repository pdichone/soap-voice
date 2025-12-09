export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getReferralAlerts, getPracticeConfig } from '@/lib/db/ops-queries';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/date-utils';
import { redirect } from 'next/navigation';

export default async function ReferralsPage() {
  const [practiceConfig, referralAlerts] = await Promise.all([
    getPracticeConfig(),
    getReferralAlerts(),
  ]);

  const { features } = practiceConfig;

  // Redirect cash-only practices to patients page (no referrals)
  if (!features.showReferrals) {
    redirect('/patients');
  }

  const allAlerts = [
    ...referralAlerts.critical.map(a => ({ ...a, severity: 'critical' as const })),
    ...referralAlerts.warning.map(a => ({ ...a, severity: 'warning' as const })),
  ];

  const totalAlerts = allAlerts.length;

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referral Alerts</h1>
          <p className="text-gray-500 text-sm">
            {totalAlerts === 0
              ? 'All referrals are in good standing'
              : `${totalAlerts} referral${totalAlerts === 1 ? '' : 's'} need${totalAlerts === 1 ? 's' : ''} attention`}
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </header>

      {totalAlerts === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckIcon className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Clear!</h3>
            <p className="text-gray-500">
              No referrals are expiring soon or running low on visits.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Critical Alerts */}
          {referralAlerts.critical.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Critical ({referralAlerts.critical.length})
              </h2>
              {referralAlerts.critical.map(({ patient, referral, visitsUsed, reason }) => (
                <ReferralAlertCard
                  key={referral.id}
                  patient={patient}
                  referral={referral}
                  visitsUsed={visitsUsed}
                  reason={reason}
                  severity="critical"
                />
              ))}
            </div>
          )}

          {/* Warning Alerts */}
          {referralAlerts.warning.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                Warning ({referralAlerts.warning.length})
              </h2>
              {referralAlerts.warning.map(({ patient, referral, visitsUsed, reason }) => (
                <ReferralAlertCard
                  key={referral.id}
                  patient={patient}
                  referral={referral}
                  visitsUsed={visitsUsed}
                  reason={reason}
                  severity="warning"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReferralAlertCard({
  patient,
  referral,
  visitsUsed,
  reason,
  severity,
}: {
  patient: { id: string; display_name: string; insurer_name?: string | null };
  referral: {
    id: string;
    referral_label?: string | null;
    physician_name?: string | null;
    referral_expiration_date?: string | null;
    visit_limit_count?: number | null;
    icd10_codes?: string[] | null;
  };
  visitsUsed: number;
  reason: string;
  severity: 'critical' | 'warning';
}) {
  const limit = referral.visit_limit_count || 0;
  const percentage = limit > 0 ? Math.min((visitsUsed / limit) * 100, 100) : 0;
  const icd10Display = referral.icd10_codes?.slice(0, 3).join(', ') || '';

  const borderColor = severity === 'critical' ? 'border-red-200' : 'border-amber-200';
  const bgColor = severity === 'critical' ? 'bg-red-50/50' : 'bg-amber-50/50';
  const badgeVariant = severity === 'critical' ? 'destructive' : 'secondary';
  const progressBg = severity === 'critical' ? 'bg-red-500' : 'bg-amber-500';

  return (
    <Link href={`/patients/${patient.id}`}>
      <Card className={`${borderColor} ${bgColor} hover:shadow-md transition-shadow`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-gray-900">{patient.display_name}</h3>
                <Badge variant={badgeVariant} className="text-xs">
                  {reason}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                {referral.referral_label || 'Referral'}
                {referral.physician_name && ` • Dr. ${referral.physician_name}`}
              </p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                {patient.insurer_name && <p>Insurance: {patient.insurer_name}</p>}
                {referral.referral_expiration_date && (
                  <p>
                    Expires:{' '}
                    {formatDate(referral.referral_expiration_date, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                )}
                {icd10Display && <p>ICD-10: {icd10Display}</p>}
              </div>
            </div>

            {/* Visit usage progress */}
            {limit > 0 && (
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-medium text-gray-900">
                  {visitsUsed}/{limit} visits
                </p>
                <p className="text-xs text-gray-500 mb-1">
                  {limit - visitsUsed} remaining
                </p>
                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${progressBg} rounded-full`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
