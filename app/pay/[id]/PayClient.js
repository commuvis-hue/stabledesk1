'use client';
import { useEffect, useMemo, useState } from 'react';

const won = (n) => `${Number(n).toLocaleString('ko-KR')}원`;
const GRACE_MS = 60 * 60 * 1000;

function remaining(ms) {
  if (ms <= 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PayClient({ initial, qrSvg }) {
  const [inv, setInv] = useState(initial);
  const [now, setNow] = useState(Date.now());
  const [choice, setChoice] = useState(() => {
    const n = initial.networks[0];
    return n ? `${n.id}:${n.tokens[0].symbol}` : '';
  });
  const [copied, setCopied] = useState('');

  const options = useMemo(
    () => inv.networks.flatMap((n) => n.tokens.map((t) => ({ key: `${n.id}:${t.symbol}`, network: n, token: t }))),
    [inv.networks]
  );
  const selected = options.find((o) => o.key === choice) || options[0];

  // 1초마다 남은 시간, 10초마다 입금 확인
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (inv.status === 'paid') return;
    let alive = true;
    async function check() {
      if (Date.now() > inv.expiresAt + GRACE_MS) return;
      try {
        const res = await fetch(`/api/pay/${inv.id}/check`, { method: 'POST' });
        const json = await res.json();
        if (alive && json.invoice) setInv(json.invoice);
      } catch {}
    }
    check();
    const t = setInterval(check, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [inv.id, inv.status, inv.expiresAt]);

  async function copy(label, text) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  }

  const [whole, frac] = inv.amount.split('.');
  const left = inv.expiresAt - now;

  if (inv.status === 'paid') {
    const p = inv.payment;
    return (
      <main className="pay">
        <div className="receipt">
          <div className="paid-box">
            <h2>결제가 완료되었습니다</h2>
            <p className="num" style={{ margin: 0 }}>{won(inv.amountKrw)} · {inv.amount} {p.token}</p>
            <dl className="num">
              <dt>주문번호</dt><dd>{inv.orderId || '-'}</dd>
              <dt>네트워크</dt><dd>{p.networkName}</dd>
              <dt>확인 시각</dt><dd>{new Date(p.paidAt).toLocaleString('ko-KR')}</dd>
              <dt>거래 내역</dt>
              <dd><a href={p.txUrl} target="_blank" rel="noreferrer">{p.txHash.slice(0, 18)}…</a></dd>
            </dl>
            {p.late && <p className="notice" style={{ marginTop: 16 }}>유효 시간이 지난 뒤 입금되었습니다. 판매자가 확인 후 처리합니다.</p>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pay">
      <div className="receipt">
        <div className="receipt-top">
          <div className="order"><span>스테이블코인 결제</span><span>{inv.orderId && `주문 ${inv.orderId}`}</span></div>
          <p className="krw num">{won(inv.amountKrw)}</p>
          <span className="rate num">적용 환율 1 USD = {Number(inv.rate).toFixed(2)}원</span>
        </div>

        <div className="receipt-body">
          <p className="step-label">보낼 코인과 네트워크</p>
          <div className="networks" role="group" aria-label="네트워크 선택">
            {options.map((o) => (
              <button key={o.key} type="button" aria-pressed={o.key === selected?.key} onClick={() => setChoice(o.key)}>
                {o.token.symbol} · {o.network.name}
              </button>
            ))}
          </div>

          <p className="step-label">보낼 금액</p>
          <div className="amount">
            <div className="amount-row">
              <span className="amount-value num">
                {whole}.{frac.slice(0, 2)}<span className="key">{frac.slice(2)}</span>
                <span className="unit">{selected?.token.symbol}</span>
              </span>
              <button className="btn ghost small" onClick={() => copy('amount', inv.amount)}>
                {copied === 'amount' ? '복사됨' : '복사'}
              </button>
            </div>
          </div>
          <p className="amount-note">
            표시된 소수점까지 <strong>정확히 같은 금액</strong>을 보내야 자동으로 확인됩니다. 끝 네 자리는 이 결제를 구분하는 번호입니다.
          </p>

          <div className="addr">
            <div className="qr" aria-label="받는 주소 QR 코드" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <p className="step-label" style={{ marginBottom: 4 }}>받는 주소</p>
              <code>{inv.merchant}</code>
              <button className="btn ghost small" onClick={() => copy('addr', inv.merchant)}>
                {copied === 'addr' ? '복사됨' : '주소 복사'}
              </button>
            </div>
          </div>
          {selected && (
            <p className="contract">
              {selected.network.name}의 {selected.token.symbol} 토큰 계약: {selected.token.address}
            </p>
          )}
        </div>

        <div className="watch" aria-live="polite">
          {left > 0 ? (
            <>
              <span><span className="pulse" />입금을 확인하고 있습니다</span>
              <span className="num">남은 시간 {remaining(left)}</span>
            </>
          ) : (
            <span>유효 시간이 지났습니다. 이미 보냈다면 이 화면을 열어 두세요. 1시간 동안 계속 확인합니다.</span>
          )}
        </div>
      </div>

      <ul className="cautions">
        <li>위에서 고른 네트워크로 보내세요. 다른 네트워크로 보내도 지원 목록에 있으면 확인됩니다.</li>
        <li>거래소에서 출금하면 수수료만큼 금액이 줄어 자동 확인이 안 될 수 있습니다. 받는 금액 기준으로 입력하세요.</li>
        <li>Ethereum은 확인까지 1~2분, Base·Arbitrum은 수십 초가 걸립니다.</li>
      </ul>
    </main>
  );
}
