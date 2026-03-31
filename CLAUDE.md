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
│   │       ├── reservation/route.ts # LOC 예약주문 (Vercel Cron + 수동)
│   │       ├── run/route.ts         # 수동 즉시 실행
│   │       ├── status/route.ts      # 상태 조회
│   │       └── history/route.ts     # 거래 이력
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
│       ├── types.ts                # TradingState, TradeLog 등
│       ├── strategy.ts             # 매매 전략 판단 (determineAction)
│       ├── state.ts                # 상태 저장/로드 (Redis or 파일)
│       ├── reservation.ts          # 예약주문 상태 관리
│       ├── logger.ts               # 거래 로그
│       ├── engine.ts               # 트레이딩 엔진
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

## 자동매매 시스템

### Vercel Cron
- 스케줄: `0 14 * * 1-5` (UTC 14:00 = KST 23:00 = ET 9:00 AM, 평일)
- 엔드포인트: `GET /api/trading/reservation`
- 인증: `Authorization: Bearer {CRON_SECRET}`
- 단순 GET (인증 없음)은 현재 예약 상태만 반환 (예약 실행 안 함)

### 주문 방식
- **실거래** (`KIS_MOCK=false`): LOC 예약주문 (`placeReservationBuy/Sell`)
- **모의투자** (`KIS_MOCK=true`): 지정가 주문 (`placeLimitBuy/Sell`) — LOC 미지원
- 장외 시간 모의투자 오류 → `SIM-{timestamp}` 시뮬레이션 폴백

### 상태 저장
- Upstash Redis 설정 시: Redis 우선
- Redis 없을 시: `data/trading-state.json` 파일 폴백

---

## 환경변수 (.env.local)

```
# KIS API
KIS_APP_KEY=...
KIS_APP_SECRET=...
KIS_ACCOUNT_NO=...          # 계좌번호 (예: 50123456-01)
KIS_ACCOUNT_PRODUCT=01
KIS_MOCK=true               # true=모의투자, false=실거래 (줄바꿈 주의)

# 트레이딩 설정
TRADING_TICKER=TQQQ
TRADING_TOTAL_CAPITAL=10000
TRADING_ROUNDS=40
TRADING_TARGET_RETURN=0.1
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
