'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { PatientBenefits, PatientNonPhi, PlanYearType } from '@/lib/types-ops';

interface EditBenefitsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientNonPhi;
  benefits: PatientBenefits | null;
  onSave: () => void;
}

export function EditBenefitsModal({
  open,
  onOpenChange,
  patient,
  benefits,
  onSave,
}: EditBenefitsModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [planYearType, setPlanYearType] = useState<PlanYearType>('calendar');
  const [planYearStart, setPlanYearStart] = useState('');
  const [deductibleAmount, setDeductibleAmount] = useState('');
  const [deductiblePaid, setDeductiblePaid] = useState('');
  const [coinsurancePercent, setCoinsurancePercent] = useState('');
  const [oopMax, setOopMax] = useState('');
  const [oopPaid, setOopPaid] = useState('');
  const [allowedAmount, setAllowedAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Reset form when modal opens or benefits change
  useEffect(() => {
    if (open) {
      if (benefits) {
        setPlanYearType(benefits.plan_year_type);
        setPlanYearStart(benefits.plan_year_start || '');
        setDeductibleAmount(benefits.deductible_amount.toString());
        setDeductiblePaid(benefits.deductible_paid.toString());
        setCoinsurancePercent(benefits.coinsurance_percent.toString());
        setOopMax(benefits.oop_max.toString());
        setOopPaid(benefits.oop_paid.toString());
        setAllowedAmount(benefits.allowed_amount.toString());
        setNotes(benefits.notes || '');
      } else {
        // Default values for new benefits
        setPlanYearType('calendar');
        setPlanYearStart('');
        setDeductibleAmount('');
        setDeductiblePaid('0');
        setCoinsurancePercent('');
        setOopMax('');
        setOopPaid('0');
        setAllowedAmount('');
        setNotes('');
      }
      setError('');
    }
  }, [open, benefits]);

  const handleSave = async () => {
    setError('');
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setSaving(false);
      return;
    }

    const benefitsData = {
      patient_id: patient.id,
      owner_user_id: user.id,
      plan_year_type: planYearType,
      plan_year_start: planYearType === 'custom' && planYearStart ? planYearStart : null,
      deductible_amount: parseFloat(deductibleAmount) || 0,
      deductible_paid: parseFloat(deductiblePaid) || 0,
      coinsurance_percent: parseInt(coinsurancePercent) || 0,
      oop_max: parseFloat(oopMax) || 0,
      oop_paid: parseFloat(oopPaid) || 0,
      allowed_amount: parseFloat(allowedAmount) || 0,
      notes: notes.trim() || null,
    };

    let result;
    if (benefits) {
      // Update existing
      result = await supabase
        .from('patient_benefits')
        .update(benefitsData)
        .eq('id', benefits.id);
    } else {
      // Insert new
      result = await supabase
        .from('patient_benefits')
        .insert(benefitsData);
    }

    if (result.error) {
      console.error('Error saving benefits:', result.error);
      setError('Failed to save benefits. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Insurance Benefits</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Plan Year Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Plan Year</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="planYearType"
                  checked={planYearType === 'calendar'}
                  onChange={() => setPlanYearType('calendar')}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Calendar Year (resets Jan 1)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="planYearType"
                  checked={planYearType === 'custom'}
                  onChange={() => setPlanYearType('custom')}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Custom Start Date</span>
              </label>
              {planYearType === 'custom' && (
                <Input
                  type="date"
                  value={planYearStart}
                  onChange={(e) => setPlanYearStart(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
          </div>

          {/* Deductible */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Deductible (Annual)</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  value={deductibleAmount}
                  onChange={(e) => setDeductibleAmount(e.target.value)}
                  placeholder="625.00"
                  className="pl-7"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Deductible Paid</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  value={deductiblePaid}
                  onChange={(e) => setDeductiblePaid(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Coinsurance */}
          <div>
            <label className="text-sm font-medium text-gray-700">Coinsurance</label>
            <div className="relative mt-1">
              <Input
                type="number"
                value={coinsurancePercent}
                onChange={(e) => setCoinsurancePercent(e.target.value)}
                placeholder="10"
                className="pr-8"
                min="0"
                max="100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Patient pays this % after deductible is met</p>
          </div>

          {/* Out-of-Pocket Maximum */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">OOP Max (Annual)</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  value={oopMax}
                  onChange={(e) => setOopMax(e.target.value)}
                  placeholder="1500.00"
                  className="pl-7"
                  step="0.01"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">OOP Paid</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  type="number"
                  value={oopPaid}
                  onChange={(e) => setOopPaid(e.target.value)}
                  placeholder="0.00"
                  className="pl-7"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Allowed Amount */}
          <div>
            <label className="text-sm font-medium text-gray-700">Allowed Amount (per visit)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                type="number"
                value={allowedAmount}
                onChange={(e) => setAllowedAmount(e.target.value)}
                placeholder="88.00"
                className="pl-7"
                step="0.01"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">What insurance approves for massage therapy</p>
          </div>

          <hr className="my-2" />

          {/* Benefit Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700">Benefit Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ded $625 // Coins. 10% // $1,500 OOP PCY&#10;** Patient prefers text reminders **"
              className="mt-1 min-h-[100px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use for your shorthand, reminders, or complex situations
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving...' : 'Save Benefits'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
