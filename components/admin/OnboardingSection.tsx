'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
} from 'lucide-react';
import type {
  OnboardingStatus,
  OnboardingChecklist,
  OnboardingQuestionnaire,
  OnboardingUpdateInput,
} from '@/lib/types-onboarding';
import {
  ONBOARDING_STATUS_CONFIG,
  CHECKLIST_ITEMS,
} from '@/lib/onboarding-constants';
import { QuestionnaireResponsesModal } from './QuestionnaireResponsesModal';

interface OnboardingSectionProps {
  practitionerId: string;
  practitionerName: string;
  onboardingStatus: OnboardingStatus;
  onboardingNotes: string | null;
  onboardingStartedAt: string | null;
  onboardingCompletedAt: string | null;
  onboardingChecklist: OnboardingChecklist;
  questionnaire: OnboardingQuestionnaire | null;
  onUpdate: (data: OnboardingUpdateInput) => Promise<void>;
}

export function OnboardingSection({
  practitionerId,
  practitionerName,
  onboardingStatus,
  onboardingNotes,
  onboardingStartedAt,
  onboardingCompletedAt,
  onboardingChecklist,
  questionnaire,
  onUpdate,
}: OnboardingSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [status, setStatus] = useState<OnboardingStatus>(onboardingStatus);
  const [notes, setNotes] = useState(onboardingNotes || '');
  const [checklist, setChecklist] = useState<OnboardingChecklist>(onboardingChecklist);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showResponsesModal, setShowResponsesModal] = useState(false);
  const [currentToken, setCurrentToken] = useState(questionnaire?.token || null);

  const statusConfig = ONBOARDING_STATUS_CONFIG[status];
  const questionnaireUrl = currentToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/onboarding/${currentToken}`
    : null;

  const handleCopyLink = async () => {
    if (!questionnaireUrl) return;
    await navigator.clipboard.writeText(questionnaireUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    try {
      const response = await fetch(`/api/admin/practitioners/${practitionerId}/questionnaire`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate link');
      }

      const data = await response.json();
      setCurrentToken(data.token);

      // Update status to questionnaire_sent
      setStatus('questionnaire_sent');
      setChecklist(prev => ({ ...prev, questionnaire_sent: true }));
    } catch (error) {
      console.error('Error generating link:', error);
      alert('Failed to generate questionnaire link');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleChecklistChange = (key: keyof OnboardingChecklist, checked: boolean) => {
    setChecklist(prev => ({ ...prev, [key]: checked }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updateData: OnboardingUpdateInput = {
        onboarding_status: status,
        onboarding_notes: notes || undefined,
        onboarding_checklist: checklist,
      };

      // Set timestamps based on status changes
      if (status === 'in_progress' && onboardingStatus !== 'in_progress' && !onboardingStartedAt) {
        updateData.onboarding_started_at = new Date().toISOString();
      }
      if (status === 'completed' && onboardingStatus !== 'completed' && !onboardingCompletedAt) {
        updateData.onboarding_completed_at = new Date().toISOString();
      }

      await onUpdate(updateData);
    } catch (error) {
      console.error('Error saving onboarding:', error);
      alert('Failed to save onboarding changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5" />
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                  <div>
                    <CardTitle className="text-lg">Onboarding</CardTitle>
                    <CardDescription>Manual onboarding workflow</CardDescription>
                  </div>
                </div>
                <Badge variant={statusConfig.badgeVariant}>
                  {statusConfig.label}
                </Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(value: OnboardingStatus) => setStatus(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ONBOARDING_STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Questionnaire Link */}
              <div className="space-y-2">
                <Label>Questionnaire Link</Label>
                {questionnaireUrl ? (
                  <div className="flex gap-2">
                    <div className="flex-1 bg-muted p-2 rounded text-sm font-mono truncate">
                      {questionnaireUrl}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyLink}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No questionnaire link generated yet.</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateLink}
                    disabled={isGeneratingLink || (questionnaire?.submitted_at !== null && questionnaire?.submitted_at !== undefined)}
                  >
                    {isGeneratingLink ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {currentToken ? 'Regenerate Link' : 'Generate Link'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResponsesModal(true)}
                    disabled={!questionnaire?.submitted_at}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Responses
                  </Button>
                </div>
                {questionnaire?.submitted_at && (
                  <p className="text-xs text-muted-foreground">
                    Submitted on {new Date(questionnaire.submitted_at).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                <Label>Onboarding Checklist</Label>
                <div className="space-y-2 bg-muted p-3 rounded-lg">
                  {CHECKLIST_ITEMS.map(item => (
                    <div key={item.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={item.key}
                        checked={checklist[item.key as keyof OnboardingChecklist]}
                        onCheckedChange={(checked: boolean) =>
                          handleChecklistChange(item.key as keyof OnboardingChecklist, checked)
                        }
                      />
                      <Label
                        htmlFor={item.key}
                        className={`font-normal cursor-pointer ${
                          checklist[item.key as keyof OnboardingChecklist]
                            ? 'line-through text-muted-foreground'
                            : ''
                        }`}
                      >
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Admin Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Internal notes about this practitioner's onboarding..."
                  rows={3}
                />
              </div>

              {/* Timestamps */}
              {(onboardingStartedAt || onboardingCompletedAt) && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {onboardingStartedAt && (
                    <span>Started: {new Date(onboardingStartedAt).toLocaleDateString()}</span>
                  )}
                  {onboardingCompletedAt && (
                    <span>Completed: {new Date(onboardingCompletedAt).toLocaleDateString()}</span>
                  )}
                </div>
              )}

              {/* Save Button */}
              <Button onClick={handleSave} disabled={isSaving} className="w-full">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Responses Modal */}
      {questionnaire && (
        <QuestionnaireResponsesModal
          open={showResponsesModal}
          onClose={() => setShowResponsesModal(false)}
          questionnaire={questionnaire}
          practitionerName={practitionerName}
          practitionerId={practitionerId}
          onSettingsApplied={() => {
            // Don't auto-refresh - let user manually refresh to see changes
            // This allows time to check console logs
            console.log('Settings applied - refresh page to see changes');
          }}
        />
      )}
    </>
  );
}
