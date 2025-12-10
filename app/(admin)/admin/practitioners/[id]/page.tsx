import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPractitionerById, getRecentActivityForPractitioner, getQuestionnaireByPractitionerId } from '@/lib/db/admin-queries';
import { FeatureFlagsCard } from '@/components/admin/feature-flags-card';
import { PracticeTypeCard } from '@/components/admin/practice-type-card';
import { SendMagicLinkButton } from '@/components/admin/send-magic-link-button';
import { SeedDemoDataButton } from '@/components/admin/seed-demo-data-button';
import { DeleteDemoDataButton } from '@/components/admin/delete-demo-data-button';
import { ImpersonateButton } from '@/components/admin/impersonate-button';
import { OnboardingSectionWrapper } from '@/components/admin/OnboardingSectionWrapper';
import { BillingSection } from '@/components/admin/BillingSection';
import type { PracticeType } from '@/lib/types-ops';
import type { OnboardingStatus, OnboardingChecklist } from '@/lib/types-onboarding';

interface Props {
  params: Promise<{ id: string }>;
}

function formatDate(date: string | null) {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number | null) {
  if (amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export default async function PractitionerDetailPage({ params }: Props) {
  const { id } = await params;

  const [practitioner, activity, questionnaire] = await Promise.all([
    getPractitionerById(id),
    getRecentActivityForPractitioner(id, 10),
    getQuestionnaireByPractitionerId(id),
  ]);

  if (!practitioner) {
    notFound();
  }

  // Default onboarding values if not set
  const onboardingStatus = (practitioner.onboarding_status || 'not_started') as OnboardingStatus;
  const defaultChecklist: OnboardingChecklist = {
    questionnaire_sent: false,
    questionnaire_received: false,
    practice_configured: false,
    services_added: false,
    intake_form_created: false,
    client_list_imported: false,
    welcome_email_sent: false,
  };
  const onboardingChecklist: OnboardingChecklist = practitioner.onboarding_checklist
    ? (practitioner.onboarding_checklist as unknown as OnboardingChecklist)
    : defaultChecklist;

  // Only show feature flags that are actually implemented
  const featureFlags = [
    { key: 'feature_claims_tracking', label: 'Claims Tracking', enabled: practitioner.feature_claims_tracking },
    { key: 'feature_year_end_summary', label: 'Bulk Year-End Statements', enabled: practitioner.feature_year_end_summary },
    { key: 'feature_intake_forms', label: 'Intake Forms', enabled: practitioner.feature_intake_forms },
    { key: 'feature_documents', label: 'Document Templates', enabled: practitioner.feature_documents },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/practitioners">
            <Button variant="ghost" size="sm">
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{practitioner.name}</h1>
            <p className="text-slate-600">{practitioner.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SeedDemoDataButton
            practitionerId={practitioner.id}
            hasUserId={!!practitioner.user_id}
            hasPatients={(practitioner.patient_count || 0) > 0}
          />
          <DeleteDemoDataButton
            practitionerId={practitioner.id}
            hasUserId={!!practitioner.user_id}
          />
          <SendMagicLinkButton
            practitionerId={practitioner.id}
            practitionerEmail={practitioner.email}
            hasUserId={!!practitioner.user_id}
          />
          <ImpersonateButton
            practitionerId={practitioner.id}
            practitionerName={practitioner.name}
            hasUserId={!!practitioner.user_id}
            variant="default"
            showLabel
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{practitioner.patient_count || 0}</div>
            <p className="text-sm text-slate-500">Patients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{practitioner.visit_count || 0}</div>
            <p className="text-sm text-slate-500">Total Visits</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{practitioner.visits_this_week || 0}</div>
            <p className="text-sm text-slate-500">Visits This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(practitioner.total_payments || 0)}</div>
            <p className="text-sm text-slate-500">Total Payments</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Info */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>General account details and status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-slate-500">Status</label>
                <div className="mt-1">
                  <Badge variant={practitioner.status === 'active' ? 'default' : 'secondary'}>
                    {practitioner.status}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Workspace</label>
                <p className="mt-1 text-slate-900">{practitioner.workspace_name || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Created</label>
                <p className="mt-1 text-slate-900">{formatDate(practitioner.created_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Last Login</label>
                <p className="mt-1 text-slate-900">{formatDate(practitioner.last_login_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Last Activity</label>
                <p className="mt-1 text-slate-900">{formatDate(practitioner.last_activity_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-500">Login Count</label>
                <p className="mt-1 text-slate-900">{practitioner.login_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Info - Now uses full-width BillingSection below */}
      </div>

      {/* Billing Section */}
      <BillingSection
        practitionerId={practitioner.id}
        practitionerEmail={practitioner.email}
        practitionerName={practitioner.name}
        planType={practitioner.plan_type}
        billingStatus={practitioner.billing_status}
        subscriptionStatus={practitioner.subscription_status}
        monthlyPrice={practitioner.monthly_price}
        trialEndsAt={practitioner.trial_ends_at}
        stripeCustomerId={practitioner.stripe_customer_id}
        stripeSubscriptionId={practitioner.stripe_subscription_id}
      />

      {/* Onboarding */}
      <OnboardingSectionWrapper
        practitionerId={practitioner.id}
        practitionerName={practitioner.name}
        onboardingStatus={onboardingStatus}
        onboardingNotes={practitioner.onboarding_notes || null}
        onboardingStartedAt={practitioner.onboarding_started_at || null}
        onboardingCompletedAt={practitioner.onboarding_completed_at || null}
        onboardingChecklist={onboardingChecklist}
        questionnaire={questionnaire}
      />

      {/* Practice Type */}
      <PracticeTypeCard
        practitionerId={practitioner.id}
        currentPracticeType={(practitioner.practice_type || 'insurance') as PracticeType}
      />

      {/* Feature Flags */}
      <FeatureFlagsCard practitionerId={practitioner.id} featureFlags={featureFlags} />

      {/* Admin Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Activity Log</CardTitle>
          <CardDescription>Admin actions related to this practitioner (updates, impersonation, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No activity recorded yet</p>
          ) : (
            <div className="space-y-4">
              {activity.map((event) => (
                <div key={event.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm text-slate-900">{event.description}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {event.event_type} &middot; {formatDate(event.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
