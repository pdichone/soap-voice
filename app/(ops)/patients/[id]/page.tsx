'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLocalDateString, formatDate, formatTimestamp } from '@/lib/date-utils';
import type { PatientNonPhi, VisitNonPhi, ClaimNonPhi, ReferralNonPhi, PaymentNonPhi, DocumentTemplate, ClientDocument, PatientBenefits } from '@/lib/types-ops';
import type { IntakeForm, IntakeLink, IntakeResponse } from '@/lib/types-intake';
import { ALL_PAYMENT_METHODS, usePracticeConfig } from '@/lib/practice-config';
import { QuestionRenderer } from '@/components/intake/QuestionRenderer';
import { BenefitsSection } from '@/components/ops/BenefitsSection';

interface DocumentWithStatus extends DocumentTemplate {
  clientDoc?: ClientDocument | null;
}

const VISIT_LIMIT_TYPES = [
  { value: 'PER_REFERRAL', label: 'Per Referral' },
  { value: 'PER_YEAR', label: 'Per Calendar Year' },
  { value: 'UNLIMITED', label: 'Unlimited' },
];

export default function PatientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  // Get practice config for terminology
  const { practiceType } = usePracticeConfig();
  const isCashOnly = practiceType === 'cash_only';

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

  // Referral form state
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [savingReferral, setSavingReferral] = useState(false);
  const [editingReferral, setEditingReferral] = useState<ReferralNonPhi | null>(null);
  const [referralLabel, setReferralLabel] = useState('');
  const [visitLimitType, setVisitLimitType] = useState('PER_REFERRAL');
  const [visitLimitCount, setVisitLimitCount] = useState('');
  const [referralStartDate, setReferralStartDate] = useState(getLocalDateString());
  const [referralExpirationDate, setReferralExpirationDate] = useState('');
  const [referralNotes, setReferralNotes] = useState('');

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Run all queries in parallel for faster loading
    const [patientResult, visitsResult, claimsResult, referralsResult, paymentsResult, templatesResult, clientDocsResult, intakeFormsResult, intakeLinksResult, intakeResponsesResult, benefitsResult, consentLinksResult] = await Promise.all([
      supabase
        .from('patients_non_phi')
        .select('*')
        .eq('id', id)
        .eq('owner_user_id', user.id)
        .single(),
      supabase
        .from('visits_non_phi')
        .select('*')
        .eq('patient_id', id)
        .order('visit_date', { ascending: false }),
      supabase
        .from('claims_non_phi')
        .select('*')
        .eq('patient_id', id)
        .order('date_of_service', { ascending: false }),
      supabase
        .from('referrals_non_phi')
        .select('*')
        .eq('patient_id', id)
        .order('referral_start_date', { ascending: false }),
      supabase
        .from('payments_non_phi')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('document_templates')
        .select('*')
        .eq('owner_user_id', user.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('client_documents')
        .select('*')
        .eq('patient_id', id)
        .eq('owner_user_id', user.id),
      // Intake forms
      supabase
        .from('intake_forms')
        .select('*')
        .eq('owner_user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      // Intake links for this patient
      supabase
        .from('intake_links')
        .select('*, intake_forms (*)')
        .eq('patient_id', id)
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false }),
      // Intake responses for this patient
      supabase
        .from('intake_responses')
        .select('*, intake_forms (*)')
        .eq('patient_id', id)
        .eq('owner_user_id', user.id)
        .order('submitted_at', { ascending: false }),
      // Patient benefits
      supabase
        .from('patient_benefits')
        .select('*')
        .eq('patient_id', id)
        .eq('owner_user_id', user.id)
        .single(),
      // Consent links for this patient
      supabase
        .from('consent_links')
        .select('*')
        .eq('patient_id', id)
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (patientResult.data) {
      setPatient(patientResult.data);
    }
    setVisits(visitsResult.data || []);
    setClaims(claimsResult.data || []);
    setReferrals(referralsResult.data || []);
    setPayments(paymentsResult.data || []);

    // Merge templates with client documents
    const templates = templatesResult.data || [];
    const clientDocs = clientDocsResult.data || [];
    const docsWithStatus: DocumentWithStatus[] = templates.map(template => ({
      ...template,
      clientDoc: clientDocs.find(cd => cd.template_id === template.id) || null,
    }));
    setDocuments(docsWithStatus);

    // Set intake data
    setIntakeForms(intakeFormsResult.data || []);
    setIntakeLinks(intakeLinksResult.data || []);
    setIntakeResponses(intakeResponsesResult.data || []);

    // Set benefits (may be null if not configured)
    setBenefits(benefitsResult.data || null);

    // Set consent links
    setConsentLinks(consentLinksResult.data || []);

    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetReferralForm = () => {
    setReferralLabel('');
    setVisitLimitType('PER_REFERRAL');
    setVisitLimitCount('');
    setReferralStartDate(getLocalDateString());
    setReferralExpirationDate('');
    setReferralNotes('');
    setEditingReferral(null);
  };

  const resetPaymentForm = () => {
    setPaymentAmount(patient?.default_copay_amount?.toString() || '');
    setPaymentMethod('CASH');
    setPaymentIsCopay(true);
  };

  const handleSavePayment = async () => {
    if (!paymentAmount) return;

    setSavingPayment(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingPayment(false);
      return;
    }

    const { error } = await supabase.from('payments_non_phi').insert({
      owner_user_id: user.id,
      patient_id: id,
      amount: parseFloat(paymentAmount),
      method: paymentMethod,
      // For cash-only practices, payments are never copays
      is_copay: !isCashOnly && paymentIsCopay,
    });

    if (!error) {
      setShowPaymentDialog(false);
      resetPaymentForm();
      loadData();
      router.refresh();
    }
    setSavingPayment(false);
  };

  const openEditReferral = (referral: ReferralNonPhi) => {
    setEditingReferral(referral);
    setReferralLabel(referral.referral_label || '');
    setVisitLimitType(referral.visit_limit_type || 'PER_REFERRAL');
    setVisitLimitCount(referral.visit_limit_count?.toString() || '');
    setReferralStartDate(referral.referral_start_date || '');
    setReferralExpirationDate(referral.referral_expiration_date || '');
    setReferralNotes(referral.notes || '');
    setShowReferralDialog(true);
  };

  const handleSaveReferral = async () => {
    setSavingReferral(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in to save a referral');
      setSavingReferral(false);
      return;
    }

    // Ensure profile exists (needed for foreign key)
    await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });

    const referralData = {
      patient_id: id,
      owner_user_id: user.id,
      referral_label: referralLabel.trim() || null,
      visit_limit_type: visitLimitType,
      visit_limit_count: visitLimitType === 'UNLIMITED' ? null : (visitLimitCount ? parseInt(visitLimitCount) : null),
      referral_start_date: referralStartDate || null,
      referral_expiration_date: referralExpirationDate || null,
      notes: referralNotes.trim() || null,
    };

    let error;

    if (editingReferral) {
      // Update existing referral - don't include owner_user_id in update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { owner_user_id, patient_id, ...updateData } = referralData;
      const result = await supabase
        .from('referrals_non_phi')
        .update(updateData)
        .eq('id', editingReferral.id)
        .eq('owner_user_id', user.id);
      error = result.error;
    } else {
      // Insert new referral
      const result = await supabase
        .from('referrals_non_phi')
        .insert(referralData);
      error = result.error;
    }

    if (error) {
      console.error('Error saving referral:', error);
      alert(`Error saving referral: ${error.message}`);
    } else {
      setShowReferralDialog(false);
      resetReferralForm();
      loadData();
      router.refresh();
    }

    setSavingReferral(false);
  };

  const getVisitsUsedForReferral = (referralId: string) => {
    return visits.filter(v => v.referral_id === referralId).length;
  };

  const handleSignDocument = async (doc: DocumentWithStatus) => {
    setSavingSignature(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingSignature(false);
      return;
    }

    if (doc.clientDoc) {
      // Update existing
      const { error } = await supabase
        .from('client_documents')
        .update({
          status: 'SIGNED',
          signed_at: new Date().toISOString(),
          signature_data: 'Acknowledged',
        })
        .eq('id', doc.clientDoc.id);

      if (error) console.error('Error updating document:', error);
    } else {
      // Create new
      const { error } = await supabase.from('client_documents').insert({
        owner_user_id: user.id,
        patient_id: id,
        template_id: doc.id,
        status: 'SIGNED',
        signed_at: new Date().toISOString(),
        signature_data: 'Acknowledged',
      });

      if (error) console.error('Error signing document:', error);
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
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSendingIntake(false);
      return;
    }

    // Generate a random token
    const token = crypto.randomUUID().replace(/-/g, '');

    // Create expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase.from('intake_links').insert({
      token,
      form_id: selectedIntakeFormId,
      patient_id: id,
      owner_user_id: user.id,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('Error creating intake link:', error);
      alert('Failed to create intake link');
    } else {
      setShowSendIntakeDialog(false);
      setSelectedIntakeFormId('');
      loadData();
      router.refresh();
    }
    setSendingIntake(false);
  };

  const copyIntakeLink = (token: string) => {
    const url = `${window.location.origin}/intake/${token}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleSendConsentForm = async (doc: DocumentWithStatus) => {
    setSendingConsentLink(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSendingConsentLink(false);
      return;
    }

    // Generate a short random token (8 chars)
    const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Create expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error } = await supabase.from('consent_links').insert({
      token,
      template_id: doc.id,
      patient_id: id,
      owner_user_id: user.id,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('Error creating consent link:', error);
      alert('Failed to create consent link');
    } else {
      setSendingConsentDoc(null);
      loadData();
      router.refresh();
    }
    setSendingConsentLink(false);
  };

  const copyConsentLink = (token: string) => {
    const url = `${window.location.origin}/consent/${token}`;
    navigator.clipboard.writeText(url);
    alert('Consent link copied to clipboard!');
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
          {patient.default_copay_amount && (
            <Badge variant="outline" className="text-sm">
              {isCashOnly ? 'Rate' : 'Collect'}: ${patient.default_copay_amount}
            </Badge>
          )}
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
      <div className={`grid gap-3 ${isCashOnly ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{visits.length}</div>
            <p className="text-xs text-gray-500">{visitLabelPlural}</p>
          </CardContent>
        </Card>
        {/* Only show claims for insurance practices */}
        {!isCashOnly && (
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
        <TabsList className={`grid w-full ${isCashOnly ? 'grid-cols-4' : 'grid-cols-7'}`}>
          <TabsTrigger value="visits">{visitLabelPlural}</TabsTrigger>
          {!isCashOnly && <TabsTrigger value="benefits">Benefits</TabsTrigger>}
          {!isCashOnly && <TabsTrigger value="claims">Claims</TabsTrigger>}
          {!isCashOnly && <TabsTrigger value="referrals">Referrals</TabsTrigger>}
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="intake" className="relative">
            Intake
            {intakeResponses.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" className="relative">
            Docs
            {documents.length > 0 && getDocumentStats().signed < documents.length && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full" />
            )}
          </TabsTrigger>
        </TabsList>

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

        <TabsContent value="referrals" className="space-y-3 mt-4">
          <div className="flex justify-end">
            <Dialog open={showReferralDialog} onOpenChange={(open) => {
              setShowReferralDialog(open);
              if (!open) resetReferralForm();
            }}>
              <DialogTrigger asChild>
                <Button size="sm">Add Referral</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingReferral ? 'Edit Referral' : 'Add New Referral'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Referral Label</label>
                    <Input
                      value={referralLabel}
                      onChange={(e) => setReferralLabel(e.target.value)}
                      placeholder="e.g., Dr. Smith referral"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Visit Limit Type</label>
                    <Select value={visitLimitType} onValueChange={setVisitLimitType}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VISIT_LIMIT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {visitLimitType !== 'UNLIMITED' && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Visit Limit Count</label>
                      <Input
                        type="number"
                        value={visitLimitCount}
                        onChange={(e) => setVisitLimitCount(e.target.value)}
                        placeholder="e.g., 12"
                        className="mt-1"
                        min="1"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Start Date</label>
                      <Input
                        type="date"
                        value={referralStartDate}
                        onChange={(e) => setReferralStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Expiration Date</label>
                      <Input
                        type="date"
                        value={referralExpirationDate}
                        onChange={(e) => setReferralExpirationDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notes (non-medical)</label>
                    <textarea
                      value={referralNotes}
                      onChange={(e) => setReferralNotes(e.target.value)}
                      placeholder="Any administrative notes..."
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleSaveReferral}
                    disabled={savingReferral}
                    className="w-full"
                  >
                    {savingReferral ? 'Saving...' : (editingReferral ? 'Update Referral' : 'Add Referral')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {referrals.length > 0 ? (
            referrals.map((referral) => {
              const visitsUsed = getVisitsUsedForReferral(referral.id);
              const isExpired = referral.referral_expiration_date && new Date(referral.referral_expiration_date) < new Date();
              const isNearLimit = referral.visit_limit_count && visitsUsed >= referral.visit_limit_count * 0.8;

              return (
                <Card key={referral.id} className={isExpired ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {referral.referral_label || 'Referral'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {referral.visit_limit_type === 'UNLIMITED'
                            ? 'Unlimited visits'
                            : `${visitsUsed} / ${referral.visit_limit_count || '?'} visits used`}
                        </p>
                        {referral.referral_start_date && (
                          <p className="text-xs text-gray-400 mt-1">
                            Started {formatDate(referral.referral_start_date)}
                            {referral.referral_expiration_date && (
                              <> - Expires {formatDate(referral.referral_expiration_date)}</>
                            )}
                          </p>
                        )}
                        {/* Progress bar */}
                        {referral.visit_limit_count && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (visitsUsed / referral.visit_limit_count) * 100)}%`
                              }}
                            />
                          </div>
                        )}
                        {referral.notes && (
                          <p className="text-xs text-gray-500 mt-2 italic">{referral.notes}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant="outline"
                          className={
                            isExpired
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }
                        >
                          {isExpired ? 'Expired' : 'Active'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => openEditReferral(referral)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                <p className="mb-4">No referrals on file</p>
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
