'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Portal, PortalWithClaimCount } from '@/lib/types-ops';

export default function PortalsPage() {
  const [portals, setPortals] = useState<PortalWithClaimCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Default portals to seed if none exist
  const DEFAULT_PORTALS = [
    { name: 'Office Ally', url: 'https://www.officeally.com', sort_order: 1 },
    { name: 'Availity', url: 'https://www.availity.com', sort_order: 2 },
    { name: 'One Health Port', url: 'https://www.onehealthport.com', sort_order: 3 },
    { name: 'Premera', url: 'https://www.premera.com/provider', sort_order: 4 },
    { name: 'Regence', url: 'https://www.regence.com/provider', sort_order: 5 },
    { name: 'Aetna', url: 'https://www.aetna.com/providers', sort_order: 6 },
    { name: 'UnitedHealthcare', url: 'https://www.uhcprovider.com', sort_order: 7 },
    { name: 'Cigna', url: 'https://www.cigna.com/providers', sort_order: 8 },
    { name: 'Molina', url: 'https://www.molinahealthcare.com/providers', sort_order: 9 },
    { name: 'Blue Cross', url: 'https://www.bluecross.com', sort_order: 10 },
  ];

  const loadPortals = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's practice_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_id')
      .eq('id', user.id)
      .single();

    if (!profile?.practice_id) {
      setLoading(false);
      return;
    }

    // Get all portals
    const portalsResult = await supabase
      .from('portals')
      .select('*')
      .eq('practice_id', profile.practice_id)
      .order('sort_order', { ascending: true });
    let portalsData = portalsResult.data;
    const portalsError = portalsResult.error;

    // If no portals exist, seed defaults
    if ((!portalsData || portalsData.length === 0) && !portalsError) {
      console.log('No portals found, seeding defaults for practice:', profile.practice_id);
      const defaultPortalsWithPractice = DEFAULT_PORTALS.map(p => ({
        ...p,
        practice_id: profile.practice_id,
        is_active: true,
      }));

      const { error: seedError } = await supabase
        .from('portals')
        .insert(defaultPortalsWithPractice);

      if (seedError) {
        console.error('Error seeding default portals:', seedError);
      } else {
        // Re-fetch portals after seeding
        const { data: refreshedPortals } = await supabase
          .from('portals')
          .select('*')
          .eq('practice_id', profile.practice_id)
          .order('sort_order', { ascending: true });
        portalsData = refreshedPortals;
      }
    }

    if (portalsData) {
      // Get claim counts for each portal
      const portalsWithCounts = await Promise.all(
        portalsData.map(async (portal) => {
          const { count } = await supabase
            .from('claims_non_phi')
            .select('*', { count: 'exact', head: true })
            .eq('owner_user_id', user.id)
            .eq('portal_name', portal.name);

          return {
            ...portal,
            claim_count: count || 0,
          };
        })
      );
      setPortals(portalsWithCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPortals();
  }, [loadPortals]);

  const openAddModal = () => {
    setEditingPortal(null);
    setFormName('');
    setFormUrl('');
    setFormNotes('');
    setShowModal(true);
  };

  const openEditModal = (portal: Portal) => {
    setEditingPortal(portal);
    setFormName(portal.name);
    setFormUrl(portal.url || '');
    setFormNotes(portal.notes || '');
    setShowModal(true);
  };

  const handleSavePortal = async () => {
    if (!formName.trim()) {
      setMessage({ type: 'error', text: 'Portal name is required' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's practice_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_id')
      .eq('id', user.id)
      .single();

    if (!profile?.practice_id) {
      console.error('No practice_id found for user:', user.id);
      setMessage({ type: 'error', text: 'No practice associated with your account. Please contact support.' });
      setSaving(false);
      return;
    }

    console.log('Creating portal for practice:', profile.practice_id);

    const portalData = {
      name: formName.trim(),
      url: formUrl.trim() || null,
      notes: formNotes.trim() || null,
    };

    if (editingPortal) {
      // Update existing portal
      const { error } = await supabase
        .from('portals')
        .update({ ...portalData, updated_at: new Date().toISOString() })
        .eq('id', editingPortal.id)
        .eq('practice_id', profile.practice_id);

      if (error) {
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'A portal with this name already exists' });
        } else {
          setMessage({ type: 'error', text: 'Failed to update portal' });
        }
      } else {
        setMessage({ type: 'success', text: 'Portal updated' });
        setShowModal(false);
        await loadPortals();
      }
    } else {
      // Create new portal
      // Get max sort_order
      const maxSortOrder = portals.length > 0
        ? Math.max(...portals.map(p => p.sort_order)) + 1
        : 0;

      const { error } = await supabase
        .from('portals')
        .insert({
          ...portalData,
          practice_id: profile.practice_id,
          sort_order: maxSortOrder,
          is_active: true,
        });

      if (error) {
        console.error('Portal creation error:', error);
        if (error.code === '23505') {
          setMessage({ type: 'error', text: 'A portal with this name already exists' });
        } else if (error.code === '42501') {
          setMessage({ type: 'error', text: 'Permission denied. Check if you have access to this practice.' });
        } else {
          setMessage({ type: 'error', text: `Failed to create portal: ${error.message || error.code}` });
        }
      } else {
        setMessage({ type: 'success', text: 'Portal added' });
        setShowModal(false);
        await loadPortals();
      }
    }

    setSaving(false);
  };

  const handleToggleActive = async (portal: Portal) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's practice_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_id')
      .eq('id', user.id)
      .single();

    if (!profile?.practice_id) return;

    const { error } = await supabase
      .from('portals')
      .update({ is_active: !portal.is_active, updated_at: new Date().toISOString() })
      .eq('id', portal.id)
      .eq('practice_id', profile.practice_id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to update portal' });
    } else {
      await loadPortals();
    }
  };

  const handleDeletePortal = async (portal: Portal) => {
    if (!confirm(`Delete "${portal.name}"? This cannot be undone.`)) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's practice_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_id')
      .eq('id', user.id)
      .single();

    if (!profile?.practice_id) return;

    const { error } = await supabase
      .from('portals')
      .delete()
      .eq('id', portal.id)
      .eq('practice_id', profile.practice_id);

    if (error) {
      setMessage({ type: 'error', text: 'Failed to delete portal' });
    } else {
      setMessage({ type: 'success', text: 'Portal deleted' });
      await loadPortals();
    }
  };

  const movePortal = async (portal: Portal, direction: 'up' | 'down') => {
    const currentIndex = portals.findIndex(p => p.id === portal.id);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= portals.length) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get user's practice_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_id')
      .eq('id', user.id)
      .single();

    if (!profile?.practice_id) return;

    // Swap sort_order values
    const currentPortal = portals[currentIndex];
    const targetPortal = portals[targetIndex];

    await Promise.all([
      supabase
        .from('portals')
        .update({ sort_order: targetPortal.sort_order, updated_at: new Date().toISOString() })
        .eq('id', currentPortal.id)
        .eq('practice_id', profile.practice_id),
      supabase
        .from('portals')
        .update({ sort_order: currentPortal.sort_order, updated_at: new Date().toISOString() })
        .eq('id', targetPortal.id)
        .eq('practice_id', profile.practice_id),
    ]);

    await loadPortals();
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-gray-500 animate-pulse">Loading portals...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Settings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Portals</h1>
          <p className="text-gray-500 text-sm">Manage where you submit claims</p>
        </div>
        <Button onClick={openAddModal}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Add Portal
        </Button>
      </header>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Portals</CardTitle>
          <CardDescription>
            These portals appear in the dropdown when creating claims
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <PortalIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No portals configured yet</p>
              <p className="text-sm">Add portals to track where you submit claims</p>
            </div>
          ) : (
            <div className="space-y-2">
              {portals.map((portal, index) => (
                <div
                  key={portal.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    portal.is_active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => movePortal(portal, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUpIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => movePortal(portal, 'down')}
                      disabled={index === portals.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDownIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Portal info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${portal.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                        {portal.name}
                      </p>
                      {!portal.is_active && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                          Hidden
                        </span>
                      )}
                    </div>
                    {portal.url && (
                      <a
                        href={portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline truncate block"
                      >
                        {portal.url}
                      </a>
                    )}
                    {portal.notes && (
                      <p className="text-xs text-gray-500 truncate">{portal.notes}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {portal.claim_count} claim{portal.claim_count !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(portal)}
                      className={`p-2 rounded-md ${
                        portal.is_active
                          ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                          : 'text-green-500 hover:text-green-600 hover:bg-green-50'
                      }`}
                      title={portal.is_active ? 'Hide portal' : 'Show portal'}
                    >
                      {portal.is_active ? <EyeIcon className="w-5 h-5" /> : <EyeOffIcon className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => openEditModal(portal)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
                      title="Edit portal"
                    >
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeletePortal(portal)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete portal"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingPortal ? 'Edit Portal' : 'Add Portal'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Portal Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Office Ally, Availity"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Portal URL (optional)
                </label>
                <Input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://www.example.com"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <Input
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Login hints, username, etc."
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1"
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePortal}
                className="flex-1"
                disabled={saving || !formName.trim()}
              >
                {saving ? 'Saving...' : editingPortal ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

function PortalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}
