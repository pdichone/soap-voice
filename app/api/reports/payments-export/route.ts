import { NextResponse } from 'next/server';
import { getPaymentsForExport } from '@/lib/db/ops-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getPaymentsForExport();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching payments for export:', error);
    return NextResponse.json([], { status: 500 });
  }
}
