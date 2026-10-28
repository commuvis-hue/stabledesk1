import { NextResponse } from 'next/server';
import { isAuthed, sessionToken } from '@/lib/auth';
import { publicNetworks } from '@/lib/chains';
import { adminView, createInvoice, merchantAddress } from '@/lib/invoice';
import { listInvoices, persistent } from '@/lib/store';

export const dynamic = 'force-dynamic';

const unauthorized = () => NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

export async function GET(req) {
  if (!(await isAuthed(req))) return unauthorized();
  const invoices = await listInvoices();
  return NextResponse.json({
    invoices: invoices.map(adminView),
    config: {
      persistent,
      authEnabled: Boolean(await sessionToken()),
      merchant: merchantAddress(),
      networks: publicNetworks(),
    },
  });
}

export async function POST(req) {
  if (!(await isAuthed(req))) return unauthorized();
  try {
    const body = await req.json();
    const inv = await createInvoice(body);
    return NextResponse.json({ invoice: adminView(inv) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
