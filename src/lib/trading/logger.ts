import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { TradeLog } from "./types";

const LOG_DIR = join(process.cwd(), "data", "logs");

function ensureLogDir(): void {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function logTrade(log: TradeLog): void {
  ensureLogDir();
  const month = new Date().toISOString().slice(0, 7);
  const file = join(LOG_DIR, `trades-${month}.jsonl`);
  appendFileSync(file, JSON.stringify(log) + "\n", "utf-8");
}

const actionLabels: Record<string, string> = {
  buy_full: "매수(1배)",
  buy_half: "매수(0.5배)",
  sell: "전량매도",
  quarter_sell: "쿼터손절(25%)",
  hold: "홀드",
};

export function formatTradeLog(log: TradeLog): string {
  const lines = [
    ``,
    `━━━ ${log.date} ${log.ticker} ━━━`,
    `  액션: ${actionLabels[log.action] || log.action}`,
    `  가격: $${log.price.toFixed(2)}`,
  ];

  if (log.action !== "hold") {
    lines.push(
      `  수량: ${log.quantity.toFixed(4)}주`,
      `  금액: $${log.amount.toFixed(2)}`,
    );
    if (log.orderId) {
      lines.push(`  주문번호: ${log.orderId}`);
    }
  }

  lines.push(
    `  사이클: #${log.cycleNumber}`,
    `  평균단가: $${log.avgCost.toFixed(2)}`,
    `  보유수량: ${log.totalShares.toFixed(4)}주`,
    `  사용라운드: ${log.roundsUsed}`,
    `  잔여현금: $${log.cashRemaining.toFixed(2)}`,
    `  사유: ${log.reason}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  );

  return lines.join("\n");
}
