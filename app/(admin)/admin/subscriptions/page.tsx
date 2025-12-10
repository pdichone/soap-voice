'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SubscriptionStatsResponse } from '@/app/api/admin/subscriptions/stats/route';
import type { SubscriptionsResponse, SubscriptionListItem } from '@/app/api/admin/subscriptions/route';

function getStatusBadge(status: string | null) {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-500">Active</Badge>;
    case 'trialing':
      return <Badge variant="outline" className="border-blue-500 text-blue-600">Trial</Badge>;
    case 'past_due':
      return <Badge variant="destructive">Past Due</Badge>;
    case 'canceled':
      return <Badge variant="secondary">Canceled</Badge>;
    default:
      return <Badge variant="outline">None</Badge>;
  }
}

function formatDate(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SubscriptionsPage() {
  const [stats, setStats] = useState<SubscriptionStatsResponse | null>(null);
  const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [statusFilter, search, pagination.page]);

  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/subscriptions/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }

  async function fetchSubscriptions() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        search,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      const res = await fetch(`/api/admin/subscriptions?${params}`);
      if (res.ok) {
        const data: SubscriptionsResponse = await res.json();
        setSubscriptions(data.subscriptions);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Subscriptions</h1>
        <p className="text-slate-600 mt-1">Manage subscriber billing and revenue</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500">MRR</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats ? formatCurrency(stats.mrr) : '-'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {stats?.founder_count || 0} founder + {stats?.solo_count || 0} solo
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {stats?.active_count ?? '-'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              paying subscribers
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500">Trialing</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.trialing_count ?? '-'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {stats?.trial_conversion_rate ?? 0}% conversion rate
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-sm font-medium text-slate-500">Churn Rate</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats?.churn_rate ?? 0}%
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {stats?.past_due_count ?? 0} past due
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className="px-3 py-2 border rounded-md bg-white text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trialing">Trialing</option>
          <option value="past_due">Past Due</option>
          <option value="canceled">Canceled</option>
        </select>

        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            type="text"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                  Subscriber
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                  Plan
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                  Next Bill
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="py-4 px-4">
                      <div>
                        <div className="font-medium text-slate-900">{sub.name}</div>
                        <div className="text-sm text-slate-500">{sub.email}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {getStatusBadge(sub.subscription_status)}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm">
                        <div className="font-medium capitalize">{sub.plan_type || '-'}</div>
                        {sub.monthly_price && (
                          <div className="text-slate-500">${sub.monthly_price}/mo</div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-600">
                        {sub.subscription_status === 'trialing' && sub.trial_ends_at ? (
                          <>Trial ends {formatDate(sub.trial_ends_at)}</>
                        ) : sub.subscription_status === 'canceled' ? (
                          <span className="text-slate-400">Canceled</span>
                        ) : (
                          formatDate(sub.current_period_end)
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link href={`/admin/subscriptions/${sub.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-slate-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
