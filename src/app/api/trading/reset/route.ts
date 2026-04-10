import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/storage";
import { clearState, initState, saveState } from "@/lib/trading/state";
import { clearAllPending } from "@/lib/trading/pending";
import { existsSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import type { TradingConfig } from "@/lib/trading/types";

const DATA_DIR = join(process.cwd(), "data");
const LOG_DIR = join(DATA_DIR, "logs");

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

/**
 * 모의→실전 전환을 위한 1회성 초기화 엔드포인트.
 *
 * 동작:
 *  - trading:state, trading:logs, trading:reservation:*, trading:pending:* 키 삭제
 *  - data/trading-state.json, data/reservation.json, data/logs/*, data/pending/* 삭제
 *  - 새 V4 state 를 $10,000 / 40rounds / mode=normal 로 init 후 저장
 *
 * 인증: Authorization: Bearer {CRON_SECRET}
 *
 * 작업 완료 후 이 라우트는 삭제할 것.
 */
async function executeReset() {
  const cleared: string[] = [];

  // Redis 키 삭제
  if (redis) {
    try {
      await redis.del("trading:state");
      cleared.push("redis:trading:state");
    } catch (err) {
      cleared.push(`redis:trading:state FAIL ${(err as Error).message}`);
    }
    try {
      await redis.del("trading:logs");
      cleared.push("redis:trading:logs");
    } catch (err) {
      cleared.push(`redis:trading:logs FAIL ${(err as Error).message}`);
    }
    // 알려진 reservation/pending 키 best-effort 삭제 (1주일치)
    const today = new Date();
    for (let i = -7; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const date = d.toISOString().split("T")[0];
      try {
        await redis.del(`trading:reservation:${date}`);
        await redis.del(`trading:pending:${date}`);
      } catch {
        // ignore
      }
    }
    cleared.push("redis:trading:reservation:* (best-effort)");
    cleared.push("redis:trading:pending:* (best-effort)");
  }

  // 파일 삭제
  await clearState();
  cleared.push("file:data/trading-state.json");

  await clearAllPending();
  cleared.push("file:data/pending/*");

  const reservationFile = join(DATA_DIR, "reservation.json");
  if (existsSync(reservationFile)) {
    unlinkSync(reservationFile);
    cleared.push("file:data/reservation.json");
  }

  if (existsSync(LOG_DIR)) {
    for (const f of readdirSync(LOG_DIR)) {
      try {
        unlinkSync(join(LOG_DIR, f));
        cleared.push(`file:data/logs/${f}`);
      } catch {
        // ignore
      }
    }
  }

  // 새 V4 state 초기화
  const config = loadTradingConfig();
  const fresh = initState(config);
  await saveState(fresh);
  cleared.push("init:new V4 state saved");

  return NextResponse.json({
    success: true,
    cleared,
    state: fresh,
  });
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "CRON_SECRET 인증 필요" },
      { status: 401 },
    );
  }
  return executeReset();
}
