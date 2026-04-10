import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import type { TradingState, TradingConfig } from "./types";
import { redis } from "../storage";

const STATE_DIR = join(process.cwd(), "data");
const STATE_FILE = join(STATE_DIR, "trading-state.json");
const REDIS_KEY = "trading:state";

function ensureDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

export async function loadState(): Promise<TradingState | null> {
  if (redis) {
    return await redis.get<TradingState>(REDIS_KEY);
  }
  if (!existsSync(STATE_FILE)) return null;
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as TradingState;
  } catch {
    return null;
  }
}

export async function saveState(state: TradingState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  if (redis) {
    await redis.set(REDIS_KEY, state);
    return;
  }
  ensureDir();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export async function clearState(): Promise<void> {
  if (redis) {
    await redis.del(REDIS_KEY);
    return;
  }
  if (existsSync(STATE_FILE)) {
    unlinkSync(STATE_FILE);
  }
}

export function initState(config: TradingConfig): TradingState {
  const now = new Date().toISOString();
  return {
    config,
    cycle: {
      cycleNumber: 1,
      startDate: now.split("T")[0],
      totalShares: 0,
      avgCost: 0,
      T: 0,
      cycleCash: config.totalCapital,
      totalCash: config.totalCapital,
      mode: "normal",
      recentCloses: [],
      reverseFirstDay: false,
    },
    lastTradeDate: "",
    lastSettleDate: "",
    createdAt: now,
    updatedAt: now,
  };
}
