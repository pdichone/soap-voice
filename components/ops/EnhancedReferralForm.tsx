'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/lib/supabase';
import type { ReferralNonPhi, Physician, PatientNonPhi } from '@/lib/types-ops';
import {
  PHYSICIAN_SPECIALTIES,
  COMMON_ICD10_CODES,
  COMMON_CPT_CODES,
  searchICD10Codes,
  searchCPTCodes,
  type CodeOption,
} from '@/lib/referral-presets';
import { getLocalDateString } from '@/lib/date-utils';

interface EnhancedReferralFormProps {
  patient: PatientNonPhi;
  referral?: ReferralNonPhi | null;
  onSave: () => void;
  onCancel: () => void;
}

const VISIT_LIMIT_TYPES = [
  { value: 'PER_REFERRAL', label: 'Per Referral' },
  { value: 'PER_YEAR', label: 'Per Calendar Year' },
  { value: 'UNLIMITED', label: 'Unlimited' },
];

export function EnhancedReferralForm({
  patient,
  referral,
  onSave,
  onCancel,
}: EnhancedReferralFormProps) {
  const [saving, setSaving] = useState(false);

  // Physician fields
  const [physicianName, setPhysicianName] = useState(referral?.physician_name || '');
  const [physicianNpi, setPhysicianNpi] = useState(referral?.physician_npi || '');
  const [physicianSpecialty, setPhysicianSpecialty] = useState(referral?.physician_specialty || '');
  const [physicianPhone, setPhysicianPhone] = useState(referral?.physician_phone || '');
  const [physicianFax, setPhysicianFax] = useState(referral?.physician_fax || '');
  const [physicianClinic, setPhysicianClinic] = useState(referral?.physician_clinic || '');

  // Physician autocomplete
  const [physicians, setPhysicians] = useState<Physician[]>([]);
  const [showPhysicianSuggestions, setShowPhysicianSuggestions] = useState(false);
  const [physicianQuery, setPhysicianQuery] = useState('');

  // Authorization fields
  const [authorizationNumber, setAuthorizationNumber] = useState(referral?.authorization_number || '');
  const [payer, setPayer] = useState(referral?.payer || patient.insurer_name || '');

  // Visit limits
  const [visitLimitType, setVisitLimitType] = useState(referral?.visit_limit_type || 'PER_REFERRAL');
  const [visitLimitCount, setVisitLimitCount] = useState(referral?.visit_limit_count?.toString() || '12');
  const [referralStartDate, setReferralStartDate] = useState(referral?.referral_start_date || getLocalDateString());
  const [referralExpirationDate, setReferralExpirationDate] = useState(referral?.referral_expiration_date || '');

  // Codes
  const [icd10Codes, setIcd10Codes] = useState<string[]>(referral?.icd10_codes || []);
  const [cptCodes, setCptCodes] = useState<string[]>(referral?.cpt_codes || []);
  const [icd10Search, setIcd10Search] = useState('');
  const [cptSearch, setCptSearch] = useState('');
  const [showIcd10Suggestions, setShowIcd10Suggestions] = useState(false);
  const [showCptSuggestions, setShowCptSuggestions] = useState(false);

  // Notes
  const [referralLabel, setReferralLabel] = useState(referral?.referral_label || '');
  const [notes, setNotes] = useState(referral?.notes || '');

  // Load existing physicians for autocomplete
  const loadPhysicians = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('physicians')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('referral_count', { ascending: false })
      .limit(50);

    if (data) {
      setPhysicians(data);
    }
  }, []);

  useEffect(() => {
    loadPhysicians();
  }, [loadPhysicians]);

  // Filter physicians based on query
  const filteredPhysicians = physicianQuery
    ? physicians.filter(
        (p) =>
          p.name.toLowerCase().includes(physicianQuery.toLowerCase()) ||
          (p.npi && p.npi.includes(physicianQuery)) ||
          (p.clinic_name && p.clinic_name.toLowerCase().includes(physicianQuery.toLowerCase()))
      )
    : physicians.slice(0, 5);

  // Select physician from suggestions
  const selectPhysician = (physician: Physician) => {
    setPhysicianName(physician.name);
    setPhysicianNpi(physician.npi || '');
    setPhysicianSpecialty(physician.specialty || '');
    setPhysicianPhone(physician.phone || '');
    setPhysicianFax(physician.fax || '');
    setPhysicianClinic(physician.clinic_name || '');
    setShowPhysicianSuggestions(false);
    setPhysicianQuery('');
  };

  // Code suggestions
  const icd10Suggestions = icd10Search ? searchICD10Codes(icd10Search).slice(0, 8) : COMMON_ICD10_CODES.slice(0, 8);
  const cptSuggestions = cptSearch ? searchCPTCodes(cptSearch).slice(0, 8) : COMMON_CPT_CODES.slice(0, 8);

  const addIcd10Code = (code: CodeOption) => {
    if (!icd10Codes.includes(code.code)) {
      setIcd10Codes([...icd10Codes, code.code]);
    }
    setIcd10Search('');
    setShowIcd10Suggestions(false);
  };

  const removeIcd10Code = (code: string) => {
    setIcd10Codes(icd10Codes.filter((c) => c !== code));
  };

  const addCptCode = (code: CodeOption) => {
    if (!cptCodes.includes(code.code)) {
      setCptCodes([...cptCodes, code.code]);
    }
    setCptSearch('');
    setShowCptSuggestions(false);
  };

  const removeCptCode = (code: string) => {
    setCptCodes(cptCodes.filter((c) => c !== code));
  };

  const handleSave = async () => {
    if (!physicianName.trim()) {
      alert('Please enter a physician name');
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert('You must be logged in');
      setSaving(false);
      return;
    }

    // Ensure profile exists
    await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id' });

    const referralData = {
      patient_id: patient.id,
      owner_user_id: user.id,
      // Physician info
      physician_name: physicianName.trim(),
      physician_npi: physicianNpi.trim() || null,
      physician_specialty: physicianSpecialty || null,
      physician_phone: physicianPhone.trim() || null,
      physician_fax: physicianFax.trim() || null,
      physician_clinic: physicianClinic.trim() || null,
      // Authorization
      authorization_number: authorizationNumber.trim() || null,
      payer: payer.trim() || null,
      // Visit limits
      visit_limit_type: visitLimitType,
      visit_limit_count: visitLimitType === 'UNLIMITED' ? null : (visitLimitCount ? parseInt(visitLimitCount) : null),
      referral_start_date: referralStartDate || null,
      referral_expiration_date: referralExpirationDate || null,
      // Codes
      icd10_codes: icd10Codes.length > 0 ? icd10Codes : null,
      cpt_codes: cptCodes.length > 0 ? cptCodes : null,
      // Legacy/Notes
      referral_label: referralLabel.trim() || `${physicianName} - ${payer || 'Referral'}`,
      notes: notes.trim() || null,
      status: 'active',
    };

    let error;

    if (referral) {
      // Update existing
      const result = await supabase
        .from('referrals_non_phi')
        .update(referralData)
        .eq('id', referral.id)
        .eq('owner_user_id', user.id);
      error = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('referrals_non_phi')
        .insert(referralData);
      error = result.error;
    }

    if (error) {
      console.error('Error saving referral:', error);
      alert(`Error saving referral: ${error.message}`);
    } else {
      onSave();
    }

    setSaving(false);
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* Patient Info */}
      <div className="bg-blue-50 rounded-lg p-3 -mt-2">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Patient:</span> {patient.display_name}
          {patient.insurer_name && <span className="text-blue-600 ml-2">({patient.insurer_name})</span>}
        </p>
      </div>

      {/* Section: Referring Provider */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
          Referring Provider
        </h3>

        {/* Physician Name with Autocomplete */}
        <div className="relative">
          <label className="text-sm font-medium text-gray-700">
            Physician Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={physicianName}
            onChange={(e) => {
              setPhysicianName(e.target.value);
              setPhysicianQuery(e.target.value);
              setShowPhysicianSuggestions(true);
            }}
            onFocus={() => setShowPhysicianSuggestions(true)}
            onBlur={() => setTimeout(() => setShowPhysicianSuggestions(false), 200)}
            placeholder="Dr. Sarah Smith"
            className="mt-1"
          />
          {showPhysicianSuggestions && filteredPhysicians.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div className="p-2 text-xs text-gray-500 bg-gray-50 border-b">
                Recent Physicians
              </div>
              {filteredPhysicians.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
                  onClick={() => selectPhysician(p)}
                >
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {p.specialty && `${p.specialty} • `}
                    {p.clinic_name && `${p.clinic_name} • `}
                    {p.npi && `NPI: ${p.npi}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Specialty</label>
            <Select value={physicianSpecialty} onValueChange={setPhysicianSpecialty}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select specialty" />
              </SelectTrigger>
              <SelectContent>
                {PHYSICIAN_SPECIALTIES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">NPI</label>
            <Input
              value={physicianNpi}
              onChange={(e) => setPhysicianNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="1234567890"
              className="mt-1"
              maxLength={10}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Phone</label>
            <Input
              value={physicianPhone}
              onChange={(e) => setPhysicianPhone(e.target.value)}
              placeholder="(206) 555-1234"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Fax</label>
            <Input
              value={physicianFax}
              onChange={(e) => setPhysicianFax(e.target.value)}
              placeholder="(206) 555-1235"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Clinic Name</label>
          <Input
            value={physicianClinic}
            onChange={(e) => setPhysicianClinic(e.target.value)}
            placeholder="Seattle Pain Center"
            className="mt-1"
          />
        </div>
      </div>

      {/* Section: Authorization */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
          Authorization
        </h3>

        <div>
          <label className="text-sm font-medium text-gray-700">Insurance/Payer</label>
          <Input
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            placeholder="Blue Cross"
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Authorization Number</label>
          <Input
            value={authorizationNumber}
            onChange={(e) => setAuthorizationNumber(e.target.value)}
            placeholder="AUTH-2025-12345"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Visits Allowed <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 mt-1">
              <Input
                type="number"
                value={visitLimitCount}
                onChange={(e) => setVisitLimitCount(e.target.value)}
                placeholder="12"
                className="w-20"
                min="1"
                disabled={visitLimitType === 'UNLIMITED'}
              />
              <Select value={visitLimitType} onValueChange={(v) => setVisitLimitType(v as 'PER_REFERRAL' | 'PER_YEAR' | 'UNLIMITED')}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIT_LIMIT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Start Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={referralStartDate}
              onChange={(e) => setReferralStartDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">
              End Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={referralExpirationDate}
              onChange={(e) => setReferralExpirationDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Section: Codes */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
          Codes
        </h3>

        {/* ICD-10 Codes */}
        <div className="relative">
          <label className="text-sm font-medium text-gray-700">ICD-10 Diagnosis Codes</label>
          <div className="flex flex-wrap gap-1 mt-1 mb-2">
            {icd10Codes.map((code) => {
              const codeInfo = COMMON_ICD10_CODES.find((c) => c.code === code);
              return (
                <Badge
                  key={code}
                  variant="outline"
                  className="bg-purple-50 text-purple-800 border-purple-200 cursor-pointer hover:bg-purple-100"
                  onClick={() => removeIcd10Code(code)}
                >
                  {code}
                  {codeInfo && <span className="ml-1 text-purple-600 text-xs">({codeInfo.description})</span>}
                  <span className="ml-1">×</span>
                </Badge>
              );
            })}
          </div>
          <Input
            value={icd10Search}
            onChange={(e) => {
              setIcd10Search(e.target.value);
              setShowIcd10Suggestions(true);
            }}
            onFocus={() => setShowIcd10Suggestions(true)}
            onBlur={() => setTimeout(() => setShowIcd10Suggestions(false), 200)}
            placeholder="Search ICD-10 codes (e.g., M54.5, low back)"
            className="mt-1"
          />
          {showIcd10Suggestions && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {icd10Suggestions.map((code) => (
                <button
                  key={code.code}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-purple-50 border-b last:border-b-0 text-sm"
                  onClick={() => addIcd10Code(code)}
                >
                  <span className="font-medium text-purple-700">{code.code}</span>
                  <span className="text-gray-600 ml-2">{code.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CPT Codes */}
        <div className="relative">
          <label className="text-sm font-medium text-gray-700">CPT Procedure Codes</label>
          <div className="flex flex-wrap gap-1 mt-1 mb-2">
            {cptCodes.map((code) => {
              const codeInfo = COMMON_CPT_CODES.find((c) => c.code === code);
              return (
                <Badge
                  key={code}
                  variant="outline"
                  className="bg-blue-50 text-blue-800 border-blue-200 cursor-pointer hover:bg-blue-100"
                  onClick={() => removeCptCode(code)}
                >
                  {code}
                  {codeInfo && <span className="ml-1 text-blue-600 text-xs">({codeInfo.description})</span>}
                  <span className="ml-1">×</span>
                </Badge>
              );
            })}
          </div>
          <Input
            value={cptSearch}
            onChange={(e) => {
              setCptSearch(e.target.value);
              setShowCptSuggestions(true);
            }}
            onFocus={() => setShowCptSuggestions(true)}
            onBlur={() => setTimeout(() => setShowCptSuggestions(false), 200)}
            placeholder="Search CPT codes (e.g., 97140, manual therapy)"
            className="mt-1"
          />
          {showCptSuggestions && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {cptSuggestions.map((code) => (
                <button
                  key={code.code}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 text-sm"
                  onClick={() => addCptCode(code)}
                >
                  <span className="font-medium text-blue-700">{code.code}</span>
                  <span className="text-gray-600 ml-2">{code.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section: Notes */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b pb-2">
          Notes
        </h3>

        <div>
          <label className="text-sm font-medium text-gray-700">Referral Label</label>
          <Input
            value={referralLabel}
            onChange={(e) => setReferralLabel(e.target.value)}
            placeholder="e.g., Dr. Smith - Back Pain"
            className="mt-1"
          />
          <p className="text-xs text-gray-500 mt-1">Optional label for quick identification</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Notes (non-medical)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Renewal pending, called office 12/1..."
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {/* Document reminder */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <p className="flex items-center gap-2">
            <DocumentIcon className="w-4 h-4 flex-shrink-0" />
            Keep referral documents stored securely outside the app. Document upload coming in a future update.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white pb-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !physicianName.trim()}
          className="flex-1"
        >
          {saving ? 'Saving...' : referral ? 'Update Referral' : 'Add Referral'}
        </Button>
      </div>
    </div>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
