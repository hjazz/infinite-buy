import type { CycleState, TradingConfig, TradeDecision } from "./types";

/**
 * 현재 상태와 가격을 기반으로 매매 판단
 * backtest.ts 로직을 실시간 1일 판단용으로 추출
 */
export function determineAction(
  config: TradingConfig,
  state: CycleState,
  currentPrice: number,
): TradeDecision {
  const { totalCapital, rounds, targetReturn } = config;
  const roundAmount = totalCapital / rounds;
  const { totalShares, avgCost, roundsUsed, cycleCash } = state;

  // 1. 목표가 매도: close >= avgCost * (1 + targetReturn)
  if (totalShares > 0 && currentPrice >= avgCost * (1 + targetReturn)) {
    return {
      action: "sell",
      quantity: totalShares,
      amount: totalShares * currentPrice,
      price: currentPrice,
      reason: `목표 수익률 달성 (${(((currentPrice - avgCost) / avgCost) * 100).toFixed(1)}%)`,
    };
  }

  // 2. 쿼터손절: 라운드 소진 또는 현금 부족
  const minBuyAmount = roundAmount * 0.5;
  if (
    totalShares > 0 &&
    (roundsUsed >= rounds || (cycleCash < minBuyAmount && roundsUsed > 0))
  ) {
    const quarterShares = totalShares * 0.25;
    return {
      action: "quarter_sell",
      quantity: quarterShares,
      amount: quarterShares * currentPrice,
      price: currentPrice,
      reason:
        roundsUsed >= rounds
          ? `라운드 소진 (${roundsUsed}/${rounds}) - 25% 매도`
          : `현금 부족 ($${cycleCash.toFixed(2)}) - 25% 매도`,
    };
  }

  // 3. 매수 판단
  if (roundsUsed < rounds) {
    let buyAmount: number;
    let action: "buy_full" | "buy_half";
    let reason: string;

    if (roundsUsed === 0) {
      buyAmount = roundAmount;
      action = "buy_full";
      reason = "첫 매수 (1배)";
    } else if (currentPrice < avgCost) {
      buyAmount = roundAmount;
      action = "buy_full";
      reason = `평단가 이하 매수 1배 (현재 $${currentPrice.toFixed(2)} < 평단 $${avgCost.toFixed(2)})`;
    } else {
      buyAmount = roundAmount * 0.5;
      action = "buy_half";
      reason = `평단가 이상 매수 0.5배 (현재 $${currentPrice.toFixed(2)} >= 평단 $${avgCost.toFixed(2)})`;
    }

    buyAmount = Math.min(buyAmount, cycleCash);

    if (buyAmount > 0 && currentPrice > 0) {
      const quantity = buyAmount / currentPrice;
      return { action, quantity, amount: buyAmount, price: currentPrice, reason };
    }
  }

  // 4. 홀드
  return {
    action: "hold",
    quantity: 0,
    amount: 0,
    price: currentPrice,
    reason: "매매 조건 미충족 - 홀드",
  };
}

/**
 * 매매 후 사이클 상태 업데이트
 */
export function applyDecision(
  state: CycleState,
  decision: TradeDecision,
  config: TradingConfig,
): CycleState {
  const next = { ...state };

  switch (decision.action) {
    case "sell": {
      const sellValue = decision.quantity * decision.price;
      next.totalCash = next.cycleCash + sellValue;
      next.totalShares = 0;
      next.avgCost = 0;
      next.roundsUsed = 0;
      next.cycleNumber += 1;
      next.cycleCash = next.totalCash;
      next.startDate = new Date().toISOString().split("T")[0];
      break;
    }
    case "quarter_sell": {
      const sellValue = decision.quantity * decision.price;
      next.totalShares -= decision.quantity;
      next.cycleCash += sellValue;
      const freedRounds = Math.min(
        Math.floor(config.rounds * 0.25),
        next.roundsUsed,
      );
      next.roundsUsed -= freedRounds;
      break;
    }
    case "buy_full":
    case "buy_half": {
      const sharesBought = decision.amount / decision.price;
      const prevTotalCost = next.avgCost * next.totalShares;
      next.totalShares += sharesBought;
      next.avgCost = (prevTotalCost + decision.amount) / next.totalShares;
      next.cycleCash -= decision.amount;
      next.roundsUsed += decision.action === "buy_full" ? 1 : 0.5;
      break;
    }
    case "hold":
      break;
  }

  return next;
}
