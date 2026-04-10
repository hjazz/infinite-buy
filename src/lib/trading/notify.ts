import type { TradeLog } from "./types";
import { kindLabels } from "./logger";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTelegramMessage(log: TradeLog): string {
  return [
    `<b>${log.ticker} ${kindLabels[log.kind] || log.kind}</b>`,
    `날짜: ${log.date} (${log.mode})`,
    `단가: $${log.price.toFixed(2)}`,
    `수량: ${log.quantity}주`,
    `금액: $${log.amount.toFixed(2)}`,
    `주문번호: ${log.orderId}`,
    ``,
    `사이클: #${log.cycleNumber}`,
    `평균단가: $${log.avgCost.toFixed(2)}`,
    `보유: ${log.totalShares}주`,
    `T: ${log.T.toFixed(2)}`,
    `잔여현금: $${log.cashRemaining.toFixed(2)}`,
    ``,
    `<i>${escapeHtml(log.reason)}</i>`,
  ].join("\n");
}

export async function sendTelegram(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("[Notify] 텔레그램 전송 실패:", err);
  }
}

export async function notifyTrade(log: TradeLog): Promise<void> {
  await sendTelegram(formatTelegramMessage(log));
}

export async function notifyError(error: string): Promise<void> {
  await sendTelegram(`<b>자동매매 오류</b>\n\n${escapeHtml(error)}`);
}
