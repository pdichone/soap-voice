import { NextResponse } from 'next/server';
import { getPaymentMethodBreakdown } from '@/lib/db/ops-queries';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') as 'week' | 'month' | 'year' || 'month';

    const data = await getPaymentMethodBreakdown(period);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching payment breakdown:', error);
    return NextResponse.json([], { status: 500 });
  }
}
