import { NextResponse } from 'next/server';
import { getYearlyEarnings } from '@/lib/db/ops-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getYearlyEarnings();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching yearly earnings:', error);
    return NextResponse.json([], { status: 500 });
  }
}
