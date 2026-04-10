export interface TradingConfig {
  ticker: string;
  totalCapital: number;
  rounds: number;
  targetReturn: number; // V4 익절: avgCost × (1 + targetReturn). 기본 0.15
  exchange: "NASD" | "NYSE" | "AMEX";
  locPriceMargin: number; // LOC 한도가 마진 (안전 슬리피지 버퍼)
  maxDailyOrderAmount: number; // 일일 최대 주문 금액
}

export interface CycleState {
  cycleNumber: number;
  startDate: string;
  totalShares: number;
  avgCost: number;
  T: number; // V4 소수점 turn 카운터
  cycleCash: number;
  totalCash: number;
  mode: "normal" | "reverse";
  recentCloses: number[]; // MA5 sliding window (최대 5개)
  reverseFirstDay: boolean;
}

export interface TradingState {
  config: TradingConfig;
  cycle: CycleState;
  lastTradeDate: string; // 마지막으로 LOC 제출한 거래일 (YYYY-MM-DD)
  lastSettleDate: string; // 마지막으로 체결 정산한 거래일
  createdAt: string;
  updatedAt: string;
}

/**
 * V4 일간 주문 종류.
 * - buy_half_star: 전반전 별지점 0.5배
 * - buy_half_avg: 전반전 평단가 0.5배
 * - buy_full_star: 후반전 별지점 1배
 * - quarter_sell_star: 보유중 쿼터매도 LOC @ 별지점
 * - final_sell_target: 보유중 익절 LOC @ avgCost × (1+targetReturn)
 * - reverse_moc_sell: 리버스 첫날 시장가(MOC) 매도
 * - reverse_ladder_sell: 리버스 둘째날~ MA5 위 매도
 * - reverse_quarter_buy: 리버스 둘째날~ MA5 미만 쿼터매수
 */
export type OrderKind =
  | "buy_half_star"
  | "buy_half_avg"
  | "buy_full_star"
  | "quarter_sell_star"
  | "final_sell_target"
  | "reverse_moc_sell"
  | "reverse_ladder_sell"
  | "reverse_quarter_buy";

export interface PlannedOrder {
  kind: OrderKind;
  side: "buy" | "sell";
  quantity: number; // 정수
  limitPrice: number; // LOC 한도가 (MOC인 경우 reference price)
  reason: string;
}

/**
 * 임시 저장되는 펜딩 주문 (체결 정산까지 보관). 기록(log)이 아님.
 */
export interface PendingOrder {
  orderId: string;
  kind: OrderKind;
  side: "buy" | "sell";
  quantity: number;
  limitPrice: number;
  refClose: number; // 제출 시점 reference 종가/현재가
  reason: string;
  createdAt: string;
}

export interface PendingDay {
  date: string; // 제출 거래일 (YYYY-MM-DD)
  orders: PendingOrder[];
}

/**
 * 실체결 결과. settle/route.ts 에서 KIS inquire-ccnl 로 만든다.
 */
export interface FilledOrder {
  orderId: string;
  kind: OrderKind;
  filledQuantity: number;
  filledPrice: number;
  filledAmount: number;
}

/**
 * TradeLog 는 V4 에서 "실체결 1건"을 의미한다.
 * 예약/제출 시점에는 작성되지 않는다.
 */
export interface TradeLog {
  timestamp: string; // 정산 시각 (체결 확인 시점)
  date: string; // 체결 거래일
  kind: OrderKind;
  side: "buy" | "sell";
  ticker: string;
  price: number; // 체결 단가
  quantity: number; // 체결 수량
  amount: number; // 체결 금액
  orderId: string;
  cycleNumber: number;
  avgCost: number; // 체결 후 avgCost
  totalShares: number; // 체결 후 보유
  T: number; // 체결 후 T
  mode: "normal" | "reverse";
  cashRemaining: number; // 체결 후 cycleCash
  reason: string;
}
