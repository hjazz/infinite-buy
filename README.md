# 무한매수법 자동매매 시스템

라오어의 무한매수법(V1) 전략을 백테스트하고, 한국투자증권 OpenAPI를 통해 **미국 ETF(TQQQ 등)를 자동으로 매수·매도**하는 시스템입니다.

## 프로젝트 구성

```
Phase 1: 백테스트 시뮬레이터 ✅ 완료
Phase 2: 자동매매 엔진      ✅ 완료
Phase 3: 스케줄러 & 알림     ✅ 완료
Phase 4: 대시보드 통합       ✅ 완료
Phase 5: 실전 투자 전환      🔲 모의투자 검증 후 전환
```

---

## 무한매수법 V1 규칙

| 조건 | 액션 |
|------|------|
| 첫 매수 | 1회차 금액 매수 |
| 종가 < 평균단가 | 1회차 금액 매수 (1배) |
| 종가 >= 평균단가 | 0.5회차 금액 매수 (0.5배) |
| 평균단가 × 1.1 도달 | 전량 매도 → 새 사이클 |
| 40회 소진 or 현금 부족 | 쿼터손절 (25% 매도) 후 매수 재개 |

- **1회차 금액** = 총 투자금 / 분할 횟수 (기본 40)
- **목표 수익률** = 평균단가 + 10% (기본값, 조정 가능)

---

## Phase 1: 백테스트 시뮬레이터 ✅

Yahoo Finance 과거 데이터로 무한매수법 전략을 시뮬레이션하는 웹 UI.

### 기능
- 종목/기간/자본금/라운드/목표수익률 설정
- 인터랙티브 차트 (종가, 평균단가, 목표가, 매수/매도 포인트)
- Buy & Hold 벤치마크 비교
- 성과 요약 (수익률, 사이클 수, 최대 낙폭)
- 일별 거래 내역 테이블

### 실행
```bash
npm install
npm run dev
# http://localhost:3000
```

---

## Phase 2: 자동매매 엔진 ✅

한국투자증권 OpenAPI를 통해 LOC(장마감지정가) 주문으로 자동 매수·매도.

### 아키텍처

```
┌──────────────────────────────────────────────┐
│  CLI: npm run trade                          │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐ │
│  │ KIS API    │  │ Strategy │  │  State   │ │
│  │ Client     │  │ Engine   │  │ Manager  │ │
│  │ (인증/주문/ │  │ (매매판단)│  │ (JSON)  │ │
│  │  시세/잔고) │  │          │  │          │ │
│  └─────┬──────┘  └────┬─────┘  └────┬─────┘ │
│        └──────┬───────┘             │        │
│        ┌──────┴─────────────────────┘        │
│        │  Trading Engine (오케스트레이터)      │
│        └─────────────────────────────────────│
└──────────────────────────────────────────────┘
         │
         ▼
  한국투자증권 OpenAPI
  (모의투자 / 실전투자)
```

### 모듈 구조

```
src/
├── lib/
│   ├── kis/                    # 한국투자증권 API 클라이언트
│   │   ├── types.ts            # API 타입 정의
│   │   ├── auth.ts             # 토큰 인증/갱신
│   │   ├── client.ts           # HTTP 요청 래퍼
│   │   ├── quote.ts            # 현재가 조회
│   │   ├── order.ts            # 주문 (LOC/지정가 매수·매도)
│   │   └── account.ts          # 잔고·예수금 조회
│   ├── trading/                # 트레이딩 엔진
│   │   ├── types.ts            # 상태/로그 타입
│   │   ├── strategy.ts         # 매매 판단 로직 (backtest.ts에서 추출)
│   │   ├── state.ts            # JSON 상태 저장/로드
│   │   ├── logger.ts           # 거래 로그 (JSONL)
│   │   └── engine.ts           # 메인 오케스트레이터
│   ├── backtest.ts             # 백테스트 엔진
│   └── types.ts                # 공통 타입
├── scripts/
│   ├── trade.ts                # 자동매매 실행 CLI
│   └── status.ts               # 트레이딩 상태 확인 CLI
├── components/                 # 백테스트 UI 컴포넌트
└── app/                        # Next.js 페이지
```

### 주문 방식

| 환경 | 주문 유형 | `ord_dvsn` | 비고 |
|------|----------|------------|------|
| **실전투자** | LOC (장마감지정가) | `34` | 종가에 체결, 백테스트와 정합성 최고 |
| **모의투자** | 지정가 | `00` | 모의투자에서 LOC 미지원으로 대체 |

- LOC 매수: 현재가 × 1.05를 지정가로 설정 → 종가 ≤ 지정가 시 종가에 체결
- LOC 매도: 현재가 × 0.95를 지정가로 설정 → 종가 ≥ 지정가 시 종가에 체결
- 장 마감 15분 전(ET 15:45) 주문 마감

### 설정

```bash
cp .env.example .env.local
```

`.env.local` 에 한국투자증권 API 키 설정:

```env
KIS_APP_KEY=your_app_key
KIS_APP_SECRET=your_app_secret
KIS_ACCOUNT_NO=12345678
KIS_ACCOUNT_PRODUCT=01
KIS_MOCK=true                   # true=모의투자, false=실전투자

TRADING_TICKER=TQQQ
TRADING_TOTAL_CAPITAL=10000     # 총 투자금 (USD)
TRADING_ROUNDS=40               # 분할 횟수
TRADING_TARGET_RETURN=0.10      # 목표 수익률 10%
TRADING_EXCHANGE=NASD
TRADING_LOC_MARGIN=0.05         # LOC 지정가 마진 5%
TRADING_MAX_DAILY_AMOUNT=5000   # 일일 최대 주문 금액
```

### 사용법

```bash
# 자동매매 실행 (하루 1회)
npm run trade

# 현재 트레이딩 상태 확인
npm run trade:status
```

### 안전장치
- 하루 1회 실행 제한 (중복 방지)
- 일일 최대 주문 금액 제한
- 주문 수량 1주 미만 시 홀드 처리
- 모든 거래 JSONL 로그 기록 (`data/logs/`)
- 모의투자 우선 실행 권장

### 데이터 저장

```
data/
├── trading-state.json          # 현재 사이클 상태
└── logs/
    └── trades-YYYY-MM.jsonl    # 월별 거래 로그
```

---

## Phase 3: 스케줄러 & 알림 ✅

매일 미국장 마감 전 자동 실행 + 텔레그램 알림.

### 기능
- **node-cron 스케줄러**: 매일 ET 15:30 (장마감 30분 전) 자동 실행, 서머/윈터타임 자동 처리
- **텔레그램 알림**: 매매 판단·주문·체결 결과 실시간 전송
- **에러 알림**: 주문 실패·API 오류 시 즉시 알림

### 사용법

```bash
# 스케줄러 실행 (백그라운드 상주)
npm run trade:cron

# 또는 시스템 crontab 사용
# 30 5 * * 1-5 cd /path/to/infinite-buy && npm run trade >> data/logs/cron.log 2>&1
```

### 텔레그램 설정

`.env.local`에 추가:
```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

1. @BotFather에서 봇 생성 → 토큰 발급
2. 봇에게 메시지 전송 후 `https://api.telegram.org/bot{TOKEN}/getUpdates`에서 chat_id 확인

### 스케줄 커스터마이징

```env
CRON_SCHEDULE=30 15 * * 1-5       # 기본: ET 15:30 월~금
CRON_TIMEZONE=America/New_York    # 미국 동부시간
```

---

## Phase 4: 대시보드 통합 ✅

웹 UI에서 트레이딩 상태 모니터링 + 수동 실행.

### 기능
- `/trading` 페이지: 사이클 상태, 보유 현황, 잔여 라운드, 자본 사용률
- 거래 내역 테이블 (JSONL 로그 기반, 최신순)
- 수동 실행 버튼 (API Route 연동)
- 백테스트 페이지 ↔ 트레이딩 페이지 네비게이션

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/trading/status` | 현재 트레이딩 상태 + 계산된 지표 |
| GET | `/api/trading/history?limit=20` | 거래 내역 (페이지네이션) |
| POST | `/api/trading/run` | 수동 매매 실행 |

---

## Phase 5: 실전 투자 전환 + 체결 확인 ✅ (코드 완료, 검증 대기)

체결 확인 로직 구현 완료. 모의투자 검증 후 실전 전환 예정.

### 구현된 기능
- 주문 후 체결 여부 자동 조회 (`checkExecution`)
- 체결/부분체결/미체결 상태 로깅
- 체결 대기 폴링 (`waitForExecution`) — LOC 장마감 체결 대응

### 전환 체크리스트
- [ ] 모의투자 2주 이상 정상 운영 확인
- [ ] LOC 주문 체결률 검증
- [ ] `.env.local`에서 `KIS_MOCK=false` 전환
- [ ] 일일 최대 주문 금액 재설정

### 고려사항
- 슬리피지: LOC 주문이므로 종가 체결, 슬리피지 최소
- 수수료: 한투 해외주식 수수료 (약 0.25%) 반영 여부
- 세금: 해외주식 양도소득세 (연 250만원 기본공제)
- 환율: 원화 환전 타이밍

---

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript 5.9** (strict mode)
- **Tailwind CSS v4** + **Recharts** (차트)
- **yahoo-finance2** (백테스트 주가 데이터)
- **한국투자증권 OpenAPI** (실시간 시세·주문)
- **node-cron** (스케줄러)
- **dotenv** + **tsx** (CLI 스크립트)

## 주의사항

- 본 시스템은 교육 및 연구 목적으로 제작되었습니다.
- 과거 수익률이 미래 수익률을 보장하지 않습니다.
- 반드시 모의투자로 충분히 검증한 후 실전 투자를 진행하세요.
- 자동매매 중 발생하는 손실에 대한 책임은 사용자에게 있습니다.
