import type { KISConfig } from "../kis/types";
import type { TradingConfig, TradeLog } from "./types";
import { getCurrentPrice } from "../kis/quote";
import {
  placeLOCBuy,
  placeLOCSell,
  placeLimitBuy,
  placeLimitSell,
} from "../kis/order";
import { determineAction, applyDecision } from "./strategy";
import { loadState, saveState, initState } from "./state";
import { logTrade, formatTradeLog } from "./logger";

export interface EngineResult {
  success: boolean;
  action: string;
  message: string;
  orderId?: string;
}

/**
 * 메인 트레이딩 엔진 - 하루 1회 실행
 */
export async function runTradingEngine(
  kisConfig: KISConfig,
  tradingConfig: TradingConfig,
): Promise<EngineResult> {
  const today = new Date().toISOString().split("T")[0];

  // 1. 상태 로드 또는 초기화
  let state = loadState();
  if (!state) {
    state = initState(tradingConfig);
    saveState(state);
    console.log("[Engine] 새 트레이딩 상태 초기화");
  }

  // 2. 중복 실행 방지
  if (state.lastTradeDate === today) {
    return {
      success: true,
      action: "skip",
      message: `오늘(${today}) 이미 실행됨 - 스킵`,
    };
  }

  // 3. 현재가 조회
  console.log(`[Engine] ${tradingConfig.ticker} 현재가 조회 중...`);
  const exchangeCode =
    tradingConfig.exchange === "NASD" ? "NAS" : tradingConfig.exchange;
  const currentPrice = await getCurrentPrice(
    kisConfig,
    tradingConfig.ticker,
    exchangeCode,
  );
  console.log(`[Engine] 현재가: $${currentPrice.toFixed(2)}`);

  // 4. 전략 판단
  const decision = determineAction(tradingConfig, state.cycle, currentPrice);
  console.log(`[Engine] 판단: ${decision.action} - ${decision.reason}`);

  // 5. 주문 실행
  let orderId: string | undefined;

  if (decision.action !== "hold") {
    // 일일 최대 주문 금액 체크
    if (decision.amount > tradingConfig.maxDailyOrderAmount) {
      return {
        success: false,
        action: decision.action,
        message: `일일 최대 주문 금액 초과: $${decision.amount.toFixed(2)} > $${tradingConfig.maxDailyOrderAmount}`,
      };
    }

    const orderQuantity = Math.floor(decision.quantity);
    if (orderQuantity <= 0) {
      return {
        success: true,
        action: "hold",
        message: `주문 수량 부족 (${decision.quantity.toFixed(4)}주 < 1주) - 홀드 처리`,
      };
    }

    try {
      const isBuy =
        decision.action === "buy_full" || decision.action === "buy_half";
      const isSell =
        decision.action === "sell" || decision.action === "quarter_sell";

      if (isBuy) {
        const locPrice = +(
          currentPrice *
          (1 + tradingConfig.locPriceMargin)
        ).toFixed(2);
        console.log(
          `[Engine] LOC 매수 주문: ${orderQuantity}주 @ $${locPrice} (지정가)`,
        );

        if (kisConfig.isMock) {
          const result = await placeLimitBuy(
            kisConfig,
            tradingConfig.ticker,
            orderQuantity,
            currentPrice,
            tradingConfig.exchange,
          );
          orderId = result.ODNO;
        } else {
          const result = await placeLOCBuy(
            kisConfig,
            tradingConfig.ticker,
            orderQuantity,
            locPrice,
            tradingConfig.exchange,
          );
          orderId = result.ODNO;
        }
      } else if (isSell) {
        const locPrice = +(
          currentPrice *
          (1 - tradingConfig.locPriceMargin)
        ).toFixed(2);
        console.log(
          `[Engine] LOC 매도 주문: ${orderQuantity}주 @ $${locPrice} (지정가)`,
        );

        if (kisConfig.isMock) {
          const result = await placeLimitSell(
            kisConfig,
            tradingConfig.ticker,
            orderQuantity,
            currentPrice,
            tradingConfig.exchange,
          );
          orderId = result.ODNO;
        } else {
          const result = await placeLOCSell(
            kisConfig,
            tradingConfig.ticker,
            orderQuantity,
            locPrice,
            tradingConfig.exchange,
          );
          orderId = result.ODNO;
        }
      }

      console.log(`[Engine] 주문 완료 - 주문번호: ${orderId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Engine] 주문 실패: ${msg}`);
      return {
        success: false,
        action: decision.action,
        message: `주문 실패: ${msg}`,
      };
    }
  }

  // 6. 상태 업데이트 (정수 주문 수량 반영)
  const adjusted = { ...decision };
  if (decision.action !== "hold") {
    adjusted.quantity = Math.floor(decision.quantity);
    adjusted.amount = adjusted.quantity * currentPrice;
  }

  state.cycle = applyDecision(state.cycle, adjusted, tradingConfig);
  state.lastTradeDate = today;
  saveState(state);

  // 7. 로그 기록
  const tradeLog: TradeLog = {
    timestamp: new Date().toISOString(),
    date: today,
    action: decision.action,
    ticker: tradingConfig.ticker,
    price: currentPrice,
    quantity: adjusted.quantity,
    amount: adjusted.amount,
    orderId,
    cycleNumber: state.cycle.cycleNumber,
    avgCost: state.cycle.avgCost,
    totalShares: state.cycle.totalShares,
    roundsUsed: state.cycle.roundsUsed,
    cashRemaining: state.cycle.cycleCash,
    reason: decision.reason,
  };

  logTrade(tradeLog);
  console.log(formatTradeLog(tradeLog));

  return {
    success: true,
    action: decision.action,
    message: decision.reason,
    orderId,
  };
}
