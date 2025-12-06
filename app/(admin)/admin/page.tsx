import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getAdminDashboardStats } from '@/lib/db/admin-queries';

export default async function AdminDashboardPage() {
  let stats;
  try {
    stats = await getAdminDashboardStats();
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    stats = {
      totalPractitioners: 0,
      activePractitioners: 0,
      trialPractitioners: 0,
      payingPractitioners: 0,
      recentSignups: 0,
      activeThisWeek: 0,
    };
  }

  const statCards = [
    {
      title: 'Total Practitioners',
      value: stats.totalPractitioners,
      description: 'All registered LMTs',
      color: 'bg-blue-500',
    },
    {
      title: 'Active',
      value: stats.activePractitioners,
      description: 'Currently active accounts',
      color: 'bg-green-500',
    },
    {
      title: 'On Trial',
      value: stats.trialPractitioners,
      description: 'Trial period users',
      color: 'bg-yellow-500',
    },
    {
      title: 'Paying',
      value: stats.payingPractitioners,
      description: 'Subscribed users',
      color: 'bg-purple-500',
    },
    {
      title: 'New This Week',
      value: stats.recentSignups,
      description: 'Recent signups',
      color: 'bg-indigo-500',
    },
    {
      title: 'Active This Week',
      value: stats.activeThisWeek,
      description: 'Users with recent activity',
      color: 'bg-teal-500',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Manage practitioners and monitor platform activity
          </p>
        </div>
        <Link href="/admin/practitioners">
          <Button>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Practitioner
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${stat.color}`} />
                {stat.title}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-sm text-slate-500 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/practitioners" className="block">
              <Button variant="outline" className="w-full justify-start">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Manage Practitioners
              </Button>
            </Link>
            <Link href="/admin/events" className="block">
              <Button variant="outline" className="w-full justify-start">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                View Event Log
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Platform health overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Database</span>
                <span className="flex items-center text-sm text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Auth Service</span>
                <span className="flex items-center text-sm text-green-600">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Billing</span>
                <span className="flex items-center text-sm text-yellow-600">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
                  Manual (V1)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
