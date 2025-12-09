import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAllPractitioners } from '@/lib/db/admin-queries';
import { ImpersonateButton } from '@/components/admin/impersonate-button';
import { OnboardingStatusFilter } from '@/components/admin/onboarding-status-filter';
import { ONBOARDING_STATUS_CONFIG } from '@/lib/onboarding-constants';
import type { PractitionerWithStats } from '@/lib/types-ops';
import type { OnboardingStatus } from '@/lib/types-onboarding';

export const dynamic = 'force-dynamic';

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'active':
      return 'default';
    case 'inactive':
      return 'secondary';
    case 'suspended':
      return 'destructive';
    case 'pending':
      return 'outline';
    default:
      return 'secondary';
  }
}

function getBillingBadgeVariant(status: string) {
  switch (status) {
    case 'paying':
      return 'default';
    case 'trial':
      return 'outline';
    case 'overdue':
      return 'destructive';
    case 'cancelled':
      return 'secondary';
    case 'comped':
      return 'default';
    default:
      return 'secondary';
  }
}

function formatDate(date: string | null) {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(date: string | null) {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

interface Props {
  searchParams: Promise<{ onboarding?: string }>;
}

export default async function PractitionersPage({ searchParams }: Props) {
  const params = await searchParams;
  const onboardingFilter = params.onboarding as OnboardingStatus | undefined;

  let practitioners: PractitionerWithStats[] = [];
  let error: string | null = null;

  try {
    practitioners = await getAllPractitioners({
      onboardingStatus: onboardingFilter,
    });
  } catch (err) {
    console.error('Error loading practitioners:', err);
    error = 'Failed to load practitioners';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Practitioners</h1>
          <p className="text-slate-600 mt-1">
            Manage LMT accounts and their features
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={<div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />}>
            <OnboardingStatusFilter />
          </Suspense>
          <Link href="/admin/practitioners/new">
            <Button>
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
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              Add Practitioner
            </Button>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!error && practitioners.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="w-12 h-12 text-slate-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-slate-900">No practitioners yet</h3>
            <p className="text-slate-500 mt-1">
              Get started by adding your first practitioner.
            </p>
            <Link href="/admin/practitioners/new" className="mt-4 inline-block">
              <Button>Add Practitioner</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Practitioners Table */}
      {practitioners.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                    Practitioner
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                    Plan
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                    Activity
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                    Stats
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {practitioners.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{p.name}</span>
                          {(() => {
                            const status = (p.onboarding_status || 'not_started') as OnboardingStatus;
                            const config = ONBOARDING_STATUS_CONFIG[status];
                            return (
                              <Badge
                                variant={config.badgeVariant}
                                className="text-xs"
                                title={config.label}
                              >
                                {config.label}
                              </Badge>
                            );
                          })()}
                        </div>
                        <div className="text-sm text-slate-500">{p.email}</div>
                        {p.workspace_name && (
                          <div className="text-xs text-slate-400">{p.workspace_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={getStatusBadgeVariant(p.status)}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <Badge variant={getBillingBadgeVariant(p.billing_status)}>
                          {p.billing_status}
                        </Badge>
                        <div className="text-xs text-slate-500">{p.plan_type}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <div className="text-slate-900">
                          Last login: {formatRelativeTime(p.last_login_at)}
                        </div>
                        <div className="text-slate-500 text-xs">
                          Joined: {formatDate(p.created_at)}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm space-y-0.5">
                        <div className="text-slate-600">
                          <span className="font-medium">{p.patient_count || 0}</span> patients
                        </div>
                        <div className="text-slate-600">
                          <span className="font-medium">{p.visit_count || 0}</span> visits
                        </div>
                        <div className="text-slate-400 text-xs">
                          {p.visits_this_week || 0} this week
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/practitioners/${p.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                        <ImpersonateButton
                          practitionerId={p.id}
                          practitionerName={p.name}
                          hasUserId={!!p.user_id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
