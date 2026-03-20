export interface TradingConfig {
  ticker: string;
  totalCapital: number;
  rounds: number;
  targetReturn: number;
  exchange: "NASD" | "NYSE" | "AMEX";
  locPriceMargin: number; // LOC 지정가 마진 (기본 5%)
  maxDailyOrderAmount: number; // 일일 최대 주문 금액
}

export interface CycleState {
  cycleNumber: number;
  startDate: string;
  totalShares: number;
  avgCost: number;
  roundsUsed: number;
  cycleCash: number;
  totalCash: number;
}

export interface TradingState {
  config: TradingConfig;
  cycle: CycleState;
  lastTradeDate: string;
  createdAt: string;
  updatedAt: string;
}

export type TradeAction =
  | "buy_full"
  | "buy_half"
  | "sell"
  | "quarter_sell"
  | "hold";

export interface TradeDecision {
  action: TradeAction;
  quantity: number;
  amount: number;
  price: number;
  reason: string;
}

export interface TradeLog {
  timestamp: string;
  date: string;
  action: TradeAction;
  ticker: string;
  price: number;
  quantity: number;
  amount: number;
  orderId?: string;
  cycleNumber: number;
  avgCost: number;
  totalShares: number;
  roundsUsed: number;
  cashRemaining: number;
  reason: string;
}
