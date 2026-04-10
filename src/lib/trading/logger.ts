import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { TradeLog, OrderKind } from "./types";
import { redis } from "../storage";

const LOG_DIR = join(process.cwd(), "data", "logs");
const REDIS_KEY = "trading:logs";
const MAX_LOGS = 1000;

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export async function logTrade(log: TradeLog): Promise<void> {
  if (redis) {
    await redis.rpush(REDIS_KEY, JSON.stringify(log));
    await redis.ltrim(REDIS_KEY, -MAX_LOGS, -1);
    return;
  }
  ensureLogDir();
  const month = new Date().toISOString().slice(0, 7);
  const file = join(LOG_DIR, `trades-${month}.jsonl`);
  appendFileSync(file, JSON.stringify(log) + "\n", "utf-8");
}

export const kindLabels: Record<OrderKind, string> = {
  buy_half_star: "매수 0.5×별지점",
  buy_half_avg: "매수 0.5×평단",
  buy_full_star: "매수 1×별지점",
  quarter_sell_star: "쿼터매도",
  final_sell_target: "익절매도",
  reverse_moc_sell: "리버스 MOC 매도",
  reverse_ladder_sell: "리버스 ladder 매도",
  reverse_quarter_buy: "리버스 쿼터매수",
};

export function formatTradeLog(log: TradeLog): string {
  return [
    ``,
    `━━━ ${log.date} ${log.ticker} (${log.mode}) ━━━`,
    `  체결: ${kindLabels[log.kind] || log.kind}`,
    `  단가: $${log.price.toFixed(2)}`,
    `  수량: ${log.quantity}주`,
    `  금액: $${log.amount.toFixed(2)}`,
    `  주문번호: ${log.orderId}`,
    `  사이클: #${log.cycleNumber}`,
    `  평균단가: $${log.avgCost.toFixed(2)}`,
    `  보유수량: ${log.totalShares}주`,
    `  T: ${log.T.toFixed(2)}`,
    `  잔여현금: $${log.cashRemaining.toFixed(2)}`,
    `  사유: ${log.reason}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].join("\n");
}
