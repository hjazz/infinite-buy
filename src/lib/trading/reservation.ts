import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { redis } from "../storage";

const DATA_DIR = join(process.cwd(), "data");
const RESV_FILE = join(DATA_DIR, "reservation.json");

export interface ReservationState {
  date: string;
  orderId: string;
  action: string;
  ticker: string;
  quantity: number;
  price: number;
  amount: number;
  reason: string;
  createdAt: string;
}

export async function getTodayReservation(): Promise<ReservationState | null> {
  const today = new Date().toISOString().split("T")[0];
  if (redis) {
    return await redis.get<ReservationState>(`trading:reservation:${today}`);
  }
  if (!existsSync(RESV_FILE)) return null;
  try {
    const state = JSON.parse(readFileSync(RESV_FILE, "utf-8")) as ReservationState;
    return state.date === today ? state : null;
  } catch {
    return null;
  }
}

export async function saveReservation(state: ReservationState): Promise<void> {
  if (redis) {
    // 48시간 TTL (당일 유효)
    await redis.set(`trading:reservation:${state.date}`, state, { ex: 60 * 60 * 48 });
    return;
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(RESV_FILE, JSON.stringify(state, null, 2), "utf-8");
}
