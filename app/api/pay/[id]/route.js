import { NextResponse } from 'next/server';
import { publicView } from '@/lib/invoice';
import { getInvoice } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const inv = await getInvoice(params.id);
  if (!inv) return NextResponse.json({ error: '결제 요청을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ invoice: publicView(inv) });
}
