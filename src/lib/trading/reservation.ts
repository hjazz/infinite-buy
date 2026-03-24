import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

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

export function getTodayReservation(): ReservationState | null {
  if (!existsSync(RESV_FILE)) return null;
  try {
    const state = JSON.parse(readFileSync(RESV_FILE, "utf-8")) as ReservationState;
    const today = new Date().toISOString().split("T")[0];
    return state.date === today ? state : null;
  } catch {
    return null;
  }
}

export function saveReservation(state: ReservationState): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(RESV_FILE, JSON.stringify(state, null, 2), "utf-8");
}
