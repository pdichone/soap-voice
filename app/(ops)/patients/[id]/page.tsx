'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate, formatTimestamp } from '@/lib/date-utils';
import type { PatientNonPhi, VisitNonPhi, ClaimNonPhi, ReferralNonPhi, PaymentNonPhi, DocumentTemplate, ClientDocument, PatientBenefits } from '@/lib/types-ops';
import type { IntakeForm, IntakeLink, IntakeResponse } from '@/lib/types-intake';
import { ALL_PAYMENT_METHODS, usePracticeConfig } from '@/lib/practice-config';
import { useFeatureFlags } from '@/lib/feature-flags';
import { QuestionRenderer } from '@/components/intake/QuestionRenderer';
import { BenefitsSection } from '@/components/ops/BenefitsSection';
import { GenerateSummaryDialog } from '@/components/ops/GenerateSummaryDialog';
import { EnhancedReferralForm } from '@/components/ops/EnhancedReferralForm';
import {
  PHYSICIAN_SPECIALTIES,
  calculateReferralStatus,
  getAlertLevelColor,
} from '@/lib/referral-presets';

interface DocumentWithStatus extends DocumentTemplate {
  clientDoc?: ClientDocument | null;
}

export default function PatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  // Get practice config for terminology
  const { practiceType } = usePracticeConfig();
  const isCashOnly = practiceType === 'cash_only';

  // Get admin feature flags
  const { flags: adminFlags } = useFeatureFlags();

  // Claims shown only if: practice type supports it AND admin has enabled the feature
  const showClaims = !isCashOnly && adminFlags.feature_claims_tracking;

  // Dynamic terminology
  const clientLabel = isCashOnly ? 'Client' : 'Patient';
  const clientLabelPlural = isCashOnly ? 'Clients' : 'Patients';
  const visitLabel = isCashOnly ? 'Session' : 'Visit';
  const visitLabelPlural = isCashOnly ? 'Sessions' : 'Visits';

  const [patient, setPatient] = useState<PatientNonPhi | null>(null);
  const [visits, setVisits] = useState<VisitNonPhi[]>([]);
  const [claims, setClaims] = useState<ClaimNonPhi[]>([]);
  const [referrals, setReferrals] = useState<ReferralNonPhi[]>([]);
  const [payments, setPayments] = useState<PaymentNonPhi[]>([]);
  const [documents, setDocuments] = useState<DocumentWithStatus[]>([]);
  const [benefits, setBenefits] = useState<PatientBenefits | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingDoc, setSigningDoc] = useState<DocumentWithStatus | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  // Intake form state
  const [intakeForms, setIntakeForms] = useState<IntakeForm[]>([]);
  const [intakeLinks, setIntakeLinks] = useState<(IntakeLink & { intake_forms?: IntakeForm })[]>([]);
  const [intakeResponses, setIntakeResponses] = useState<(IntakeResponse & { intake_forms?: IntakeForm })[]>([]);
  const [showSendIntakeDialog, setShowSendIntakeDialog] = useState(false);
  const [selectedIntakeFormId, setSelectedIntakeFormId] = useState('');
  const [sendingIntake, setSendingIntake] = useState(false);
  const [viewingResponse, setViewingResponse] = useState<(IntakeResponse & { intake_forms?: IntakeForm }) | null>(null);

  // Consent link state
  interface ConsentLink {
    id: string;
    token: string;
    template_id: string;
    patient_id: string;
    owner_user_id: string;
    expires_at: string | null;
    signed_at: string | null;
    created_at: string;
  }
  const [consentLinks, setConsentLinks] = useState<ConsentLink[]>([]);
  const [sendingConsentDoc, setSendingConsentDoc] = useState<DocumentWithStatus | null>(null);
  const [sendingConsentLink, setSendingConsentLink] = useState(false);

  // Payment form state
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentIsCopay, setPaymentIsCopay] = useState(true);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);

  // Referral form state
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [editingReferral, setEditingReferral] = useState<ReferralNonPhi | null>(null);

  // Archive state
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-clear toast after 2 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  const handleArchivePatient = async () => {
    setArchiving(true);
    try {
      const response = await fetch(`/api/data/patients/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });

      if (response.ok) {
        router.push('/patients?archived=success');
      } else {
        showToast('Failed to archive');
        setArchiving(false);
      }
    } catch (error) {
      console.error('Error archiving patient:', error);
      showToast('Failed to archive');
      setArchiving(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const response = await fetch(`/api/data/patients/${id}`);
      const data = await response.json();

      if (!response.ok) {
        console.error('[PatientDetail] Error loading data:', data.error);
        setLoading(false);
        return;
      }

      if (data.patient) {
        setPatient(data.patient);
      }
      setVisits(data.visits || []);
      setClaims(data.claims || []);
      setReferrals(data.referrals || []);
      setPayments(data.payments || []);

      // Merge templates with client documents
      const templates = data.templates || [];
      const clientDocs = data.clientDocs || [];
      const docsWithStatus: DocumentWithStatus[] = templates.map((template: DocumentTemplate) => ({
        ...template,
        clientDoc: clientDocs.find((cd: ClientDocument) => cd.template_id === template.id) || null,
      }));
      setDocuments(docsWithStatus);

      // Set intake data
      setIntakeForms(data.intakeForms || []);
      setIntakeLinks(data.intakeLinks || []);
      setIntakeResponses(data.intakeResponses || []);

      // Set benefits (may be null if not configured)
      setBenefits(data.benefits || null);

      // Set consent links
      setConsentLinks(data.consentLinks || []);

      setLoading(false);
    } catch (error) {
      console.error('[PatientDetail] Error loading data:', error);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetPaymentForm = () => {
    setPaymentAmount(patient?.default_copay_amount?.toString() || '');
    setPaymentMethod('CASH');
    setPaymentIsCopay(true);
  };

  const handleSavePayment = async () => {
    if (!paymentAmount) return;

    setSavingPayment(true);
    try {
      const response = await fetch(`/api/data/patients/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'logPayment',
          data: {
            amount: paymentAmount,
            method: paymentMethod,
            // For cash-only practices, payments are never copays
            is_copay: !isCashOnly && paymentIsCopay,
          },
        }),
      });

      if (response.ok) {
        setShowPaymentDialog(false);
        resetPaymentForm();
        loadData();
        router.refresh();
      }
    } catch (error) {
      console.error('Error saving payment:', error);
    }
    setSavingPayment(false);
  };

  const getVisitsUsedForReferral = (referralId: string) => {
    return visits.filter(v => v.referral_id === referralId).length;
  };

  const handleSignDocument = async (doc: DocumentWithStatus) => {
    setSavingSignature(true);
    try {
      const response = await fetch(`/api/data/patients/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'signDocument',
          data: {
            templateId: doc.id,
            clientDocId: doc.clientDoc?.id || null,
          },
        }),
      });

      if (!response.ok) {
        console.error('Error signing document');
      }
    } catch (error) {
      console.error('Error signing document:', error);
    }

    setSigningDoc(null);
    loadData();
    router.refresh();
    setSavingSignature(false);
  };

  const getDocumentStats = () => {
    const total = documents.length;
    const signed = documents.filter(d => d.clientDoc?.status === 'SIGNED').length;
    const required = documents.filter(d => d.is_required).length;
    const requiredSigned = documents.filter(d => d.is_required && d.clientDoc?.status === 'SIGNED').length;
    return { total, signed, required, requiredSigned };
  };

  const handleSendIntakeForm = async () => {
    if (!selectedIntakeFormId) return;

    setSendingIntake(true);
    try {
      // Generate a random token
      const token = crypto.randomUUID().replace(/-/g, '');

      // Create expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const response = await fetch(`/api/data/patients/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createIntakeLink',
          data: {
            formId: selectedIntakeFormId,
            token,
            expiresAt: expiresAt.toISOString(),
          },
        }),
      });

      if (!response.ok) {
        console.error('Error creating intake link');
        alert('Failed to create intake link');
      } else {
        setShowSendIntakeDialog(false);
        setSelectedIntakeFormId('');
        loadData();
        router.refresh();
      }
    } catch (error) {
      console.error('Error creating intake link:', error);
      alert('Failed to create intake link');
    }
    setSendingIntake(false);
  };

  const copyIntakeLink = (token: string) => {
    const url = `${window.location.origin}/intake/${token}`;
    navigator.clipboard.writeText(url);
    showToast('Copied to clipboard');
  };

  const handleSendConsentForm = async (doc: DocumentWithStatus) => {
    setSendingConsentLink(true);
    try {
      // Generate a short random token (8 chars)
      const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
      let token = '';
      for (let i = 0; i < 8; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Create expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const response = await fetch(`/api/data/patients/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createConsentLink',
          data: {
            templateId: doc.id,
            token,
            expiresAt: expiresAt.toISOString(),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Error creating consent link:', result.error);
        alert('Failed to create consent link');
      } else if (result.link) {
        // Immediately add the new link to state to prevent race conditions
        setConsentLinks(prev => [result.link, ...prev]);
        setSendingConsentDoc(null);
        // Also copy the link immediately so user can share it
        const url = `${window.location.origin}/consent/${token}`;
        navigator.clipboard.writeText(url);
        showToast('Link created and copied to clipboard');
        router.refresh();
      }
    } catch (error) {
      console.error('Error creating consent link:', error);
      alert('Failed to create consent link');
    }
    setSendingConsentLink(false);
  };

  const copyConsentLink = (token: string) => {
    const url = `${window.location.origin}/consent/${token}`;
    navigator.clipboard.writeText(url);
    showToast('Copied to clipboard');
  };

  const getConsentLinkForDoc = (templateId: string) => {
    return consentLinks.find(link =>
      link.template_id === templateId &&
      !link.signed_at &&
      (!link.expires_at || new Date(link.expires_at) > new Date())
    );
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-gray-500 animate-pulse">Loading {clientLabel.toLowerCase()}...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">{clientLabel} not found</p>
        <Link href="/patients" className="text-blue-600 font-medium mt-2 inline-block">
          Back to {clientLabelPlural}
        </Link>
      </div>
    );
  }

  const activeReferral = referrals.find(r =>
    !r.referral_expiration_date || new Date(r.referral_expiration_date) >= new Date()
  );

  return (
    <div className="p-4 space-y-4">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
            {toastMessage}
          </div>
        </div>
      )}

      <header>
        <Link href="/patients" className="text-blue-600 text-sm font-medium flex items-center gap-1 mb-2">
          <ChevronLeftIcon className="w-4 h-4" />
          Back to {clientLabelPlural}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.display_name}</h1>
            {/* Only show insurer for insurance practices */}
            {!isCashOnly && patient.insurer_name && (
              <p className="text-gray-500">{patient.insurer_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {patient.default_copay_amount && (
              <Badge variant="outline" className="text-sm">
                {isCashOnly ? 'Rate' : 'Collect'}: ${patient.default_copay_amount}
              </Badge>
            )}
            {/* Archive button */}
            <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                  <ArchiveIcon className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive {clientLabel}</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <p className="text-gray-600">
                    Are you sure you want to archive <strong>{patient.display_name}</strong>?
                  </p>
                  <p className="text-sm text-gray-500">
                    Archived {clientLabel.toLowerCase()}s won&apos;t appear in your active list, but all their {visitLabelPlural.toLowerCase()}, payments, and documents will be preserved. You can restore them anytime.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowArchiveDialog(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleArchivePatient}
                      disabled={archiving}
                      className="flex-1"
                    >
                      {archiving ? 'Archiving...' : 'Archive'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Active Referral Alert - only show for insurance practices */}
      {!isCashOnly && activeReferral && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">
                  {activeReferral.referral_label || 'Active Referral'}
                </p>
                <p className="text-sm text-blue-700">
                  {activeReferral.visit_limit_count
                    ? `${getVisitsUsedForReferral(activeReferral.id)} / ${activeReferral.visit_limit_count} visits used`
                    : 'Unlimited visits'}
                </p>
                {/* Progress bar for visit usage */}
                {activeReferral.visit_limit_count && (
                  <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (getVisitsUsedForReferral(activeReferral.id) / activeReferral.visit_limit_count) * 100)}%`
                      }}
                    />
                  </div>
                )}
              </div>
              {activeReferral.referral_expiration_date && (
                <Badge
                  variant="outline"
                  className={
                    new Date(activeReferral.referral_expiration_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300'
                  }
                >
                  Expires {formatDate(activeReferral.referral_expiration_date)}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className={`grid gap-3 ${showClaims ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{visits.length}</div>
            <p className="text-xs text-gray-500">{visitLabelPlural}</p>
          </CardContent>
        </Card>
        {/* Only show claims for insurance practices with claims tracking enabled */}
        {showClaims && (
          <Card>
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold">
                {claims.filter(c => ['TO_SUBMIT', 'SUBMITTED', 'PENDING'].includes(c.status)).length}
              </div>
              <p className="text-xs text-gray-500">Pending Claims</p>
            </CardContent>
          </Card>
        )}
        {/* Show payments total for cash-only, referrals for insurance */}
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">
              {isCashOnly
                ? `$${payments.reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}`
                : referrals.length}
            </div>
            <p className="text-xs text-gray-500">{isCashOnly ? 'Total Paid' : 'Referrals'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visits" className="w-full">
        {/* Scrollable tabs container - swipe on mobile, fits on larger screens */}
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-max gap-1 p-1 sm:w-full sm:flex sm:flex-wrap sm:justify-start">
            <TabsTrigger value="visits" className="flex-shrink-0 px-4 py-2 text-sm whitespace-nowrap">
              {visitLabelPlural}
            </TabsTrigger>
            {!isCashOnly && (
              <TabsTrigger value="benefits" className="flex-shrink-0 px-4 py-2 text-sm whitespace-nowrap">
                Benefits
              </TabsTrigger>
            )}
            {showClaims && (
              <TabsTrigger value="claims" className="flex-shrink-0 px-4 py-2 text-sm whitespace-nowrap">
                Claims
              </TabsTrigger>
            )}
            {!isCashOnly && (
              <TabsTrigger value="referrals" className="flex-shrink-0 px-4 py-2 text-sm whitespace-nowrap">
                Referrals
              </TabsTrigger>
            )}
            <TabsTrigger value="payments" className="flex-shrink-0 px-4 py-2 text-sm whitespace-nowrap">
              Payments
            </TabsTrigger>
            {adminFlags.feature_intake_forms && (
              <TabsTrigger value="intake" className="relative flex-shrink-0 px-4 py-2 text-sm whitespace-nowrap">
                Intake
                {intakeResponses.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                )}
              </TabsTrigger>
            )}
            {adminFlags.feature_documents && (
              <TabsTrigger value="documents" className="relative flex-shrink-0 px-4 py-2 text-sm whitespace-nowrap">
                Docs
                {documents.length > 0 && getDocumentStats().signed < documents.length && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="visits" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => router.push(`/visits?patientId=${id}&action=new`)}>
              Add {visitLabel}
            </Button>
          </div>
          {visits.length > 0 ? (
            visits.map((visit) => (
              <Card key={visit.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatDate(visit.visit_date, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      {/* Only show insurance/self-pay indicator for insurance practices */}
                      {!isCashOnly && (
                        <p className="text-sm text-gray-500">
                          {visit.is_billable_to_insurance ? 'Insurance' : 'Self-pay'}
                        </p>
                      )}
                    </div>
                    {/* Only show referral badge for insurance practices */}
                    {!isCashOnly && visit.referral_id && (
                      <Badge variant="outline" className="text-xs">
                        Referral
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No {visitLabelPlural.toLowerCase()} recorded yet
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Benefits Tab - Insurance practices only */}
        {!isCashOnly && patient && (
          <TabsContent value="benefits" className="mt-4">
            <BenefitsSection
              patient={patient}
              benefits={benefits}
              onBenefitsUpdate={loadData}
            />
          </TabsContent>
        )}

        {showClaims && (
          <TabsContent value="claims" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => router.push(`/claims?patientId=${id}&action=new`)}>
                Add Claim
              </Button>
            </div>
            {claims.length > 0 ? (
              claims.map((claim) => (
                <Card key={claim.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {claim.date_of_service
                            ? formatDate(claim.date_of_service)
                            : 'No date'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {claim.insurer_name || 'No insurer'} - ${claim.billed_amount || 0}
                        </p>
                      </div>
                      <ClaimStatusBadge status={claim.status} />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  No claims yet
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="referrals" className="space-y-3 mt-4">
          {/* Enhanced Referral Dialog */}
          <Dialog open={showReferralDialog} onOpenChange={(open) => {
            setShowReferralDialog(open);
            if (!open) setEditingReferral(null);
          }}>
            <div className="flex justify-end">
              <DialogTrigger asChild>
                <Button size="sm">Add Referral</Button>
              </DialogTrigger>
            </div>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingReferral ? 'Edit Referral' : 'Add New Referral'}</DialogTitle>
              </DialogHeader>
              <EnhancedReferralForm
                patient={patient}
                referral={editingReferral}
                onSave={() => {
                  setShowReferralDialog(false);
                  setEditingReferral(null);
                  loadData();
                  router.refresh();
                }}
                onCancel={() => {
                  setShowReferralDialog(false);
                  setEditingReferral(null);
                }}
              />
            </DialogContent>
          </Dialog>

          {referrals.length > 0 ? (
            referrals.map((referral) => {
              const visitsUsed = getVisitsUsedForReferral(referral.id);
              const statusInfo = calculateReferralStatus(referral, visitsUsed);
              const alertColors = getAlertLevelColor(statusInfo.alertLevel);
              const specialtyLabel = PHYSICIAN_SPECIALTIES.find(s => s.value === referral.physician_specialty)?.label || referral.physician_specialty;

              return (
                <Card key={referral.id} className={`${statusInfo.status === 'expired' || statusInfo.status === 'exhausted' ? 'opacity-70' : ''} border-l-4 ${alertColors.border}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header with physician name */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">
                            {referral.physician_name || referral.referral_label || 'Referral'}
                          </p>
                          {specialtyLabel && (
                            <Badge variant="outline" className="text-xs bg-gray-50">
                              {specialtyLabel}
                            </Badge>
                          )}
                        </div>

                        {/* Payer and auth info */}
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                          {referral.payer && <span>{referral.payer}</span>}
                          {referral.authorization_number && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              Auth: {referral.authorization_number}
                            </span>
                          )}
                        </div>

                        {/* Visit tracking */}
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">
                            {referral.visit_limit_type === 'UNLIMITED'
                              ? 'Unlimited visits'
                              : `${visitsUsed} / ${referral.visit_limit_count || '?'} visits used`}
                          </p>
                          {referral.visit_limit_count && (
                            <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  statusInfo.status === 'exhausted' ? 'bg-red-500' :
                                  statusInfo.status === 'visits_low' ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, statusInfo.percentUsed)}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Dates */}
                        <p className="text-xs text-gray-400 mt-2">
                          {referral.referral_start_date && `Started ${formatDate(referral.referral_start_date)}`}
                          {referral.referral_expiration_date && ` - Expires ${formatDate(referral.referral_expiration_date)}`}
                        </p>

                        {/* ICD-10 and CPT codes */}
                        {(referral.icd10_codes?.length || referral.cpt_codes?.length) ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {referral.icd10_codes?.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                {code}
                              </Badge>
                            ))}
                            {referral.cpt_codes?.map((code) => (
                              <Badge key={code} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                {code}
                              </Badge>
                            ))}
                          </div>
                        ) : null}

                        {referral.notes && (
                          <p className="text-xs text-gray-500 mt-2 italic">{referral.notes}</p>
                        )}
                      </div>

                      {/* Status and actions */}
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="outline" className={`${alertColors.bg} ${alertColors.text}`}>
                          {statusInfo.message}
                        </Badge>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 px-2"
                            onClick={() => {
                              setEditingReferral(referral);
                              setShowReferralDialog(true);
                            }}
                          >
                            Edit
                          </Button>
                          {(statusInfo.status === 'expired' || statusInfo.status === 'exhausted' || statusInfo.status === 'visits_low') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                              onClick={() => {
                                // Create a new referral pre-filled with the old one's data (but clear id and dates for a new referral)
                                const renewedReferral: ReferralNonPhi = {
                                  ...referral,
                                  id: '', // Will be ignored when creating new
                                  status: 'active',
                                  referral_start_date: null,
                                  referral_expiration_date: null,
                                  created_at: '',
                                  updated_at: '',
                                };
                                setEditingReferral(renewedReferral);
                                setShowReferralDialog(true);
                              }}
                            >
                              <RefreshIcon className="w-3 h-3 mr-1" />
                              Renew
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <ReferralIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="mb-2">No referrals on file</p>
                <p className="text-sm mb-4">Add a referral to track visits, authorization, and physician info</p>
                <Button onClick={() => setShowReferralDialog(true)}>Add First Referral</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">
                Total: ${payments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowSummaryDialog(true)} className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800">
                <FileTextIcon className="w-4 h-4 mr-1" />
                Year-End Statement
              </Button>
              <Dialog open={showPaymentDialog} onOpenChange={(open) => {
                setShowPaymentDialog(open);
                if (open) resetPaymentForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm">Log Payment</Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Payment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Amount *</label>
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Method</label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Only show collection checkbox for insurance practices */}
                  {!isCashOnly && (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="is-copay"
                        checked={paymentIsCopay}
                        onChange={(e) => setPaymentIsCopay(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="is-copay" className="text-sm text-gray-700">
                        Patient collection
                      </label>
                    </div>
                  )}
                  <Button
                    onClick={handleSavePayment}
                    disabled={savingPayment || !paymentAmount}
                    className="w-full"
                  >
                    {savingPayment ? 'Saving...' : 'Log Payment'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          {/* Year-End Statement Dialog */}
          <GenerateSummaryDialog
            open={showSummaryDialog}
            onOpenChange={setShowSummaryDialog}
            patientId={id}
            patientName={patient.display_name}
          />

          {payments.length > 0 ? (
            payments.map((payment) => (
              <Card key={payment.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        ${payment.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(payment.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {ALL_PAYMENT_METHODS.find(m => m.value === payment.method)?.label || payment.method}
                      </Badge>
                      {/* Only show collection badge for insurance practices */}
                      {!isCashOnly && payment.is_copay && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          Collect
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <p className="mb-4">No payments recorded yet</p>
                <Button onClick={() => setShowPaymentDialog(true)}>Log First Payment</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {adminFlags.feature_intake_forms && (
        <TabsContent value="intake" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Dialog open={showSendIntakeDialog} onOpenChange={setShowSendIntakeDialog}>
              <DialogTrigger asChild>
                <Button size="sm">Send Intake Form</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Intake Form</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {intakeForms.length > 0 ? (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Select Form</label>
                        <Select value={selectedIntakeFormId} onValueChange={setSelectedIntakeFormId}>
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Choose a form..." />
                          </SelectTrigger>
                          <SelectContent>
                            {intakeForms.map((form) => (
                              <SelectItem key={form.id} value={form.id}>
                                {form.title} {form.is_default && '(Default)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-sm text-gray-500">
                        This will generate a unique link for {patient.display_name} to fill out the form. The link expires in 7 days.
                      </p>
                      <Button
                        onClick={handleSendIntakeForm}
                        disabled={sendingIntake || !selectedIntakeFormId}
                        className="w-full"
                      >
                        {sendingIntake ? 'Creating...' : 'Create Intake Link'}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 mb-4">No intake forms created yet.</p>
                      <Link href="/intake-forms">
                        <Button variant="outline">Create Intake Form</Button>
                      </Link>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Pending Intake Links */}
          {intakeLinks.filter(link => !link.completed_at).length > 0 && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-4">
                <h4 className="font-medium text-yellow-800 mb-3">Pending Intake Forms</h4>
                <div className="space-y-3">
                  {intakeLinks.filter(link => !link.completed_at).map((link) => {
                    const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
                    return (
                      <div key={link.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                        <div>
                          <p className="font-medium text-gray-900">{link.intake_forms?.title || 'Intake Form'}</p>
                          <p className="text-xs text-gray-500">
                            Created {formatDate(link.created_at)}
                            {link.expires_at && (
                              <> · {isExpired ? 'Expired' : `Expires ${formatDate(link.expires_at)}`}</>
                            )}
                          </p>
                        </div>
                        {!isExpired && (
                          <Button size="sm" variant="outline" onClick={() => copyIntakeLink(link.token)}>
                            <CopyIcon className="w-4 h-4 mr-1" />
                            Copy Link
                          </Button>
                        )}
                        {isExpired && (
                          <Badge variant="outline" className="bg-red-100 text-red-700">Expired</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Completed Intake Responses */}
          {intakeResponses.length > 0 ? (
            <>
              <h4 className="font-medium text-gray-700">Completed Forms</h4>
              {intakeResponses.map((response) => (
                <Card key={response.id} className="border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{response.intake_forms?.title || 'Intake Form'}</p>
                        <p className="text-sm text-gray-500">
                          Submitted {formatTimestamp(response.submitted_at)}
                        </p>
                      </div>
                      <Dialog open={viewingResponse?.id === response.id} onOpenChange={(open) => !open && setViewingResponse(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setViewingResponse(response)}>
                            View Responses
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{response.intake_forms?.title || 'Intake Responses'}</DialogTitle>
                          </DialogHeader>
                          <div className="py-4">
                            <p className="text-sm text-gray-500 mb-4">
                              Submitted on {new Date(response.submitted_at).toLocaleString()}
                            </p>
                            {response.intake_forms?.questions && (
                              <QuestionRenderer
                                questions={response.intake_forms.questions}
                                responses={response.responses}
                                onChange={() => {}}
                                errors={{}}
                              />
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : intakeLinks.filter(link => !link.completed_at).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <IntakeIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="mb-2">No intake forms sent yet</p>
                <p className="text-sm mb-4">Send an intake form for {patient.display_name} to complete remotely</p>
                <Button onClick={() => setShowSendIntakeDialog(true)}>Send Intake Form</Button>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
        )}

        {adminFlags.feature_documents && (
        <TabsContent value="documents" className="space-y-3 mt-4">
          {documents.length > 0 ? (
            <>
              {/* Documents Summary */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Document Status</p>
                      <p className="text-2xl font-bold">
                        {getDocumentStats().signed}/{documents.length}
                      </p>
                    </div>
                    {getDocumentStats().required > 0 && (
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Required</p>
                        <p className={`font-semibold ${getDocumentStats().requiredSigned === getDocumentStats().required ? 'text-green-600' : 'text-orange-600'}`}>
                          {getDocumentStats().requiredSigned}/{getDocumentStats().required}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Document List */}
              {documents.map((doc) => {
                const isSigned = doc.clientDoc?.status === 'SIGNED';
                const pendingLink = getConsentLinkForDoc(doc.id);
                return (
                  <Card key={doc.id} className={isSigned ? 'border-green-200' : pendingLink ? 'border-yellow-200' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">{doc.title}</h4>
                            {doc.is_required && (
                              <Badge variant="outline" className="text-xs">Required</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {doc.document_type.charAt(0) + doc.document_type.slice(1).toLowerCase()}
                          </p>
                          {isSigned && doc.clientDoc?.signed_at && (
                            <p className="text-xs text-green-600 mt-1">
                              Signed {formatDate(doc.clientDoc.signed_at.split('T')[0])}
                            </p>
                          )}
                          {pendingLink && !isSigned && (
                            <p className="text-xs text-yellow-600 mt-1">
                              Link sent {formatDate(pendingLink.created_at.split('T')[0])}
                              {pendingLink.expires_at && ` · Expires ${formatDate(pendingLink.expires_at.split('T')[0])}`}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {isSigned ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckIcon className="w-3 h-3 mr-1" />
                              Signed
                            </Badge>
                          ) : pendingLink ? (
                            <>
                              <Badge className="bg-yellow-100 text-yellow-800">
                                <SendIcon className="w-3 h-3 mr-1" />
                                Link Sent
                              </Badge>
                              <Button size="sm" variant="outline" onClick={() => copyConsentLink(pendingLink.token)}>
                                <CopyIcon className="w-3 h-3 mr-1" />
                                Copy
                              </Button>
                            </>
                          ) : (
                            <>
                              {/* Send to Sign Dialog */}
                              <Dialog open={sendingConsentDoc?.id === doc.id} onOpenChange={(open) => !open && setSendingConsentDoc(null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" onClick={() => setSendingConsentDoc(doc)}>
                                    <SendIcon className="w-3 h-3 mr-1" />
                                    Send to Sign
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Send Consent Form</DialogTitle>
                                  </DialogHeader>
                                  <div className="py-4 space-y-4">
                                    <p className="text-gray-600">
                                      Generate a unique link for <strong>{patient.display_name}</strong> to sign &quot;{doc.title}&quot; remotely.
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      The link will expire in 7 days. You can copy and share it via text, email, or any messaging app.
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setSendingConsentDoc(null)}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => handleSendConsentForm(doc)}
                                        disabled={sendingConsentLink}
                                        className="flex-1"
                                      >
                                        {sendingConsentLink ? 'Creating...' : 'Create Link'}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              {/* In-Office Sign Dialog */}
                              <Dialog open={signingDoc?.id === doc.id} onOpenChange={(open) => !open && setSigningDoc(null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline" onClick={() => setSigningDoc(doc)}>
                                    Sign in Office
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>{doc.title}</DialogTitle>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                                      {doc.content}
                                    </div>
                                  </div>
                                  <div className="border-t pt-4 space-y-3">
                                    <p className="text-sm text-gray-600">
                                      By clicking &quot;Sign Document&quot;, {patient.display_name} acknowledges they have read and understood this document.
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => setSigningDoc(null)}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => handleSignDocument(doc)}
                                        disabled={savingSignature}
                                        className="flex-1"
                                      >
                                        {savingSignature ? 'Signing...' : 'Sign Document'}
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <DocumentIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="mb-2">No document templates created yet</p>
                <p className="text-sm mb-4">Create intake forms and consent documents in Settings</p>
                <Link href="/documents">
                  <Button variant="outline">Manage Documents</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ClaimStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    TO_SUBMIT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
    DENIED: 'bg-red-100 text-red-800',
    APPEAL: 'bg-purple-100 text-purple-800',
  };

  const labels: Record<string, string> = {
    TO_SUBMIT: 'To Submit',
    SUBMITTED: 'Submitted',
    PENDING: 'Pending',
    PAID: 'Paid',
    DENIED: 'Denied',
    APPEAL: 'Appeal',
  };

  return (
    <Badge variant="outline" className={styles[status] || 'bg-gray-100'}>
      {labels[status] || status}
    </Badge>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function IntakeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
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

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ReferralIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
