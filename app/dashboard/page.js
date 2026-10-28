'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STATUS = { paid: '결제 완료', pending: '입금 대기', expired: '만료' };
const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const time = (t) =>
  new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ orderId: '', amountKrw: '', memo: '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/invoices', { cache: 'no-store' });
      if (res.status === 401) return (window.location.href = '/login');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      setLoadError('');
      return json;
    } catch (e) {
      setLoadError(`내역을 불러오지 못했습니다: ${e.message}`);
    }
  }, []);

  // 대기 중인 결제는 대시보드에서도 주기적으로 입금을 확인합니다.
  useEffect(() => {
    let alive = true;
    async function tick() {
      const json = await load();
      const pending = (json?.invoices || []).filter((i) => i.status === 'pending').slice(0, 10);
      if (pending.length) {
        await Promise.allSettled(pending.map((i) => fetch(`/api/pay/${i.id}/check`, { method: 'POST' })));
        if (alive) await load();
      }
    }
    tick();
    const t = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [load]);

  const totals = useMemo(() => {
    const list = data?.invoices || [];
    const paid = list.filter((i) => i.status === 'paid');
    return {
      paidCount: paid.length,
      paidKrw: paid.reduce((s, i) => s + i.amountKrw, 0),
      pending: list.filter((i) => i.status === 'pending').length,
    };
  }, [data]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    setCopied(false);
    const res = await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setFormError(json.error || '결제 요청을 만들지 못했습니다.');
    setCreated(json.invoice);
    setForm({ orderId: '', amountKrw: '', memo: '' });
    load();
  }

  const payUrl = (id) => (typeof window === 'undefined' ? '' : `${window.location.origin}/pay/${id}`);

  async function copy(text) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  async function logout() {
    await fetch('/api/login', { method: 'DELETE' });
    window.location.href = '/login';
  }

  const cfg = data?.config;

  return (
    <>
      <header className="topbar">
        <div className="brand">StableDesk<small>스테이블코인 결제·정산</small></div>
        <div className="wallet">
          {cfg?.merchant ? <>받는 지갑 <code>{short(cfg.merchant)}</code></> : null}
          {cfg?.networks && <span>{cfg.networks.map((n) => n.name).join(', ')}</span>}
          {cfg?.authEnabled && <button className="btn ghost small" onClick={logout}>로그아웃</button>}
        </div>
      </header>

      <main className="desk">
        <section className="panel form-panel" aria-labelledby="new-title">
          <h2 id="new-title">새 결제 요청</h2>
          <form onSubmit={create}>
            <div className="field">
              <label htmlFor="amount">결제 금액(원)</label>
              <input id="amount" inputMode="numeric" className="num" placeholder="35,000" required
                value={form.amountKrw}
                onChange={(e) => setForm({ ...form, amountKrw: e.target.value.replace(/[^0-9]/g, '') })} />
              {form.amountKrw && <span className="hint num">{won(form.amountKrw)}</span>}
            </div>
            <div className="field">
              <label htmlFor="order">주문번호</label>
              <input id="order" placeholder="예: A-20261028-001" value={form.orderId}
                onChange={(e) => setForm({ ...form, orderId: e.target.value })} />
              <span className="hint">정산 내역에서 주문과 맞춰 볼 때 씁니다.</span>
            </div>
            <div className="field">
              <label htmlFor="memo">메모</label>
              <input id="memo" placeholder="고객명, 상품명 등 (고객에게는 보이지 않음)" value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </div>
            <button className="btn" disabled={busy || !form.amountKrw}>
              {busy ? '만드는 중…' : '결제 링크 만들기'}
            </button>
            {formError && <p className="error">{formError}</p>}
          </form>

          {created && (
            <div className="created">
              <span className="num">{won(created.amountKrw)} = <b>{created.amount} USD 코인</b></span>
              <div className="link">
                <input readOnly value={payUrl(created.id)} aria-label="결제 링크" />
                <button className="btn small" onClick={() => copy(payUrl(created.id))}>
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <p className="hint" style={{ margin: '8px 0 0', color: 'var(--muted)' }}>
                고객에게 이 링크를 보내면, 입금이 확인되는 즉시 결제 완료로 바뀝니다.
              </p>
            </div>
          )}
        </section>

        <section aria-labelledby="ledger-title">
          {cfg && !cfg.merchant && (
            <p className="notice">MERCHANT_ADDRESS가 설정되지 않아 결제 요청을 만들 수 없습니다. Vercel 환경변수에 받는 지갑 주소를 넣고 다시 배포하세요.</p>
          )}
          {cfg && !cfg.persistent && (
            <p className="notice">저장소가 연결되지 않아 내역이 서버 메모리에만 있습니다. 재배포하면 사라지니, Vercel Storage에서 Upstash Redis를 연결하세요.</p>
          )}
          {cfg && !cfg.authEnabled && (
            <p className="notice">ADMIN_PASSWORD가 없어 누구나 이 화면에 들어올 수 있습니다.</p>
          )}
          {loadError && <p className="error">{loadError}</p>}

          <div className="ledger-head">
            <h1 id="ledger-title">결제·정산 내역</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <a className="btn ghost small" href="/api/admin/export?status=paid">정산 내역 CSV</a>
              <a className="btn ghost small" href="/api/admin/export">전체 CSV</a>
            </div>
          </div>
          <p className="totals num">
            <span>결제 완료<b>{totals.paidCount}건</b></span>
            <span>정산 대상<b>{won(totals.paidKrw)}</b></span>
            <span>입금 대기<b>{totals.pending}건</b></span>
          </p>

          <div className="table-wrap">
            {!data ? (
              <div className="empty">불러오는 중…</div>
            ) : data.invoices.length === 0 ? (
              <div className="empty">아직 결제 요청이 없습니다. 왼쪽에서 금액을 넣고 첫 결제 링크를 만들어 보세요.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>요청 시각</th>
                    <th>주문번호</th>
                    <th className="right">원화</th>
                    <th className="right">코인 수량</th>
                    <th>상태</th>
                    <th>입금 정보</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((i) => (
                    <tr key={i.id}>
                      <td className="num">{time(i.createdAt)}</td>
                      <td>
                        {i.orderId || <span className="sub">주문번호 없음</span>}
                        {i.memo && <span className="sub">{i.memo}</span>}
                      </td>
                      <td className="right num">{won(i.amountKrw)}</td>
                      <td className="right num">
                        {i.amount}
                        <span className="sub">환율 {Number(i.rate).toFixed(2)}</span>
                      </td>
                      <td><span className={`status ${i.status}`}>{STATUS[i.status]}</span></td>
                      <td>
                        {i.payment ? (
                          <>
                            {i.payment.token} · {i.payment.networkName}
                            <a className="sub" href={i.payment.txUrl} target="_blank" rel="noreferrer">
                              거래 {short(i.payment.txHash)}
                            </a>
                          </>
                        ) : (
                          <a className="sub" href={`/pay/${i.id}`} target="_blank" rel="noreferrer">결제 페이지 열기</a>
                        )}
                        {i.lastError && i.status !== 'paid' && (
                          <span className="sub" style={{ color: 'var(--danger)' }}>확인 오류: {i.lastError}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
