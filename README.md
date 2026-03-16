# 무한매수법 백테스트 시뮬레이터

라오어의 무한매수법(V1)을 과거 주가 데이터로 백테스트하고, 결과를 인터랙티브 그래프로 시각화하는 웹 서비스입니다.

## 무한매수법 V1 규칙

| 조건 | 액션 |
|------|------|
| 첫 매수 | 1회차 금액 매수 |
| 종가 < 평균단가 | 1회차 금액 매수 |
| 종가 >= 평균단가 | 0.5회차 금액 매수 |
| 평균단가 × 1.1 도달 | 전량 매도 → 새 사이클 |
| 40회 소진 | 쿼터손절 (25% 매도) 후 매수 재개 |

- **1회차 금액** = 총 투자금 / 분할 횟수 (기본 40)
- **목표 수익률** = 평균단가 + 10% (기본값, 조정 가능)

## 기능

- Yahoo Finance API를 통한 실시간 과거 주가 데이터 조회
- 무한매수법 V1 규칙 기반 백테스트 시뮬레이션
- 인터랙티브 차트 (종가, 평균단가, 목표가, 매수/매도 포인트)
- 성과 요약 (총 수익률, 사이클 수, 최대 낙폭, 쿼터손절 횟수)
- 일별 거래 내역 테이블

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript**
- **Tailwind CSS v4**
- **Recharts** (차트 라이브러리)
- **yahoo-finance2** (주가 데이터)

## 시작하기

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx              # 메인 페이지
│   ├── layout.tsx            # 루트 레이아웃
│   ├── globals.css           # Tailwind CSS
│   └── api/stock/route.ts    # Yahoo Finance API
├── lib/
│   ├── backtest.ts           # 백테스트 엔진
│   └── types.ts              # TypeScript 타입
└── components/
    ├── BacktestForm.tsx      # 입력 폼
    ├── BacktestChart.tsx     # 차트
    ├── ResultSummary.tsx     # 결과 요약
    └── TradeTable.tsx        # 거래 내역
```

## 사용법

1. **종목 (티커)** 입력 (예: TQQQ, SOXL, LABU)
2. **시작일 / 종료일** 선택
3. **총 투자금**, **분할 횟수**, **목표 수익률** 설정
4. **백테스트 실행** 클릭

## 주의사항

- 본 시뮬레이터는 교육 및 연구 목적으로 제작되었습니다.
- 과거 수익률이 미래 수익률을 보장하지 않습니다.
- 실제 투자 시 슬리피지, 수수료, 세금 등이 반영되지 않았습니다.
