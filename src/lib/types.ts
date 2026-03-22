export interface BacktestInput {
  ticker: string;
  startDate: string;
  endDate: string;
  totalCapital: number;
  rounds: number;
  targetReturn: number;
  dcaMonthlyAmount: number;
}

export interface DailyRecord {
  date: string;
  closePrice: number;
  action: "buy_full" | "buy_half" | "sell" | "quarter_sell" | "hold";
  buyAmount: number;
  shares: number;
  totalShares: number;
  avgCost: number;
  roundsUsed: number;
  cashRemaining: number;
  portfolioValue: number;
  cycleNumber: number;
}

export interface CycleResult {
  cycleNumber: number;
  startDate: string;
  endDate: string;
  daysHeld: number;
  returnRate: number;
  roundsUsed: number;
  sellType: "target" | "quarter_sell" | "ongoing";
}

export interface BuyHoldResult {
  finalValue: number;
  totalReturn: number;
  dailyValues: { date: string; value: number }[];
}

export interface DCAResult {
  finalValue: number;
  totalInvested: number;
  totalReturn: number;
  dailyValues: { date: string; value: number }[];
}

export interface BacktestResult {
  records: DailyRecord[];
  cycles: CycleResult[];
  totalReturn: number;
  finalValue: number;
  totalCapital: number;
  buyHold: BuyHoldResult;
  dca: DCAResult;
}

export interface StockData {
  date: string;
  close: number;
}
