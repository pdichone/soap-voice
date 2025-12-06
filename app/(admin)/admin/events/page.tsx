import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAdminEvents } from '@/lib/db/admin-queries';
import type { AdminEventWithPractitioner } from '@/lib/types-ops';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventCategoryColor(category: string | null) {
  switch (category) {
    case 'admin':
      return 'bg-purple-100 text-purple-800';
    case 'auth':
      return 'bg-blue-100 text-blue-800';
    case 'patient':
      return 'bg-green-100 text-green-800';
    case 'visit':
      return 'bg-teal-100 text-teal-800';
    case 'payment':
      return 'bg-yellow-100 text-yellow-800';
    case 'claim':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

function getActorIcon(actorType: string) {
  switch (actorType) {
    case 'admin':
      return (
        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'practitioner':
      return (
        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'system':
      return (
        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    default:
      return null;
  }
}

export default async function EventsLogPage() {
  let events: AdminEventWithPractitioner[] = [];
  let error: string | null = null;

  try {
    events = await getAdminEvents({ limit: 100 });
  } catch (err) {
    console.error('Error loading events:', err);
    error = 'Failed to load events';
    events = [];
  }

  // Group events by date
  const groupedEvents = events.reduce((groups, event) => {
    const date = new Date(event.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(event);
    return groups;
  }, {} as Record<string, AdminEventWithPractitioner[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Events Log</h1>
        <p className="text-slate-600 mt-1">
          Audit trail of all admin and practitioner actions
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!error && events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <svg
              className="w-12 h-12 text-slate-400 mx-auto mb-4"
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
            <h3 className="text-lg font-medium text-slate-900">No events yet</h3>
            <p className="text-slate-500 mt-1">
              Events will appear here as actions are performed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Events List */}
      {Object.entries(groupedEvents).map(([date, dateEvents]) => (
        <div key={date}>
          <h2 className="text-sm font-medium text-slate-500 mb-3">{date}</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {dateEvents.map((event) => (
                  <div key={event.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {getActorIcon(event.actor_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={getEventCategoryColor(event.event_category)} variant="secondary">
                            {event.event_category}
                          </Badge>
                          <span className="text-sm font-medium text-slate-900">
                            {event.event_type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {event.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                          <span>
                            {event.actor_type === 'admin' ? 'Admin' : 'User'}:{' '}
                            {event.actor_email || 'System'}
                          </span>
                          {event.practitioner && (
                            <Link
                              href={`/admin/practitioners/${event.practitioner.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {event.practitioner.name}
                            </Link>
                          )}
                          <span>{formatDate(event.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
