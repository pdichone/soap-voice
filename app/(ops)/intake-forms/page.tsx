'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { usePracticeConfig } from '@/lib/practice-config';
import type { IntakeForm } from '@/lib/types-intake';

export default function IntakeFormsPage() {
  const router = useRouter();
  const { practiceType } = usePracticeConfig();
  const isCashOnly = practiceType === 'cash_only';
  const clientLabel = isCashOnly ? 'client' : 'patient';

  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForms();
  }, []);

  const loadForms = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) {
      setForms(data);
    }
    setLoading(false);
  };

  const handleDelete = async (formId: string) => {
    if (!confirm('Are you sure you want to delete this intake form? This will not affect already submitted responses.')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('intake_forms')
      .update({ is_active: false })
      .eq('id', formId);

    if (error) {
      console.error('Error deleting form:', error);
    } else {
      loadForms();
      router.refresh();
    }
  };

  const handleSetDefault = async (formId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // First, unset all defaults
    await supabase
      .from('intake_forms')
      .update({ is_default: false })
      .eq('owner_user_id', user.id);

    // Then set the selected one as default
    await supabase
      .from('intake_forms')
      .update({ is_default: true })
      .eq('id', formId);

    loadForms();
    router.refresh();
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Intake Forms</h1>
          <p className="text-gray-500 text-sm">Create forms for {clientLabel}s to fill out</p>
        </div>
        <Link href="/intake-forms/new">
          <Button>
            <PlusIcon className="w-4 h-4 mr-2" />
            New Form
          </Button>
        </Link>
      </header>

      {loading ? (
        <LoadingSpinner text="Loading forms..." />
      ) : forms.length > 0 ? (
        <div className="space-y-3">
          {forms.map((form) => (
            <Card key={form.id} className="hover:border-gray-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900">{form.title}</h3>
                      {form.is_default && (
                        <Badge className="bg-primary/10 text-primary text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    {form.description && (
                      <p className="text-sm text-gray-500 mt-1">{form.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {form.questions.length} questions
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/intake-forms/${form.id}/edit`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                    {!form.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(form.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(form.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FormIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No intake forms yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Create a form for {clientLabel}s to fill out before their appointment
            </p>
            <Link href="/intake-forms/new">
              <Button>Create Your First Form</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
        <CardContent className="p-4">
          <h3 className="font-medium text-gray-900 mb-2">How it works</h3>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
            <li>Create an intake form with your custom questions</li>
            <li>Go to a {clientLabel}&apos;s profile and click &quot;Send Intake Form&quot;</li>
            <li>Copy the link and share it with your {clientLabel} via text or email</li>
            <li>View their responses in their profile once they submit</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function FormIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
    </svg>
  );
}
