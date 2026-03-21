import { config } from "dotenv";
config({ path: ".env.local" });
config();
import * as cron from "node-cron";
import type { KISConfig } from "../lib/kis/types";
import type { TradingConfig } from "../lib/trading/types";
import { runTradingEngine } from "../lib/trading/engine";
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
    targetReturn: Number(process.env.TRADING_TARGET_RETURN) || 0.1,
    exchange:
      (process.env.TRADING_EXCHANGE as "NASD" | "NYSE" | "AMEX") || "NASD",
    locPriceMargin: Number(process.env.TRADING_LOC_MARGIN) || 0.05,
    maxDailyOrderAmount: Number(process.env.TRADING_MAX_DAILY_AMOUNT) || 5000,
  };
}

const kisConfig = loadKISConfig();
const tradingConfig = loadTradingConfig();

// 매일 미국 동부시간 15:30 (장마감 30분 전) 실행 — 서머/윈터타임 자동 처리
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || "30 15 * * 1-5";
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || "America/New_York";

async function executeTrade() {
  const now = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  console.log(`\n[Cron] ${now} - 자동매매 실행`);

  try {
    const result = await runTradingEngine(kisConfig, tradingConfig);

    if (result.success) {
      console.log(`[Cron] 완료: ${result.message}`);
    } else {
      console.error(`[Cron] 실패: ${result.message}`);
      await sendTelegram(`<b>자동매매 실패</b>\n${result.message}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Cron] 오류: ${msg}`);
    await sendTelegram(`<b>자동매매 오류</b>\n${msg}`);
  }
}

console.log("═══════════════════════════════════════");
console.log("  무한매수법 자동매매 스케줄러");
console.log("═══════════════════════════════════════");
console.log(`모드: ${kisConfig.isMock ? "모의투자" : "실전투자"}`);
console.log(`종목: ${tradingConfig.ticker}`);
console.log(`스케줄: ${CRON_SCHEDULE} (${CRON_TIMEZONE})`);
console.log("───────────────────────────────────────");
console.log("스케줄러 대기 중... (Ctrl+C로 종료)\n");

cron.schedule(CRON_SCHEDULE, executeTrade, { timezone: CRON_TIMEZONE });
