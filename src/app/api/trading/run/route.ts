import { NextResponse } from "next/server";
import { runV4Reservation } from "@/lib/trading/v4-runner";
import type { KISConfig } from "@/lib/kis/types";
import type { TradingConfig } from "@/lib/trading/types";

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
      targetReturn: Number(process.env.TRADING_TARGET_RETURN) || 0.15,
      exchange:
        (process.env.TRADING_EXCHANGE as "NASD" | "NYSE" | "AMEX") || "NASD",
      locPriceMargin: Number(process.env.TRADING_LOC_MARGIN) || 0.05,
      maxDailyOrderAmount:
        Number(process.env.TRADING_MAX_DAILY_AMOUNT) || 5000,
    },
  };
}

export async function POST() {
  const configs = loadConfigs();

  if (!configs) {
    return NextResponse.json(
      { error: "KIS API 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const result = await runV4Reservation(configs.kis, configs.trading);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
