import { TRANSFER_TOPIC } from './chains';

async function call(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}

export async function latestBlock(chain) {
  return parseInt(await call(chain.rpc, 'eth_blockNumber', []), 16);
}

const hex = (n) => '0x' + n.toString(16);
const padAddress = (a) => '0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0');

/**
 * 가맹점 주소로 들어온 ERC-20 Transfer 중 금액이 정확히 일치하는 건을 찾습니다.
 * 한 번에 최대 5구간만 훑고, 다음에 이어서 볼 블록 번호를 돌려줍니다.
 */
export async function findPayment(chain, merchant, fromBlock, expectedUnits) {
  const latest = await latestBlock(chain);
  const expected = BigInt(expectedUnits);
  let start = fromBlock;

  for (let i = 0; i < 5 && start <= latest; i++) {
    const end = Math.min(start + chain.maxRange - 1, latest);
    const logs = await call(chain.rpc, 'eth_getLogs', [
      {
        fromBlock: hex(start),
        toBlock: hex(end),
        address: chain.tokens.map((t) => t.address),
        topics: [TRANSFER_TOPIC, null, padAddress(merchant)],
      },
    ]);

    for (const log of logs) {
      if (!log.data || log.data === '0x') continue;
      const token = chain.tokens.find(
        (t) => t.address.toLowerCase() === log.address.toLowerCase()
      );
      if (token && BigInt(log.data) === expected) {
        return {
          found: true,
          token: token.symbol,
          txHash: log.transactionHash,
          blockNumber: parseInt(log.blockNumber, 16),
          payer: '0x' + log.topics[1].slice(26),
          next: end + 1,
        };
      }
    }
    start = end + 1;
  }
  return { found: false, next: start };
}
