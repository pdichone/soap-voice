import { NextResponse } from 'next/server';
import { getMonthlyEarnings } from '@/lib/db/ops-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getMonthlyEarnings(12);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching monthly earnings:', error);
    return NextResponse.json([], { status: 500 });
  }
}
