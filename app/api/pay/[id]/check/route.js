import { NextResponse } from 'next/server';
import { checkInvoice, publicView } from '@/lib/invoice';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(_req, { params }) {
  const inv = await checkInvoice(params.id);
  if (!inv) return NextResponse.json({ error: '결제 요청을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ invoice: publicView(inv) });
}
