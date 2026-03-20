import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { TradingState, TradingConfig } from "./types";

const STATE_DIR = join(process.cwd(), "data");
const STATE_FILE = join(STATE_DIR, "trading-state.json");

function ensureDir(): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

export function loadState(): TradingState | null {
  if (!existsSync(STATE_FILE)) return null;

  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as TradingState;
  } catch {
    return null;
  }
}

export function saveState(state: TradingState): void {
  ensureDir();
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
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
      roundsUsed: 0,
      cycleCash: config.totalCapital,
      totalCash: config.totalCapital,
    },
    lastTradeDate: "",
    createdAt: now,
    updatedAt: now,
  };
}
