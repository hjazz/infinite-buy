import { config } from "dotenv";
config({ path: ".env.local" });
config();
import * as cron from "node-cron";
import type { KISConfig } from "../lib/kis/types";
import type { TradingConfig } from "../lib/trading/types";
import { runV4Reservation, runV4Settlement } from "../lib/trading/v4-runner";
import { sendTelegram } from "../lib/trading/notify";

function loadKISConfig(): KISConfig {
  const required = ["KIS_APP_KEY", "KIS_APP_SECRET", "KIS_ACCOUNT_NO"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`환경변수 ${key}가 설정되지 않았습니다.`);
    }
  }

  const isMock = process.env.KIS_MOCK !== "false";

  return {
    appKey: process.env.KIS_APP_KEY!,
    appSecret: process.env.KIS_APP_SECRET!,
    accountNo: process.env.KIS_ACCOUNT_NO!,
    accountProduct: process.env.KIS_ACCOUNT_PRODUCT || "01",
    baseUrl: isMock
      ? "https://openapivts.koreainvestment.com:29443"
      : "https://openapi.koreainvestment.com:9443",
    isMock,
  };
}

function loadTradingConfig(): TradingConfig {
  return {
    ticker: process.env.TRADING_TICKER || "TQQQ",
    totalCapital: Number(process.env.TRADING_TOTAL_CAPITAL) || 10000,
    rounds: Number(process.env.TRADING_ROUNDS) || 40,
    targetReturn: Number(process.env.TRADING_TARGET_RETURN) || 0.15,
    exchange:
      (process.env.TRADING_EXCHANGE as "NASD" | "NYSE" | "AMEX") || "NASD",
    locPriceMargin: Number(process.env.TRADING_LOC_MARGIN) || 0.05,
    maxDailyOrderAmount: Number(process.env.TRADING_MAX_DAILY_AMOUNT) || 5000,
  };
}

const kisConfig = loadKISConfig();
const tradingConfig = loadTradingConfig();

// V4 2단 크론
//  - 아침 (KST 23:00 ≒ ET 09:00): LOC 예약 제출
//  - 정산 (다음날 KST 06:30 ≒ ET 16:30 = 장마감 30분 후): 체결 확정
const RESERVATION_SCHEDULE =
  process.env.RESERVATION_CRON_SCHEDULE || "0 23 * * 1-5";
const SETTLE_SCHEDULE = process.env.SETTLE_CRON_SCHEDULE || "30 6 * * 2-6";
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || "Asia/Seoul";

async function executeReservation() {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  console.log(`\n[Cron/Reservation] ${now}`);
  try {
    const result = await runV4Reservation(kisConfig, tradingConfig);
    console.log(`[Cron/Reservation] ${result.message}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Cron/Reservation] 오류: ${msg}`);
    await sendTelegram(`<b>V4 예약 오류</b>\n${msg}`);
  }
}

async function executeSettlement() {
  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  console.log(`\n[Cron/Settle] ${now}`);
  try {
    const result = await runV4Settlement(kisConfig, tradingConfig);
    console.log(`[Cron/Settle] ${result.message}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Cron/Settle] 오류: ${msg}`);
    await sendTelegram(`<b>V4 정산 오류</b>\n${msg}`);
  }
}

console.log("═══════════════════════════════════════");
console.log("  무한매수법 V4 자동매매 스케줄러");
console.log("═══════════════════════════════════════");
console.log(`모드: ${kisConfig.isMock ? "모의투자" : "실전투자"}`);
console.log(`종목: ${tradingConfig.ticker}`);
console.log(`예약 스케줄: ${RESERVATION_SCHEDULE} (${CRON_TIMEZONE})`);
console.log(`정산 스케줄: ${SETTLE_SCHEDULE} (${CRON_TIMEZONE})`);
console.log("───────────────────────────────────────");
console.log("스케줄러 대기 중... (Ctrl+C로 종료)\n");

cron.schedule(RESERVATION_SCHEDULE, executeReservation, {
  timezone: CRON_TIMEZONE,
});
cron.schedule(SETTLE_SCHEDULE, executeSettlement, { timezone: CRON_TIMEZONE });
