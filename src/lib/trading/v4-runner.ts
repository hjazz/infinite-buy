import type { KISConfig } from "../kis/types";
import { getCurrentPrice } from "../kis/quote";
import { placeReservationBuy, placeReservationSell } from "../kis/order";
import { checkExecution } from "../kis/execution";
import {
  loadState,
  saveState,
  initState,
} from "./state";
import { planV4Orders, applyFillsV4 } from "./strategy-v4";
import {
  loadPendingDay,
  savePendingDay,
  deletePendingDay,
} from "./pending";
import { logTrade } from "./logger";
import { notifyError, sendTelegram } from "./notify";
import type {
  TradingConfig,
  PendingDay,
  PendingOrder,
  FilledOrder,
  TradeLog,
} from "./types";

const EXCHANGE_MAP: Record<string, string> = {
  NASD: "NAS",
  NYSE: "NYS",
  AMEX: "AMS",
};

function todayKST(): string {
  // KST는 UTC+9. Vercel runtime은 UTC. KST 자정 기준 날짜 산출.
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

export interface ReservationResult {
  success: boolean;
  message: string;
  date: string;
  submitted: number;
  failed: number;
  orders: { kind: string; orderId: string; quantity: number; price: number }[];
}

/**
 * 아침 크론 (KST 23:00 ≒ ET 09:00) 에서 호출.
 * V4 plan 결과를 LOC 예약주문으로 동시에 제출하고, 펜딩 목록만 임시 저장한다.
 * 상태 업데이트나 거래 로그는 작성하지 않는다.
 */
export async function runV4Reservation(
  kis: KISConfig,
  trading: TradingConfig,
): Promise<ReservationResult> {
  const today = todayKST();

  // 상태 로드 / 초기화
  let state = await loadState();
  if (!state) {
    state = initState(trading);
    await saveState(state);
  }

  // 동일 거래일 중복 제출 방지
  if (state.lastTradeDate === today) {
    return {
      success: true,
      message: `오늘(${today}) 이미 LOC 예약 제출 완료`,
      date: today,
      submitted: 0,
      failed: 0,
      orders: [],
    };
  }

  // 현재가 조회 (LOC 한도가/수량 산정용 reference)
  const exchangeCode = EXCHANGE_MAP[trading.exchange] ?? "NAS";
  let refPrice: number;
  try {
    refPrice = await getCurrentPrice(kis, trading.ticker, exchangeCode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notifyError(`현재가 조회 실패: ${msg}`);
    throw err;
  }

  // V4 plan
  const planned = planV4Orders(trading, state.cycle, refPrice);

  if (planned.length === 0) {
    state.lastTradeDate = today;
    await saveState(state);
    await sendTelegram(
      `<b>${trading.ticker} 오늘 제출 주문 없음</b>\n사유: V4 plan 결과 0건 (T=${state.cycle.T.toFixed(2)}, mode=${state.cycle.mode})`,
    );
    return {
      success: true,
      message: "제출할 주문 없음 (planV4Orders → 0건)",
      date: today,
      submitted: 0,
      failed: 0,
      orders: [],
    };
  }

  const pending: PendingOrder[] = [];
  const submittedSummary: ReservationResult["orders"] = [];
  let failed = 0;

  for (const order of planned) {
    if (order.quantity <= 0) continue;

    // 일일 최대 주문 금액 가드 (단일 주문 기준)
    const notional = order.quantity * order.limitPrice;
    if (notional > trading.maxDailyOrderAmount) {
      await notifyError(
        `${trading.ticker} ${order.kind} 단일 주문 금액 초과 ($${notional.toFixed(2)} > $${trading.maxDailyOrderAmount}) — 스킵`,
      );
      failed++;
      continue;
    }

    try {
      const result = order.side === "buy"
        ? await placeReservationBuy(
            kis,
            trading.ticker,
            order.quantity,
            order.limitPrice,
            trading.exchange,
          )
        : await placeReservationSell(
            kis,
            trading.ticker,
            order.quantity,
            order.limitPrice,
            trading.exchange,
          );

      const orderId = result.ODNO;
      pending.push({
        orderId,
        kind: order.kind,
        side: order.side,
        quantity: order.quantity,
        limitPrice: order.limitPrice,
        refClose: refPrice,
        reason: order.reason,
        createdAt: new Date().toISOString(),
      });
      submittedSummary.push({
        kind: order.kind,
        orderId,
        quantity: order.quantity,
        price: order.limitPrice,
      });
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      await notifyError(`${trading.ticker} ${order.kind} 예약 실패: ${msg}`);
    }
  }

  // 펜딩 저장 (기록이 아니라 정산 대기 큐)
  const day: PendingDay = { date: today, orders: pending };
  await savePendingDay(day);

  // 거래일 마킹 (state 자체는 아직 안 바뀜)
  state.lastTradeDate = today;
  await saveState(state);

  // 알림
  const summaryLines = [
    `<b>${trading.ticker} V4 LOC 예약 제출</b>`,
    `날짜: ${today}`,
    `현재가: $${refPrice.toFixed(2)}`,
    `T: ${state.cycle.T.toFixed(2)} / mode: ${state.cycle.mode}`,
    `제출: ${pending.length}건${failed > 0 ? ` (실패 ${failed}건)` : ""}`,
    ``,
    ...pending.map(
      (p) => `· ${p.kind} ${p.side === "buy" ? "매수" : "매도"} ${p.quantity}주 @ $${p.limitPrice.toFixed(2)}`,
    ),
  ];
  await sendTelegram(summaryLines.join("\n"));

  return {
    success: true,
    message: `${pending.length}건 제출 완료${failed > 0 ? `, ${failed}건 실패` : ""}`,
    date: today,
    submitted: pending.length,
    failed,
    orders: submittedSummary,
  };
}

export interface SettlementResult {
  success: boolean;
  message: string;
  date: string;
  fills: number;
  cycleClosed: boolean;
}

/**
 * 체결 정산. 다음날 KST 06:30 경 (장 마감 후) 호출.
 * - PendingDay (lastTradeDate) 를 로드
 * - KIS inquire-ccnl 로 실체결 조회
 * - applyFillsV4 → state 갱신
 * - 체결된 건만 TradeLog 작성 + 알림
 * - PendingDay 삭제
 */
export async function runV4Settlement(
  kis: KISConfig,
  trading: TradingConfig,
): Promise<SettlementResult> {
  const state = await loadState();
  if (!state) {
    return {
      success: false,
      message: "trading state 없음 — 정산 스킵",
      date: "",
      fills: 0,
      cycleClosed: false,
    };
  }

  const settleDate = state.lastTradeDate;
  if (!settleDate) {
    return {
      success: true,
      message: "lastTradeDate 없음 — 정산할 거래일 없음",
      date: "",
      fills: 0,
      cycleClosed: false,
    };
  }

  if (state.lastSettleDate === settleDate) {
    return {
      success: true,
      message: `${settleDate} 이미 정산 완료`,
      date: settleDate,
      fills: 0,
      cycleClosed: false,
    };
  }

  const pending = await loadPendingDay(settleDate);
  if (!pending || pending.orders.length === 0) {
    state.lastSettleDate = settleDate;
    await saveState(state);
    return {
      success: true,
      message: `${settleDate} 펜딩 없음 (휴장 또는 0건 plan) — 스킵`,
      date: settleDate,
      fills: 0,
      cycleClosed: false,
    };
  }

  // 각 주문의 체결 결과 조회
  const fills: FilledOrder[] = [];
  for (const p of pending.orders) {
    try {
      const exec = await checkExecution(kis, p.orderId);
      if (!exec) continue;
      if (exec.filledQuantity <= 0) continue;
      fills.push({
        orderId: p.orderId,
        kind: p.kind,
        filledQuantity: exec.filledQuantity,
        filledPrice: exec.filledPrice,
        filledAmount: exec.filledAmount || exec.filledQuantity * exec.filledPrice,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notifyError(`주문 ${p.orderId} (${p.kind}) 체결 조회 실패: ${msg}`);
    }
  }

  // 오늘 종가 (= 정산 시점의 KIS 현재가) — recentCloses + 리버스 종료 체크용
  const exchangeCode = EXCHANGE_MAP[trading.exchange] ?? "NAS";
  let todayClose = 0;
  try {
    todayClose = await getCurrentPrice(kis, trading.ticker, exchangeCode);
  } catch {
    // 조회 실패 시 마지막 체결가 사용 fallback
    if (fills.length > 0) {
      todayClose = fills[fills.length - 1].filledPrice;
    }
  }

  // 상태 적용
  const { next, cycleClosed } = applyFillsV4(
    state.cycle,
    fills,
    trading,
    todayClose,
  );
  state.cycle = next;
  state.lastSettleDate = settleDate;
  await saveState(state);

  // 체결 로그 (실체결만)
  for (const f of fills) {
    const log: TradeLog = {
      timestamp: new Date().toISOString(),
      date: settleDate,
      kind: f.kind,
      side: pending.orders.find((p) => p.orderId === f.orderId)?.side ?? "buy",
      ticker: trading.ticker,
      price: f.filledPrice,
      quantity: f.filledQuantity,
      amount: f.filledAmount,
      orderId: f.orderId,
      cycleNumber: state.cycle.cycleNumber,
      avgCost: state.cycle.avgCost,
      totalShares: state.cycle.totalShares,
      T: state.cycle.T,
      mode: state.cycle.mode,
      cashRemaining: state.cycle.cycleCash,
      reason: `실체결: ${f.kind} ${f.filledQuantity}주 @ $${f.filledPrice.toFixed(2)}`,
    };
    await logTrade(log);
  }

  // 알림 요약
  const lines = [
    `<b>${trading.ticker} V4 체결 정산</b>`,
    `거래일: ${settleDate}`,
    `오늘 종가: $${todayClose.toFixed(2)}`,
    `체결: ${fills.length}건 / 펜딩 ${pending.orders.length}건`,
    cycleClosed ? `<b>✅ 사이클 #${state.cycle.cycleNumber - 1} 종료</b>` : "",
    ``,
    `T: ${state.cycle.T.toFixed(2)} / mode: ${state.cycle.mode}`,
    `평단: $${state.cycle.avgCost.toFixed(2)} / 보유: ${state.cycle.totalShares}주`,
    `잔금: $${state.cycle.cycleCash.toFixed(2)}`,
    ``,
    ...fills.map(
      (f) => `· ${f.kind} ${f.filledQuantity}주 @ $${f.filledPrice.toFixed(2)}`,
    ),
  ].filter(Boolean);
  await sendTelegram(lines.join("\n"));

  // 펜딩 정리
  await deletePendingDay(settleDate);

  return {
    success: true,
    message: `${fills.length}건 체결 적용 완료`,
    date: settleDate,
    fills: fills.length,
    cycleClosed,
  };
}
