'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QuestionBuilder } from '@/components/intake/QuestionBuilder';
import { DEFAULT_HEALTH_HISTORY_QUESTIONS } from '@/lib/types-intake';
import type { IntakeQuestion } from '@/lib/types-intake';

export default function NewIntakeFormPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  const handleUseTemplate = () => {
    setTitle('Health History Intake');
    setDescription('Please complete this form before your appointment');
    setQuestions(DEFAULT_HEALTH_HISTORY_QUESTIONS);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Please enter a form title');
      return;
    }

    if (questions.length === 0) {
      setError('Please add at least one question');
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated');
      setSaving(false);
      return;
    }

    // If setting as default, first unset all existing defaults
    if (isDefault) {
      await supabase
        .from('intake_forms')
        .update({ is_default: false })
        .eq('owner_user_id', user.id);
    }

    const { error: insertError } = await supabase.from('intake_forms').insert({
      owner_user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      questions,
      is_default: isDefault,
    });

    if (insertError) {
      console.error('Error creating form:', insertError);
      setError('Failed to create form. Please try again.');
      setSaving(false);
      return;
    }

    router.refresh();
    router.push('/intake-forms');
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/intake-forms" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Forms
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">New Intake Form</h1>
        </div>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Quick Start Template */}
      {questions.length === 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-2">Start with a template</h3>
            <p className="text-sm text-gray-600 mb-4">
              Use our pre-built Health History template with common questions for massage therapy
            </p>
            <Button onClick={handleUseTemplate} variant="outline">
              Use Health History Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Form Details */}
      <Card>
        <CardHeader>
          <CardTitle>Form Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Form Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Health History Intake"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Please complete this form before your appointment"
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="isDefault" className="text-sm text-gray-700">
              Set as default form for new clients
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionBuilder questions={questions} onChange={setQuestions} />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex gap-3">
        <Link href="/intake-forms" className="flex-1">
          <Button variant="outline" className="w-full">
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? 'Saving...' : 'Create Form'}
        </Button>
      </div>
    </div>
  );
}
