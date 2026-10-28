// Upstash Redis(REST)가 설정되어 있으면 사용하고, 없으면 서버 메모리에 저장합니다.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const persistent = Boolean(URL_ && TOKEN);

async function redis(...args) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  const json = await res.json();
  if (json.error) throw new Error(`저장소 오류: ${json.error}`);
  return json.result;
}

const mem = globalThis.__stabledesk || (globalThis.__stabledesk = { kv: new Map(), index: [] });

export async function getInvoice(id) {
  if (persistent) {
    const v = await redis('GET', `inv:${id}`);
    return v ? JSON.parse(v) : null;
  }
  const v = mem.kv.get(`inv:${id}`);
  return v ? structuredClone(v) : null;
}

export async function saveInvoice(inv) {
  if (persistent) await redis('SET', `inv:${inv.id}`, JSON.stringify(inv));
  else mem.kv.set(`inv:${inv.id}`, structuredClone(inv));
}

export async function addToIndex(id) {
  if (persistent) await redis('LPUSH', 'inv:index', id);
  else mem.index.unshift(id);
}

export async function listInvoices(limit = 200) {
  const ids = persistent
    ? await redis('LRANGE', 'inv:index', 0, limit - 1)
    : mem.index.slice(0, limit);
  if (!ids || ids.length === 0) return [];
  if (persistent) {
    const values = await redis('MGET', ...ids.map((i) => `inv:${i}`));
    return values.filter(Boolean).map((v) => JSON.parse(v));
  }
  return ids.map((i) => mem.kv.get(`inv:${i}`)).filter(Boolean).map((v) => structuredClone(v));
}

// 같은 금액의 결제 요청이 동시에 두 개 생기지 않도록 2시간 동안 금액을 예약합니다.
export async function reserveAmount(units) {
  if (persistent) {
    const r = await redis('SET', `amt:${units}`, '1', 'NX', 'EX', 7200);
    return r === 'OK';
  }
  const key = `amt:${units}`;
  const until = mem.kv.get(key);
  if (until && until > Date.now()) return false;
  mem.kv.set(key, Date.now() + 7200 * 1000);
  return true;
}
