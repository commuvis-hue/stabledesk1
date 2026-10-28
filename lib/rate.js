// 원/달러 환율. USDC·USDT는 1달러로 봅니다.
export async function krwPerUsd() {
  const fixed = Number(process.env.KRW_PER_USD);
  if (fixed > 0) return { rate: fixed, source: '고정 환율' };
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    if (json.result === 'success' && json.rates?.KRW) {
      return { rate: json.rates.KRW, source: 'open.er-api.com' };
    }
  } catch {}
  return { rate: 1400, source: '기본값(환율 조회 실패)' };
}
