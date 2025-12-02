import { NextResponse } from 'next/server';
import { getWeeklyEarnings } from '@/lib/db/ops-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getWeeklyEarnings(8);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching weekly earnings:', error);
    return NextResponse.json([], { status: 500 });
  }
}
