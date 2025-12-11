'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, CheckCircle2, X, Loader2, Settings } from 'lucide-react';
import type { OnboardingQuestionnaire } from '@/lib/types-onboarding';
import {
  SPECIALTIES,
  INSURANCE_PORTALS,
  COMMON_PAYERS,
  US_TIMEZONES,
  US_STATES,
  SERVICE_DURATIONS,
  FOCUS_AREAS,
} from '@/lib/onboarding-constants';

interface QuestionnaireResponsesModalProps {
  open: boolean;
  onClose: () => void;
  questionnaire: OnboardingQuestionnaire;
  practitionerName: string;
  practitionerId: string;
  onSettingsApplied?: () => void;
}

// Helper to get label from value
const getLabel = (
  items: readonly { value: string; label: string }[],
  value: string
): string => {
  return items.find(item => item.value === value)?.label || value;
};

const getDurationLabel = (minutes: number): string => {
  const duration = SERVICE_DURATIONS.find(d => d.value === minutes);
  return duration?.label || `${minutes} minutes`;
};

export function QuestionnaireResponsesModal({
  open,
  onClose,
  questionnaire,
  practitionerName,
  practitionerId,
  onSettingsApplied,
}: QuestionnaireResponsesModalProps) {
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const handleApplySettings = async () => {
    setIsApplying(true);
    setApplyError(null);

    try {
      const response = await fetch(`/api/admin/practitioners/${practitionerId}/apply-questionnaire`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to apply settings');
      }

      setApplySuccess(true);
      onSettingsApplied?.();
    } catch (error) {
      console.error('Error applying settings:', error);
      setApplyError(error instanceof Error ? error.message : 'Failed to apply settings');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Questionnaire Responses</DialogTitle>
          <DialogDescription>
            Submitted by {practitionerName}
            {questionnaire.submitted_at && (
              <> on {new Date(questionnaire.submitted_at).toLocaleString()}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Practice Info */}
          <Section title="Practice Information">
            <InfoRow label="Practice Name" value={questionnaire.practice_name} />
            <InfoRow
              label="Practice Type"
              value={
                questionnaire.practice_type === 'cash_only'
                  ? 'Cash-only practice'
                  : questionnaire.practice_type === 'insurance'
                  ? 'Insurance billing'
                  : null
              }
            />
          </Section>

          {/* Address */}
          {questionnaire.address && (
            <Section title="Location">
              <InfoRow label="Street" value={questionnaire.address.street} />
              <div className="grid grid-cols-3 gap-4">
                <InfoRow label="City" value={questionnaire.address.city} />
                <InfoRow
                  label="State"
                  value={
                    questionnaire.address.state
                      ? getLabel(US_STATES, questionnaire.address.state)
                      : null
                  }
                />
                <InfoRow label="ZIP" value={questionnaire.address.zip} />
              </div>
              <InfoRow
                label="Timezone"
                value={
                  questionnaire.timezone
                    ? getLabel(US_TIMEZONES, questionnaire.timezone)
                    : null
                }
              />
            </Section>
          )}

          {/* Specialties */}
          {questionnaire.specialties && questionnaire.specialties.length > 0 && (
            <Section title="Specialties">
              <div className="flex flex-wrap gap-2">
                {questionnaire.specialties.map(specialty => (
                  <Badge key={specialty} variant="secondary">
                    {getLabel(SPECIALTIES, specialty)}
                  </Badge>
                ))}
              </div>
            </Section>
          )}

          {/* Services */}
          {questionnaire.services && questionnaire.services.length > 0 && (
            <Section title="Services">
              <div className="space-y-2">
                {questionnaire.services.map((service, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-muted p-3 rounded-lg"
                  >
                    <div>
                      <span className="font-medium">{service.name}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        ({getDurationLabel(service.duration_minutes)})
                      </span>
                    </div>
                    <span className="font-semibold">
                      {formatPrice(service.price_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Insurance Info */}
          {questionnaire.practice_type === 'insurance' && (
            <>
              {questionnaire.insurance_portals &&
                questionnaire.insurance_portals.length > 0 && (
                  <Section title="Billing Portals">
                    <div className="flex flex-wrap gap-2">
                      {questionnaire.insurance_portals.map(portal => (
                        <Badge key={portal} variant="outline">
                          {getLabel(INSURANCE_PORTALS, portal)}
                        </Badge>
                      ))}
                    </div>
                  </Section>
                )}

              {questionnaire.insurance_payers &&
                questionnaire.insurance_payers.length > 0 && (
                  <Section title="Insurance Payers">
                    <div className="flex flex-wrap gap-2">
                      {questionnaire.insurance_payers.map(payer => (
                        <Badge key={payer} variant="outline">
                          {getLabel(COMMON_PAYERS, payer)}
                        </Badge>
                      ))}
                    </div>
                  </Section>
                )}
            </>
          )}

          {/* Intake Preferences */}
          {questionnaire.intake_preferences && (
            <Section title="Intake Preferences">
              {questionnaire.intake_preferences.focus_areas &&
                questionnaire.intake_preferences.focus_areas.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Focus Areas
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {questionnaire.intake_preferences.focus_areas.map(area => (
                        <Badge key={area} variant="secondary">
                          {getLabel(FOCUS_AREAS, area)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {questionnaire.intake_preferences.custom_questions &&
                questionnaire.intake_preferences.custom_questions.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Custom Questions
                    </p>
                    <ul className="space-y-1">
                      {questionnaire.intake_preferences.custom_questions.map(
                        (question, index) => (
                          <li key={index} className="text-sm bg-muted p-2 rounded">
                            {question}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
            </Section>
          )}

          {/* Client List Upload */}
          {questionnaire.client_list_file_url && (
            <Section title="Client List Upload">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">
                      {questionnaire.client_list_file_name || 'Uploaded file'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(questionnaire.client_list_file_url!, '_blank')
                    }
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {questionnaire.client_list_confirmed ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">
                        Consent confirmed by practitioner
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 text-red-500" />
                      <span className="text-muted-foreground">
                        Consent not confirmed
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Section>
          )}

          {/* Additional Notes */}
          {questionnaire.additional_notes && (
            <Section title="Additional Notes">
              <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                {questionnaire.additional_notes}
              </p>
            </Section>
          )}

          {/* Apply Settings Button */}
          <div className="border-t pt-4 mt-4">
            {applyError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                {applyError}
              </div>
            )}
            {applySuccess ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span>Settings applied successfully! The page will refresh to show updated data.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Apply the questionnaire responses to this practitioner&apos;s account settings.
                  This will update their practice name and practice type.
                </p>
                <Button
                  onClick={handleApplySettings}
                  disabled={isApplying}
                  className="w-full"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Applying Settings...
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4 mr-2" />
                      Apply Settings to Account
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper components
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
