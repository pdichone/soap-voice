'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { QuestionBuilder } from '@/components/intake/QuestionBuilder';
import type { IntakeForm, IntakeQuestion } from '@/lib/types-intake';

export default function EditIntakeFormPage() {
  const router = useRouter();
  const params = useParams();
  const formId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<IntakeForm | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<IntakeQuestion[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('id', formId)
      .eq('owner_user_id', user.id)
      .single();

    if (error || !data) {
      console.error('Error loading form:', error);
      router.push('/intake-forms');
      return;
    }

    setForm(data);
    setTitle(data.title);
    setDescription(data.description || '');
    setQuestions(data.questions || []);
    setIsDefault(data.is_default);
    setLoading(false);
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
    if (isDefault && !form?.is_default) {
      await supabase
        .from('intake_forms')
        .update({ is_default: false })
        .eq('owner_user_id', user.id);
    }

    const { error: updateError } = await supabase
      .from('intake_forms')
      .update({
        title: title.trim(),
        description: description.trim() || null,
        questions,
        is_default: isDefault,
      })
      .eq('id', formId);

    if (updateError) {
      console.error('Error updating form:', updateError);
      setError('Failed to update form. Please try again.');
      setSaving(false);
      return;
    }

    router.refresh();
    router.push('/intake-forms');
  };

  if (loading) {
    return (
      <div className="p-4">
        <LoadingSpinner text="Loading form..." />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/intake-forms" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; Back to Forms
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Edit Intake Form</h1>
        </div>
      </header>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm">
          {error}
        </div>
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
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
