# CLAUDE.md — infinite-buy 프로젝트

## 프로젝트 개요

라오어의 **무한매수법** 및 **밸류 리밸런싱(VR)** 전략을 위한 백테스트 시뮬레이터 + 자동매매 시스템.
Next.js 앱으로 Vercel에 배포되며, KIS(한국투자증권) OpenAPI를 통해 미국 주식을 자동 매매한다.

---

## 핵심 명령어

```bash
npm run dev       # 개발 서버 (Turbopack)
npm run build     # 프로덕션 빌드 (배포 전 항상 확인)
vercel --prod     # Vercel 프로덕션 배포 (git 커밋 불필요)
```

---

## 페이지 구조

| 경로 | 설명 |
|------|------|
| `/` | 무한매수법 V1 백테스트 |
| `/backtest-v4` | 무한매수법 V4.0 시뮬레이터 (별지점·리버스모드) |
| `/backtest-vr` | 밸류 리밸런싱(VR) 백테스트 |
| `/trading` | 자동매매 대시보드 |

---

## 모듈 구조

```
src/
├── app/
│   ├── api/
│   │   ├── stock/route.ts          # Yahoo Finance 주가 조회
│   │   └── trading/
│   │       ├── reservation/route.ts # LOC 예약 제출 (Vercel Cron 1: KST 23:00)
│   │       ├── settle/route.ts      # 체결 정산 (Vercel Cron 2: 다음날 KST 06:30)
│   │       ├── reset/route.ts       # 1회성 초기화 (Bearer 인증 필요)
│   │       ├── run/route.ts         # 수동 예약 제출
│   │       ├── status/route.ts      # 상태 조회 (computed 포함)
│   │       └── history/route.ts     # 체결 이력
│   ├── backtest-v4/page.tsx
│   ├── backtest-vr/page.tsx
│   ├── trading/page.tsx
│   └── page.tsx
├── lib/
│   ├── types.ts                    # 공통 타입 (BacktestInput, VRInput 등)
│   ├── backtest.ts                 # 무한매수법 V1 엔진
│   ├── backtest-v4.ts              # 무한매수법 V4.0 엔진
│   ├── backtest-vr.ts              # 밸류 리밸런싱 엔진
│   ├── storage.ts                  # Upstash Redis 클라이언트
│   ├── kis/
│   │   ├── auth.ts                 # KIS 토큰 발급/캐시
│   │   ├── client.ts               # kisRequest (401/403 자동 재시도)
│   │   ├── quote.ts                # 현재가 조회 (HHDFS00000300)
│   │   ├── order.ts                # 주문 (지정가/LOC 예약)
│   │   ├── account.ts              # 계좌 조회
│   │   └── execution.ts            # 체결 조회
│   └── trading/
│       ├── types.ts                # TradingConfig, CycleState(T·mode·MA5), TradeLog, PendingDay 등
│       ├── strategy-v4.ts          # planV4Orders + applyFillsV4 (V4 매수/매도/리버스 규칙)
│       ├── state.ts                # 상태 저장/로드 (Redis or 파일)
│       ├── pending.ts              # PendingDay 큐 (정산 대기 LOC orderId 목록)
│       ├── v4-runner.ts            # runV4Reservation (아침 제출) + runV4Settlement (체결 정산)
│       ├── logger.ts               # 체결 로그 (실체결만 기록)
│       └── notify.ts               # 텔레그램 알림
└── components/
    ├── NavTabs.tsx                 # 상단 탭 네비게이션
    ├── BacktestForm.tsx            # V1/V4 공통 폼
    ├── BacktestChart.tsx           # V1/V4 공통 차트 (recharts)
    ├── ResultSummary.tsx           # V1/V4 결과 요약
    ├── TradeTable.tsx              # 거래 내역 테이블
    ├── VRChart.tsx                 # VR 전용 차트
    ├── VRResultSummary.tsx         # VR 결과 요약
    └── StrategyGuide.tsx           # V1 전략 설명
```

---

## 자동매매 시스템 (V4)

### 핵심 원칙
- **예약 시점에는 아무것도 기록하지 않는다.** state/log 변경은 오직 **체결 확인 후**에만 발생.
- 미체결 LOC 는 KIS 가 장 마감 시 자동 취소 → 정산 단계에서 체결분만 반영.

### 2단 Vercel Cron
| 시점 | 스케줄 (UTC) | KST | 엔드포인트 | 역할 |
|---|---|---|---|---|
| 아침 제출 | `0 14 * * 1-5` | 23:00 | `GET /api/trading/reservation` | V4 plan → LOC N건 동시 제출 → PendingDay 저장 |
| 체결 정산 | `30 21 * * 1-5` | 익일 06:30 | `GET /api/trading/settle` | PendingDay → `inquire-ccnl` → applyFillsV4 → state/log 갱신 |

- 인증: `Authorization: Bearer {CRON_SECRET}` (둘 다 필수)
- `GET /api/trading/reservation` 인증 없이 호출 시: 오늘 PendingDay 만 반환 (제출 안 함)

### 흐름
```
아침 크론
  loadState → planV4Orders(config, state.cycle, refPrice)
            → 각 PlannedOrder → placeReservationBuy/Sell
            → savePendingDay({ orders: [{orderId, kind, ...}] })
            → state.lastTradeDate = today (cycle 변경 없음)

정산 크론
  loadPendingDay(lastTradeDate)
    → 각 orderId → checkExecution → FilledOrder[]
    → applyFillsV4(state.cycle, fills, config, todayClose)
    → saveState (T·avgCost·mode·recentCloses 갱신)
    → 각 fill → logTrade
    → deletePendingDay
```

### V4 plan 규칙 (요약)
- **일반모드 매수** (보유중일 때):
  - 첫 매수: `1배 @ refPrice` (시장가 효과)
  - 전반전 (`T < rounds/2`): **2건** — `0.5배 @ 별지점` + `0.5배 @ avgCost`
  - 후반전 (`T ≥ rounds/2`): **1건** — `1배 @ 별지점`
- **일반모드 매도** (보유중일 때 매일 동시 제출):
  - 쿼터매도 LOC: `floor(shares × 0.25) @ 별지점` (체결 시 `T = T × 0.75`)
  - 익절매도 LOC: `잔여 75% @ avgCost × (1 + targetReturn)`
- **별지점**: `avgCost × (1 + (15 - 0.75·T) / 100)`
- **리버스모드 진입**: `T > rounds - 1` 자동 전환 (정산 시점에 체크)
  - 첫날: MOC 대용 LOC (`-20%` 한도가) `floor(shares / (rounds/2))`
  - 이후 `close ≥ MA5`: ladder LOC 매도 `@ MA5`, `T ×= 0.95`
  - 이후 `close < MA5`: 쿼터매수 `cycleCash/4 @ MA5`, `T += (rounds-T)×0.25`
- **리버스 종료**: `close > avgCost × 0.85` → 다음날부터 normal (T 유지)

### 주문 방식
- 모든 환경에서 LOC 예약주문 (`placeReservationBuy/Sell`)
- `KIS_MOCK=false` 가 정상 동작 전제. 모의투자 폴백 없음.

### 상태 저장
- Upstash Redis 우선, 없으면 `data/trading-state.json` 파일 폴백
- `CycleState`: `cycleNumber, startDate, totalShares, avgCost, T, cycleCash, totalCash, mode, recentCloses, reverseFirstDay`
- `TradingState`: `config, cycle, lastTradeDate, lastSettleDate, createdAt, updatedAt`
- PendingDay: Redis `trading:pending:{date}` (TTL 72h) + 파일 `data/pending/{date}.json`

### 1회성 초기화 (모의→실전 전환용)
- `POST /api/trading/reset` (Bearer 인증) — Redis/파일 모두 wipe 후 새 state init
- 작업 완료 후 라우트 삭제할 것

---

## 환경변수 (.env.local)

```
# KIS API
KIS_APP_KEY=...
KIS_APP_SECRET=...
KIS_ACCOUNT_NO=...          # 계좌번호 (예: 50123456-01)
KIS_ACCOUNT_PRODUCT=01
KIS_MOCK=false              # V4 실전: false 필수 (LOC 예약주문 사용)

# 트레이딩 설정
TRADING_TICKER=TQQQ
TRADING_TOTAL_CAPITAL=10000
TRADING_ROUNDS=40
TRADING_TARGET_RETURN=0.15  # V4 기본값 (15%)
TRADING_EXCHANGE=NASD       # NASD/NYSE/AMEX (줄바꿈 주의)
TRADING_LOC_MARGIN=0.05
TRADING_MAX_DAILY_AMOUNT=5000

# 인프라
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CRON_SECRET=...             # Vercel Cron 인증키

# 알림
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

> **주의**: 환경변수에 줄바꿈(`\n`) 포함 시 API 오류 발생. Vercel 대시보드에서 직접 입력할 것.

---

## 거래소 코드 변환

KIS API는 3자리 거래소 코드를 사용:
```
NASD → NAS
NYSE → NYS
AMEX → AMS
```

---

## 전략 문서

- `docs/v4-strategy-spec.md` — 무한매수법 V4.0 상세 스펙 (별지점, 리버스모드 포함)
- `docs/vr-strategy-spec.md` — 밸류 리밸런싱(VR) 상세 스펙 (V/Pool/G 공식)

---

## 알려진 주의사항

- `BacktestChart` tooltip formatter에서 `isNaN` 체크 필수 (Scatter가 date 문자열을 넘길 수 있음)
- KIS 401/403 에러 → `kisRequest`가 토큰 초기화 후 1회 자동 재시도
- 텔레그램 HTML parse_mode 사용 중 → reason 필드 등에 `escapeHtml()` 처리 필요
- `npm run build` 후 배포할 것 (TypeScript 오류 사전 확인)
