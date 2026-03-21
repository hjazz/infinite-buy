import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env
import type { KISConfig } from "../lib/kis/types";
import type { TradingConfig } from "../lib/trading/types";
import { runTradingEngine } from "../lib/trading/engine";

function loadKISConfig(): KISConfig {
  const required = ["KIS_APP_KEY", "KIS_APP_SECRET", "KIS_ACCOUNT_NO"];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `환경변수 ${key}가 설정되지 않았습니다. .env.local 파일을 확인하세요.`,
      );
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

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  무한매수법 자동매매 엔진 v1.0");
  console.log("═══════════════════════════════════════");

  const kisConfig = loadKISConfig();
  const tradingConfig = loadTradingConfig();

  console.log(`모드: ${kisConfig.isMock ? "모의투자" : "실전투자"}`);
  console.log(`종목: ${tradingConfig.ticker}`);
  console.log(`총 자본: $${tradingConfig.totalCapital.toLocaleString()}`);
  console.log(`라운드: ${tradingConfig.rounds}회`);
  console.log(`목표 수익률: ${(tradingConfig.targetReturn * 100).toFixed(1)}%`);
  console.log("───────────────────────────────────────");

  const result = await runTradingEngine(kisConfig, tradingConfig);

  if (result.success) {
    console.log(`\n완료: ${result.message}`);
  } else {
    console.error(`\n실패: ${result.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("치명적 오류:", err);
  process.exit(1);
});
