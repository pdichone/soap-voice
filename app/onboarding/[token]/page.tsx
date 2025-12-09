'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, Trash2, Upload, CheckCircle2, X, FileText } from 'lucide-react';
import type {
  OnboardingQuestionnaire,
  OnboardingQuestionnaireFormData,
  ServiceConfig,
  QuestionnaireApiResponse,
} from '@/lib/types-onboarding';
import {
  SPECIALTIES,
  INSURANCE_PORTALS,
  COMMON_PAYERS,
  US_TIMEZONES,
  US_STATES,
  SERVICE_DURATIONS,
  FOCUS_AREAS,
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_MB,
} from '@/lib/onboarding-constants';

type PageState = 'loading' | 'form' | 'submitted' | 'already_submitted' | 'not_found' | 'error';

export default function OnboardingQuestionnairePage() {
  const params = useParams();
  const token = params?.token as string;

  const [pageState, setPageState] = useState<PageState>('loading');
  const [practitionerName, setPractitionerName] = useState('');
  const [questionnaire, setQuestionnaire] = useState<OnboardingQuestionnaire | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<OnboardingQuestionnaireFormData>({
    practice_name: '',
    practice_type: null,
    specialties: [],
    services: [{ name: '', duration_minutes: 60, price_cents: 0 }],
    insurance_portals: [],
    insurance_payers: [],
    intake_preferences: { focus_areas: [], custom_questions: [] },
    address: { street: '', city: '', state: '', zip: '' },
    timezone: '',
    additional_notes: '',
    client_list_file_url: null,
    client_list_file_name: null,
    client_list_confirmed: false,
  });

  // Custom question input
  const [newCustomQuestion, setNewCustomQuestion] = useState('');

  // Fetch questionnaire data
  useEffect(() => {
    const fetchQuestionnaire = async () => {
      try {
        const response = await fetch(`/api/onboarding/${token}`);

        if (response.status === 404) {
          setPageState('not_found');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch questionnaire');
        }

        const data: QuestionnaireApiResponse = await response.json();

        if (data.already_submitted) {
          setPageState('already_submitted');
          setPractitionerName(data.practitioner_name);
          return;
        }

        setQuestionnaire(data.questionnaire);
        setPractitionerName(data.practitioner_name);
        setPageState('form');

        // Pre-fill any existing data
        if (data.questionnaire.practice_name) {
          setFormData(prev => ({
            ...prev,
            practice_name: data.questionnaire.practice_name || '',
            practice_type: data.questionnaire.practice_type,
            specialties: data.questionnaire.specialties || [],
            services: data.questionnaire.services?.length
              ? data.questionnaire.services
              : [{ name: '', duration_minutes: 60, price_cents: 0 }],
            insurance_portals: data.questionnaire.insurance_portals || [],
            insurance_payers: data.questionnaire.insurance_payers || [],
            intake_preferences: data.questionnaire.intake_preferences || {
              focus_areas: [],
              custom_questions: [],
            },
            address: data.questionnaire.address || { street: '', city: '', state: '', zip: '' },
            timezone: data.questionnaire.timezone || '',
            additional_notes: data.questionnaire.additional_notes || '',
            client_list_file_url: data.questionnaire.client_list_file_url,
            client_list_file_name: data.questionnaire.client_list_file_name,
            client_list_confirmed: data.questionnaire.client_list_confirmed,
          }));
        }
      } catch (err) {
        console.error('Error fetching questionnaire:', err);
        setPageState('error');
      }
    };

    if (token) {
      fetchQuestionnaire();
    }
  }, [token]);

  // Handle checkbox arrays
  const handleCheckboxArray = (
    field: 'specialties' | 'insurance_portals' | 'insurance_payers',
    value: string,
    checked: boolean
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked
        ? [...prev[field], value]
        : prev[field].filter(v => v !== value),
    }));
  };

  // Handle focus areas
  const handleFocusArea = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      intake_preferences: {
        ...prev.intake_preferences,
        focus_areas: checked
          ? [...prev.intake_preferences.focus_areas, value]
          : prev.intake_preferences.focus_areas.filter(v => v !== value),
      },
    }));
  };

  // Add custom question
  const addCustomQuestion = () => {
    if (newCustomQuestion.trim()) {
      setFormData(prev => ({
        ...prev,
        intake_preferences: {
          ...prev.intake_preferences,
          custom_questions: [
            ...prev.intake_preferences.custom_questions,
            newCustomQuestion.trim(),
          ],
        },
      }));
      setNewCustomQuestion('');
    }
  };

  // Remove custom question
  const removeCustomQuestion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      intake_preferences: {
        ...prev.intake_preferences,
        custom_questions: prev.intake_preferences.custom_questions.filter(
          (_, i) => i !== index
        ),
      },
    }));
  };

  // Service handlers
  const addService = () => {
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, { name: '', duration_minutes: 60, price_cents: 0 }],
    }));
  };

  const removeService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  };

  const updateService = (index: number, field: keyof ServiceConfig, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.map((service, i) =>
        i === index ? { ...service, [field]: value } : service
      ),
    }));
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !questionnaire) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setUploadingFile(true);
    setError(null);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('practitioner_id', questionnaire.practitioner_id);

      const response = await fetch('/api/onboarding/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      setFormData(prev => ({
        ...prev,
        client_list_file_url: result.url,
        client_list_file_name: result.filename,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  // Remove uploaded file
  const removeFile = () => {
    setFormData(prev => ({
      ...prev,
      client_list_file_url: null,
      client_list_file_name: null,
      client_list_confirmed: false,
    }));
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate required fields
    if (!formData.practice_name.trim()) {
      setError('Practice name is required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.practice_type) {
      setError('Practice type is required');
      setIsSubmitting(false);
      return;
    }

    // If file uploaded, consent must be checked
    if (formData.client_list_file_url && !formData.client_list_confirmed) {
      setError('Please confirm consent for client list upload');
      setIsSubmitting(false);
      return;
    }

    // Filter out empty services
    const validServices = formData.services.filter(s => s.name.trim());

    try {
      const response = await fetch(`/api/onboarding/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          services: validServices,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Submission failed');
      }

      setPageState('submitted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render based on state
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading questionnaire...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Not Found</CardTitle>
            <CardDescription>
              This questionnaire link is invalid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>
              Something went wrong. Please try again later or contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (pageState === 'already_submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <CardTitle>Already Submitted</CardTitle>
            <CardDescription>
              This questionnaire has already been completed. We&apos;ll be in touch soon!
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (pageState === 'submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Thank you!</CardTitle>
            <CardDescription className="text-base mt-2">
              We&apos;ve received your information and will have your ZenLeef practice ready within 24-48 hours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">What&apos;s next:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  We&apos;ll set up your practice based on your preferences
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  You&apos;ll receive a login link when everything is ready
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  Reply to that email if you have any questions
                </li>
              </ul>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Questions? Email{' '}
              <a href="mailto:paulo@zenleef.com" className="text-primary hover:underline">
                paulo@zenleef.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to ZenLeef</h1>
          <p className="text-muted-foreground mt-2">
            Hi {practitionerName}! Please tell us about your practice so we can set everything up for you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Practice Info */}
          <Card>
            <CardHeader>
              <CardTitle>Practice Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="practice_name">Practice Name *</Label>
                <Input
                  id="practice_name"
                  value={formData.practice_name}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, practice_name: e.target.value }))
                  }
                  placeholder="Your Practice Name"
                />
              </div>

              <div>
                <Label>Practice Type *</Label>
                <RadioGroup
                  value={formData.practice_type || ''}
                  onValueChange={(value: 'cash_only' | 'insurance') =>
                    setFormData(prev => ({ ...prev, practice_type: value }))
                  }
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cash_only" id="cash_only" />
                    <Label htmlFor="cash_only" className="font-normal cursor-pointer">
                      Cash-only practice
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="insurance" id="insurance" />
                    <Label htmlFor="insurance" className="font-normal cursor-pointer">
                      Accept insurance billing
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Specialties */}
          <Card>
            <CardHeader>
              <CardTitle>Specialties</CardTitle>
              <CardDescription>Select all that apply</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {SPECIALTIES.map(specialty => (
                  <div key={specialty.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={specialty.value}
                      checked={formData.specialties.includes(specialty.value)}
                      onCheckedChange={(checked: boolean) =>
                        handleCheckboxArray('specialties', specialty.value, checked)
                      }
                    />
                    <Label htmlFor={specialty.value} className="font-normal cursor-pointer">
                      {specialty.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>Add your service offerings with pricing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.services.map((service, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder="Service name"
                      value={service.name}
                      onChange={e => updateService(index, 'name', e.target.value)}
                    />
                  </div>
                  <div className="w-32">
                    <Select
                      value={String(service.duration_minutes)}
                      onValueChange={value =>
                        updateService(index, 'duration_minutes', parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_DURATIONS.map(d => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        className="pl-6"
                        placeholder="0"
                        value={service.price_cents ? service.price_cents / 100 : ''}
                        onChange={e =>
                          updateService(
                            index,
                            'price_cents',
                            Math.round(parseFloat(e.target.value || '0') * 100)
                          )
                        }
                      />
                    </div>
                  </div>
                  {formData.services.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeService(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addService}>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </CardContent>
          </Card>

          {/* Insurance Section - Only show if insurance practice */}
          {formData.practice_type === 'insurance' && (
            <Card>
              <CardHeader>
                <CardTitle>Insurance Information</CardTitle>
                <CardDescription>Select the portals and payers you work with</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Billing Portals</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {INSURANCE_PORTALS.map(portal => (
                      <div key={portal.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={portal.value}
                          checked={formData.insurance_portals.includes(portal.value)}
                          onCheckedChange={(checked: boolean) =>
                            handleCheckboxArray('insurance_portals', portal.value, checked)
                          }
                        />
                        <Label htmlFor={portal.value} className="font-normal cursor-pointer">
                          {portal.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-base font-medium">Insurance Payers</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {COMMON_PAYERS.map(payer => (
                      <div key={payer.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={payer.value}
                          checked={formData.insurance_payers.includes(payer.value)}
                          onCheckedChange={(checked: boolean) =>
                            handleCheckboxArray('insurance_payers', payer.value, checked)
                          }
                        />
                        <Label htmlFor={payer.value} className="font-normal cursor-pointer">
                          {payer.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Practice Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={formData.address.street}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      address: { ...prev.address, street: e.target.value },
                    }))
                  }
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.address.city}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, city: e.target.value },
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={formData.address.state}
                    onValueChange={value =>
                      setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, state: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map(state => (
                        <SelectItem key={state.value} value={state.value}>
                          {state.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.address.zip}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        address: { ...prev.address, zip: e.target.value },
                      }))
                    }
                    placeholder="12345"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={value =>
                      setFormData(prev => ({ ...prev, timezone: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intake Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Intake Form Preferences</CardTitle>
              <CardDescription>
                Customize what information you collect from new clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-medium">Focus Areas</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  What conditions do you commonly treat?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {FOCUS_AREAS.map(area => (
                    <div key={area.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={area.value}
                        checked={formData.intake_preferences.focus_areas.includes(area.value)}
                        onCheckedChange={(checked: boolean) =>
                          handleFocusArea(area.value, checked)
                        }
                      />
                      <Label htmlFor={area.value} className="font-normal cursor-pointer">
                        {area.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-base font-medium">Custom Questions</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Add any additional questions for your intake form
                </p>
                <div className="space-y-2">
                  {formData.intake_preferences.custom_questions.map((question, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-muted p-2 rounded"
                    >
                      <span className="flex-1 text-sm">{question}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomQuestion(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter a custom question"
                      value={newCustomQuestion}
                      onChange={e => setNewCustomQuestion(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomQuestion();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addCustomQuestion}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Client List Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Existing Clients (Optional)</CardTitle>
              <CardDescription>
                Have a client list? Upload it and we&apos;ll import them for you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <p className="font-medium">What we keep:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    First name + last initial (e.g., &quot;John D.&quot;)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Email and phone number
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Insurance company name (e.g., &quot;Aetna&quot;)
                  </li>
                </ul>
                <p className="font-medium mt-4">What we discard:</p>
                <ul className="text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <X className="h-4 w-4 text-red-500" />
                    Member IDs, policy numbers, SSN, DOB
                  </li>
                  <li className="flex items-center gap-2">
                    <X className="h-4 w-4 text-red-500" />
                    Medical history, diagnoses, treatment notes
                  </li>
                </ul>
              </div>

              {formData.client_list_file_url ? (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {formData.client_list_file_name}
                      </span>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={removeFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-start space-x-2">
                    <Checkbox
                      id="consent"
                      checked={formData.client_list_confirmed}
                      onCheckedChange={(checked: boolean) =>
                        setFormData(prev => ({ ...prev, client_list_confirmed: checked }))
                      }
                    />
                    <Label htmlFor="consent" className="text-sm font-normal cursor-pointer">
                      I confirm this is my client data and I have the right to share it for
                      import purposes.
                    </Label>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept={ALLOWED_FILE_EXTENSIONS.join(',')}
                    onChange={handleFileUpload}
                    disabled={uploadingFile}
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    {uploadingFile ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                    <span className="mt-2 text-sm text-muted-foreground">
                      {uploadingFile
                        ? 'Uploading...'
                        : 'Drop file here or click to upload'}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      CSV, Excel, PDF, or image of handwritten list
                    </span>
                  </label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>
                Anything else we should know about your practice?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.additional_notes}
                onChange={e =>
                  setFormData(prev => ({ ...prev, additional_notes: e.target.value }))
                }
                placeholder="Special requirements, questions, or additional information..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Questionnaire'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
