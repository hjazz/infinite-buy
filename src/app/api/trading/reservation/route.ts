import { NextResponse } from "next/server";
import { getCurrentPrice } from "@/lib/kis/quote";
import { determineAction, applyDecision } from "@/lib/trading/strategy";
import { loadState, saveState, initState } from "@/lib/trading/state";
import {
  placeReservationBuy,
  placeReservationSell,
  placeLimitBuy,
  placeLimitSell,
} from "@/lib/kis/order";
import { getTodayReservation, saveReservation } from "@/lib/trading/reservation";
import { logTrade } from "@/lib/trading/logger";
import { notifyTrade, notifyError } from "@/lib/trading/notify";
import type { KISConfig } from "@/lib/kis/types";
import type { TradingConfig, TradeLog } from "@/lib/trading/types";

function loadConfigs(): { kis: KISConfig; trading: TradingConfig } | null {
  const required = ["KIS_APP_KEY", "KIS_APP_SECRET", "KIS_ACCOUNT_NO"];
  for (const key of required) {
    if (!process.env[key]) return null;
  }
  const isMock = process.env.KIS_MOCK !== "false";
  return {
    kis: {
      appKey: process.env.KIS_APP_KEY!,
      appSecret: process.env.KIS_APP_SECRET!,
      accountNo: process.env.KIS_ACCOUNT_NO!,
      accountProduct: process.env.KIS_ACCOUNT_PRODUCT || "01",
      baseUrl: isMock
        ? "https://openapivts.koreainvestment.com:29443"
        : "https://openapi.koreainvestment.com:9443",
      isMock,
    },
    trading: {
      ticker: process.env.TRADING_TICKER || "TQQQ",
      totalCapital: Number(process.env.TRADING_TOTAL_CAPITAL) || 10000,
      rounds: Number(process.env.TRADING_ROUNDS) || 40,
      targetReturn: Number(process.env.TRADING_TARGET_RETURN) || 0.1,
      exchange:
        (process.env.TRADING_EXCHANGE as "NASD" | "NYSE" | "AMEX") || "NASD",
      locPriceMargin: Number(process.env.TRADING_LOC_MARGIN) || 0.05,
      maxDailyOrderAmount: Number(process.env.TRADING_MAX_DAILY_AMOUNT) || 5000,
    },
  };
}

export async function GET() {
  const reservation = getTodayReservation();
  return NextResponse.json({ reservation });
}

export async function POST() {
  const configs = loadConfigs();
  if (!configs) {
    return NextResponse.json(
      { error: "KIS API 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const today = new Date().toISOString().split("T")[0];

  // 중복 예약 방지
  const existing = getTodayReservation();
  if (existing) {
    return NextResponse.json(
      { error: `오늘(${today}) 이미 예약됨 (주문번호: ${existing.orderId})` },
      { status: 409 },
    );
  }

  // 상태 로드 / 초기화
  let state = loadState();
  if (!state) {
    state = initState(configs.trading);
    saveState(state);
  }

  if (state.lastTradeDate === today) {
    return NextResponse.json(
      { error: `오늘(${today}) 이미 거래 완료됨` },
      { status: 409 },
    );
  }

  // 현재가 조회
  const exchangeCode =
    configs.trading.exchange === "NASD" ? "NAS" : configs.trading.exchange;
  let currentPrice: number;
  try {
    currentPrice = await getCurrentPrice(
      configs.kis,
      configs.trading.ticker,
      exchangeCode,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `현재가 조회 실패: ${msg}` },
      { status: 500 },
    );
  }

  // 전략 판단
  const decision = determineAction(configs.trading, state.cycle, currentPrice);

  if (decision.action === "hold") {
    return NextResponse.json({ success: true, action: "hold", message: decision.reason });
  }

  const orderQuantity = Math.floor(decision.quantity);
  if (orderQuantity <= 0) {
    return NextResponse.json({
      success: true,
      action: "hold",
      message: `수량 부족 (${decision.quantity.toFixed(4)}주 < 1주) - 홀드`,
    });
  }

  // LOC 예약 가격
  const isBuy = decision.action === "buy_full" || decision.action === "buy_half";
  const locPrice = +(
    currentPrice *
    (isBuy
      ? 1 + configs.trading.locPriceMargin
      : 1 - configs.trading.locPriceMargin)
  ).toFixed(2);

  // 예약주문 접수 (모의투자는 지정가 주문으로 대체)
  let orderId: string;
  try {
    let result;
    if (configs.kis.isMock) {
      result = isBuy
        ? await placeLimitBuy(
            configs.kis,
            configs.trading.ticker,
            orderQuantity,
            currentPrice,
            configs.trading.exchange,
          )
        : await placeLimitSell(
            configs.kis,
            configs.trading.ticker,
            orderQuantity,
            currentPrice,
            configs.trading.exchange,
          );
    } else {
      result = isBuy
        ? await placeReservationBuy(
            configs.kis,
            configs.trading.ticker,
            orderQuantity,
            locPrice,
            configs.trading.exchange,
          )
        : await placeReservationSell(
            configs.kis,
            configs.trading.ticker,
            orderQuantity,
            locPrice,
            configs.trading.exchange,
          );
    }
    orderId = result.ODNO;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notifyError(`${configs.trading.ticker} 예약주문 실패: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // 예약 상태 로컬 저장
  saveReservation({
    date: today,
    orderId,
    action: decision.action,
    ticker: configs.trading.ticker,
    quantity: orderQuantity,
    price: locPrice,
    amount: orderQuantity * currentPrice,
    reason: decision.reason,
    createdAt: new Date().toISOString(),
  });

  // 트레이딩 상태 업데이트
  const adjusted = {
    ...decision,
    quantity: orderQuantity,
    amount: orderQuantity * currentPrice,
  };
  state.cycle = applyDecision(state.cycle, adjusted, configs.trading);
  state.lastTradeDate = today;
  saveState(state);

  // 로그 기록
  const tradeLog: TradeLog = {
    timestamp: new Date().toISOString(),
    date: today,
    action: decision.action,
    ticker: configs.trading.ticker,
    price: currentPrice,
    quantity: orderQuantity,
    amount: orderQuantity * currentPrice,
    orderId,
    cycleNumber: state.cycle.cycleNumber,
    avgCost: state.cycle.avgCost,
    totalShares: state.cycle.totalShares,
    roundsUsed: state.cycle.roundsUsed,
    cashRemaining: state.cycle.cycleCash,
    reason: decision.reason,
  };
  logTrade(tradeLog);
  await notifyTrade(tradeLog);

  return NextResponse.json({
    success: true,
    action: decision.action,
    message: decision.reason,
    orderId,
    price: locPrice,
    quantity: orderQuantity,
  });
}
