import QRCode from 'qrcode';
import { notFound } from 'next/navigation';
import { publicView } from '@/lib/invoice';
import { getInvoice } from '@/lib/store';
import PayClient from './PayClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: '스테이블코인 결제 | StableDesk', robots: { index: false } };
}

export default async function PayPage({ params }) {
  const inv = await getInvoice(params.id);
  if (!inv) notFound();
  const qrSvg = await QRCode.toString(inv.merchant, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#13233a', light: '#ffffff' },
  });
  return <PayClient initial={publicView(inv)} qrSvg={qrSvg} />;
}
