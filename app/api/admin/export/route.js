import { isAuthed } from '@/lib/auth';
import { displayStatus } from '@/lib/invoice';
import { listInvoices } from '@/lib/store';

export const dynamic = 'force-dynamic';

const STATUS = { paid: '결제 완료', pending: '대기', expired: '만료' };
const kst = (t) => (t ? new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '');
const cell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req) {
  if (!(await isAuthed(req))) return new Response('로그인이 필요합니다.', { status: 401 });
  const only = req.nextUrl.searchParams.get('status'); // paid만 받고 싶으면 ?status=paid
  const rows = (await listInvoices(1000))
    .map((inv) => ({ inv, status: displayStatus(inv) }))
    .filter(({ status }) => !only || status === only);

  const header = [
    '결제ID', '주문번호', '상태', '원화금액', '적용환율(원/USD)', '코인수량', '코인',
    '네트워크', '트랜잭션', '보낸 주소', '요청시각(KST)', '결제시각(KST)', '메모',
  ];
  const lines = rows.map(({ inv, status }) =>
    [
      inv.id, inv.orderId, STATUS[status], inv.amountKrw, inv.rate, inv.amount,
      inv.payment?.token, inv.payment?.networkName, inv.payment?.txHash, inv.payment?.payer,
      kst(inv.createdAt), kst(inv.payment?.paidAt), inv.memo,
    ].map(cell).join(',')
  );
  const csv = '\uFEFF' + [header.join(','), ...lines].join('\n');
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="settlement-${date}.csv"`,
    },
  });
}
