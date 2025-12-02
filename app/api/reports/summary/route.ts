import { NextResponse } from 'next/server';
import { getEarningsSummary } from '@/lib/db/ops-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getEarningsSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching earnings summary:', error);
    return NextResponse.json(
      { thisWeek: 0, thisMonth: 0, thisYear: 0, lastWeek: 0, lastMonth: 0, lastYear: 0 },
      { status: 500 }
    );
  }
}
