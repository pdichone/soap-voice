'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { usePracticeConfig } from '@/lib/practice-config';
import type { DocumentTemplate, DocumentType } from '@/lib/types-ops';

const DOCUMENT_TYPES: { value: DocumentType; label: string; description: string }[] = [
  { value: 'INTAKE', label: 'Intake Form', description: 'Health history and contact information' },
  { value: 'CONSENT', label: 'Consent Form', description: 'Informed consent for treatment' },
  { value: 'HIPAA', label: 'HIPAA Notice', description: 'Privacy practices acknowledgment' },
  { value: 'POLICY', label: 'Office Policy', description: 'Cancellation, payment policies' },
  { value: 'OTHER', label: 'Other', description: 'Custom document' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const { practiceType } = usePracticeConfig();
  const isCashOnly = practiceType === 'cash_only';
  const clientLabel = isCashOnly ? 'Client' : 'Patient';

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('CONSENT');
  const [content, setContent] = useState('');
  const [isRequired, setIsRequired] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .eq('owner_user_id', user.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (data) {
      setTemplates(data);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setTitle('');
    setDocumentType('CONSENT');
    setContent('');
    setIsRequired(false);
    setEditingTemplate(null);
  };

  const handleOpenDialog = (template?: DocumentTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTitle(template.title);
      setDocumentType(template.document_type);
      setContent(template.content);
      setIsRequired(template.is_required);
    } else {
      resetForm();
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingTemplate) {
      // Update existing
      const { error } = await supabase
        .from('document_templates')
        .update({
          title: title.trim(),
          document_type: documentType,
          content: content.trim(),
          is_required: isRequired,
        })
        .eq('id', editingTemplate.id);

      if (error) {
        console.error('Error updating template:', error);
      }
    } else {
      // Create new
      const { error } = await supabase.from('document_templates').insert({
        owner_user_id: user.id,
        title: title.trim(),
        document_type: documentType,
        content: content.trim(),
        is_required: isRequired,
        sort_order: templates.length,
      });

      if (error) {
        console.error('Error creating template:', error);
      }
    }

    setShowDialog(false);
    resetForm();
    loadTemplates();
    router.refresh();
    setSaving(false);
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This will also remove all client signatures for this document.')) {
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('document_templates')
      .update({ is_active: false })
      .eq('id', templateId);

    if (error) {
      console.error('Error deleting template:', error);
    } else {
      loadTemplates();
      router.refresh();
    }
  };

  const getTypeColor = (type: DocumentType) => {
    switch (type) {
      case 'INTAKE': return 'bg-blue-100 text-blue-800';
      case 'CONSENT': return 'bg-green-100 text-green-800';
      case 'HIPAA': return 'bg-purple-100 text-purple-800';
      case 'POLICY': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 text-sm">{clientLabel} intake forms & consent docs</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>Add Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Document Template' : 'New Document Template'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Title *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Informed Consent for Massage"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Document Type</label>
                <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Content *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter the document content here..."
                  className="mt-1 w-full min-h-[200px] px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use <code className="bg-gray-100 px-1 rounded">{'{{client_name}}'}</code> to insert the client&apos;s name and <code className="bg-gray-100 px-1 rounded">{'{{date}}'}</code> for the current date.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="required"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="required" className="text-sm text-gray-700">
                  Required for new {clientLabel.toLowerCase()}s
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !title.trim() || !content.trim()}
                  className="flex-1"
                >
                  {saving ? 'Saving...' : editingTemplate ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      {/* Templates List */}
      {loading ? (
        <LoadingSpinner text="Loading templates..." />
      ) : templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover:border-gray-300 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900">{template.title}</h3>
                      <Badge className={`text-xs ${getTypeColor(template.document_type)}`}>
                        {DOCUMENT_TYPES.find(t => t.value === template.document_type)?.label}
                      </Badge>
                      {template.is_required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {template.content.substring(0, 150)}...
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(template)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
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
            <DocumentIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No document templates yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Create intake forms, consent documents, and policies for your {clientLabel.toLowerCase()}s
            </p>
            <Button onClick={() => handleOpenDialog()}>Create Your First Template</Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Start Templates */}
      {templates.length === 0 && !loading && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-4">
            <h3 className="font-medium text-gray-900 mb-2">Quick Start Templates</h3>
            <p className="text-sm text-gray-600 mb-4">
              Get started quickly with these common document templates:
            </p>
            <div className="grid gap-2">
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => {
                  setTitle('Informed Consent for Massage Therapy');
                  setDocumentType('CONSENT');
                  setContent(`I, {{client_name}}, hereby consent to receive massage therapy.

I understand that massage therapy is intended to promote relaxation, reduce muscle tension, and improve circulation. I understand that massage therapy is not a substitute for medical treatment.

I have informed the therapist of all known physical conditions and medications, and I will update the therapist of any changes.

I understand that I may stop the session at any time if I experience discomfort.

Date: {{date}}`);
                  setIsRequired(true);
                  setShowDialog(true);
                }}
              >
                <div className="text-left">
                  <p className="font-medium">Informed Consent</p>
                  <p className="text-xs text-gray-500">Basic consent for massage therapy</p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => {
                  setTitle('Cancellation & Payment Policy');
                  setDocumentType('POLICY');
                  setContent(`CANCELLATION POLICY

We require 24 hours notice for appointment cancellations or rescheduling. Cancellations made with less than 24 hours notice will be charged 50% of the scheduled service fee.

No-shows will be charged the full service fee.

PAYMENT POLICY

Payment is due at the time of service. We accept cash, credit cards, and HSA/FSA cards.

I, {{client_name}}, acknowledge that I have read and understand these policies.

Date: {{date}}`);
                  setIsRequired(true);
                  setShowDialog(true);
                }}
              >
                <div className="text-left">
                  <p className="font-medium">Cancellation & Payment Policy</p>
                  <p className="text-xs text-gray-500">Office policies and procedures</p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="justify-start h-auto py-3 px-4"
                onClick={() => {
                  setTitle('Health History Intake');
                  setDocumentType('INTAKE');
                  setContent(`HEALTH HISTORY QUESTIONNAIRE

Client Name: {{client_name}}

Please answer the following questions to help us provide the best care for you.

Do you have any of the following conditions?
- Heart disease or high blood pressure
- Diabetes
- Skin conditions
- Recent injuries or surgeries
- Pregnancy
- Allergies

Are you currently taking any medications?

What areas of your body would you like us to focus on?

What is your preferred pressure level?
- Light
- Medium
- Firm
- Deep

I, {{client_name}}, confirm that the information provided is accurate to the best of my knowledge.

Date: {{date}}`);
                  setIsRequired(true);
                  setShowDialog(true);
                }}
              >
                <div className="text-left">
                  <p className="font-medium">Health History Intake</p>
                  <p className="text-xs text-gray-500">Client health questionnaire</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
