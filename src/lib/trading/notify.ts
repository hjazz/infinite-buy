import type { TradeLog } from "./types";

const actionLabels: Record<string, string> = {
  buy_full: "매수(1배)",
  buy_half: "매수(0.5배)",
  sell: "전량매도",
  quarter_sell: "쿼터손절(25%)",
  hold: "홀드",
  skip: "스킵",
};

function formatTelegramMessage(log: TradeLog): string {
  const lines = [
    `<b>${log.ticker} ${actionLabels[log.action] || log.action}</b>`,
    `날짜: ${log.date}`,
    `가격: $${log.price.toFixed(2)}`,
  ];

  if (log.action !== "hold") {
    lines.push(`수량: ${log.quantity.toFixed(4)}주`);
    lines.push(`금액: $${log.amount.toFixed(2)}`);
    if (log.orderId) lines.push(`주문번호: ${log.orderId}`);
  }

  lines.push(
    ``,
    `사이클: #${log.cycleNumber}`,
    `평균단가: $${log.avgCost.toFixed(2)}`,
    `보유: ${log.totalShares.toFixed(4)}주`,
    `라운드: ${log.roundsUsed}`,
    `잔여현금: $${log.cashRemaining.toFixed(2)}`,
    ``,
    `<i>${log.reason}</i>`,
  );

  return lines.join("\n");
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
  await sendTelegram(`<b>자동매매 오류</b>\n\n${error}`);
}

export async function notifyStart(
  ticker: string,
  mode: string,
): Promise<void> {
  await sendTelegram(
    `<b>무한매수법 엔진 시작</b>\n종목: ${ticker}\n모드: ${mode}`,
  );
}
