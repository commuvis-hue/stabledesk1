# StableDesk

사업계획서의 MVP인 **스테이블코인 정산 미들웨어**입니다. 가맹점이 결제 링크를 만들면, 고객은 USDC·USDT로 가맹점 지갑에 직접 보내고, 앱이 블록체인에서 입금을 찾아 주문과 자동으로 맞춥니다. 앱은 돈을 보관하거나 옮기지 않습니다(비수탁).

## 기능

- 원화 금액으로 결제 링크 생성, 실시간 환율로 코인 수량 계산
- Ethereum, Base, Arbitrum의 USDC·USDT 입금 자동 확인 (어느 네트워크로 와도 인식)
- 결제마다 금액 끝 네 자리를 다르게 붙여 주문과 입금을 구분
- 결제·정산 내역 대시보드, 엑셀에서 바로 열리는 CSV 정산 파일
- 결제 완료 시 웹훅 알림(HMAC 서명 포함)으로 쇼핑몰·ERP 연동

## Vercel 배포

1. 이 폴더를 GitHub 저장소에 올립니다.
2. [vercel.com/new](https://vercel.com/new)에서 저장소를 가져옵니다. 프레임워크는 Next.js로 자동 인식됩니다.
3. **Settings → Environment Variables**에 최소한 아래 두 개를 넣습니다.
   - `MERCHANT_ADDRESS`: 결제를 받을 지갑 주소
   - `ADMIN_PASSWORD`: 대시보드 비밀번호
4. **Storage → Upstash Redis(Marketplace)**를 만들어 프로젝트에 연결합니다. `KV_REST_API_URL`, `KV_REST_API_TOKEN`이 자동으로 들어갑니다. 연결하지 않으면 내역이 메모리에만 있어 재배포 때 사라집니다.
5. 다시 배포한 뒤 `https://<프로젝트>.vercel.app/dashboard`에 접속합니다.

나머지 설정은 `.env.example`을 보세요.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

## 운영 전에 꼭 확인할 것

- **받는 지갑**: 일반 지갑(EOA, 예: MetaMask)을 쓰세요. 스마트 계약 지갑(Safe 등)은 체인마다 주소가 달라 다른 네트워크로 온 돈을 받지 못할 수 있습니다.
- **RPC**: 기본값인 공개 RPC는 요청 제한이 있습니다. 운영 시에는 Alchemy·Infura 등 전용 RPC 주소를 `RPC_*` 환경변수에 넣으세요.
- **정확한 금액**: 고객이 금액을 다르게 보내면(거래소 출금 수수료 차감 등) 자동 확인이 안 됩니다. 이 경우 블록 탐색기로 직접 확인해야 합니다.
- **환율**: USDC·USDT를 1달러로 보고 계산합니다. 원화 정산(코인 매도)은 이 앱 밖에서 거래소·OTC로 처리합니다.
- **법규**: 이 앱은 가맹점 본인 지갑으로 받는 구조라 돈을 대신 받지 않지만, 실제 사업 운영 전에는 전자금융거래법·특정금융정보법 적용 여부를 전문가와 확인하세요. Vercel Hobby(무료) 요금제는 상업적 이용이 제한되므로 운영 시 Pro 요금제를 쓰세요.

## 웹훅 형식

결제 완료 시 `WEBHOOK_URL`로 POST합니다.

```json
{ "event": "invoice.paid", "invoice": { "id": "…", "orderId": "A-1", "amountKrw": 35000, "amount": "25.000712", "payment": { "network": "base", "token": "USDC", "txHash": "0x…" } } }
```

`WEBHOOK_SECRET`을 넣으면 `x-stabledesk-signature` 헤더에 본문의 HMAC-SHA256 값이 들어갑니다.

## 구조

```
app/dashboard        가맹점 대시보드 (로그인 필요)
app/pay/[id]         고객 결제 페이지 (공개)
app/api/admin/*      결제 요청 생성·목록·CSV (로그인 필요)
app/api/pay/[id]/*   결제 조회·입금 확인 (공개)
lib/chains.js        네트워크·토큰 목록 (추가 시 여기 수정)
lib/rpc.js           ERC-20 Transfer 이벤트 조회
lib/invoice.js       금액 생성, 입금 매칭, 웹훅
lib/store.js         Upstash Redis 또는 메모리 저장소
```
