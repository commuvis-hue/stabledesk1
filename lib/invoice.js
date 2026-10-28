import { createHmac, randomUUID } from 'node:crypto';
import { DECIMALS, enabledChains, publicNetworks } from './chains';
import { findPayment, latestBlock } from './rpc';
import { krwPerUsd } from './rate';
import { addToIndex, getInvoice, reserveAmount, saveInvoice } from './store';

const GRACE_MS = 60 * 60 * 1000; // 만료 후 1시간까지는 늦은 입금도 찾아봅니다.
const MIN_CHECK_GAP_MS = 8000;

export function merchantAddress() {
  const a = process.env.MERCHANT_ADDRESS || '';
  return /^0x[0-9a-fA-F]{40}$/.test(a) && !/^0x0{40}$/.test(a) ? a : null;
}

export function formatUnits(units) {
  const s = String(units).padStart(DECIMALS + 1, '0');
  return `${s.slice(0, -DECIMALS)}.${s.slice(-DECIMALS)}`;
}

export function displayStatus(inv, now = Date.now()) {
  if (inv.status === 'paid') return 'paid';
  return now > inv.expiresAt ? 'expired' : 'pending';
}

export async function createInvoice({ orderId, amountKrw, memo }) {
  const merchant = merchantAddress();
  if (!merchant) {
    throw new Error('MERCHANT_ADDRESS 환경변수에 결제를 받을 지갑 주소(0x로 시작하는 42자)를 넣으세요.');
  }
  const krw = Math.round(Number(String(amountKrw).replace(/[^0-9.]/g, '')));
  if (!(krw >= 1000 && krw <= 100_000_000)) {
    throw new Error('결제 금액은 1,000원에서 1억 원 사이로 입력하세요.');
  }

  const { rate, source } = await krwPerUsd();
  // 센트 단위로 올림한 뒤, 마지막 4자리(0.0001~0.9999센트)에 결제 건별 고유값을 붙입니다.
  const baseUnits = Math.ceil((krw / rate) * 100) * 10_000;
  let units = null;
  for (let i = 0; i < 30 && !units; i++) {
    const candidate = baseUnits + 1 + Math.floor(Math.random() * 9999);
    if (await reserveAmount(candidate)) units = candidate;
  }
  if (!units) throw new Error('고유 결제 금액을 만들지 못했습니다. 잠시 후 다시 시도하세요.');

  const chains = enabledChains();
  const scan = {};
  await Promise.all(
    chains.map(async (c) => {
      try {
        scan[c.id] = Math.max(0, (await latestBlock(c)) - 5);
      } catch {
        scan[c.id] = null; // 첫 확인 때 다시 시도
      }
    })
  );

  const ttl = Number(process.env.INVOICE_TTL_MINUTES) || 30;
  const now = Date.now();
  const inv = {
    id: randomUUID().replace(/-/g, '').slice(0, 20),
    orderId: String(orderId || '').trim().slice(0, 64),
    memo: String(memo || '').trim().slice(0, 200),
    amountKrw: krw,
    rate,
    rateSource: source,
    units: String(units),
    amount: formatUnits(units),
    merchant,
    status: 'pending',
    createdAt: now,
    expiresAt: now + ttl * 60_000,
    scan,
    payment: null,
    lastCheckedAt: 0,
    lastError: null,
  };
  await saveInvoice(inv);
  await addToIndex(inv.id);
  return inv;
}

export async function checkInvoice(id) {
  const inv = await getInvoice(id);
  if (!inv) return null;
  const now = Date.now();
  if (inv.status === 'paid' || now > inv.expiresAt + GRACE_MS) return inv;
  if (now - (inv.lastCheckedAt || 0) < MIN_CHECK_GAP_MS) return inv;

  inv.lastCheckedAt = now;
  const errors = [];
  const chains = enabledChains();

  const results = await Promise.allSettled(
    chains.map(async (c) => {
      let from = inv.scan?.[c.id];
      if (from == null) from = Math.max(0, (await latestBlock(c)) - c.maxRange);
      return { c, r: await findPayment(c, inv.merchant, from, inv.units) };
    })
  );

  for (const [i, res] of results.entries()) {
    if (res.status === 'rejected') {
      errors.push(`${chains[i].name}: ${res.reason?.message || res.reason}`);
      continue;
    }
    const { c, r } = res.value;
    inv.scan = { ...inv.scan, [c.id]: r.next };
    if (r.found && !inv.payment) {
      inv.status = 'paid';
      inv.payment = {
        network: c.id,
        networkName: c.name,
        token: r.token,
        txHash: r.txHash,
        txUrl: c.explorer + r.txHash,
        payer: r.payer,
        blockNumber: r.blockNumber,
        paidAt: now,
        late: now > inv.expiresAt,
      };
    }
  }
  inv.lastError = errors.length ? errors.join(' / ') : null;
  await saveInvoice(inv);
  if (inv.status === 'paid' && inv.payment.paidAt === now) await notify(inv);
  return inv;
}

async function notify(inv) {
  const url = process.env.WEBHOOK_URL;
  if (!url) return;
  const body = JSON.stringify({ event: 'invoice.paid', invoice: publicView(inv) });
  const headers = { 'content-type': 'application/json' };
  if (process.env.WEBHOOK_SECRET) {
    headers['x-stabledesk-signature'] = createHmac('sha256', process.env.WEBHOOK_SECRET)
      .update(body)
      .digest('hex');
  }
  try {
    await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(5000) });
  } catch {}
}

// 결제 페이지(누구나 볼 수 있음)에 보낼 정보
export function publicView(inv) {
  return {
    id: inv.id,
    orderId: inv.orderId,
    amountKrw: inv.amountKrw,
    amount: inv.amount,
    rate: inv.rate,
    merchant: inv.merchant,
    status: displayStatus(inv),
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    payment: inv.payment,
    networks: publicNetworks(),
  };
}

// 대시보드(로그인 필요)에 보낼 정보
export function adminView(inv) {
  return {
    ...publicView(inv),
    memo: inv.memo,
    rateSource: inv.rateSource,
    lastError: inv.lastError,
    networks: undefined,
  };
}
