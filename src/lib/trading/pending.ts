import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import type { PendingDay, PendingOrder } from "./types";
import { redis } from "../storage";

const DATA_DIR = join(process.cwd(), "data");
const PENDING_DIR = join(DATA_DIR, "pending");

function ensureDir(): void {
  if (!existsSync(PENDING_DIR)) mkdirSync(PENDING_DIR, { recursive: true });
}

function key(date: string): string {
  return `trading:pending:${date}`;
}

function file(date: string): string {
  return join(PENDING_DIR, `${date}.json`);
}

export async function savePendingDay(day: PendingDay): Promise<void> {
  if (redis) {
    await redis.set(key(day.date), day, { ex: 60 * 60 * 72 }); // 72h
    return;
  }
  ensureDir();
  writeFileSync(file(day.date), JSON.stringify(day, null, 2), "utf-8");
}

export async function loadPendingDay(date: string): Promise<PendingDay | null> {
  if (redis) {
    return await redis.get<PendingDay>(key(date));
  }
  if (!existsSync(file(date))) return null;
  try {
    return JSON.parse(readFileSync(file(date), "utf-8")) as PendingDay;
  } catch {
    return null;
  }
}

export async function appendPendingOrder(
  date: string,
  order: PendingOrder,
): Promise<void> {
  const existing = (await loadPendingDay(date)) ?? { date, orders: [] };
  existing.orders.push(order);
  await savePendingDay(existing);
}

export async function deletePendingDay(date: string): Promise<void> {
  if (redis) {
    await redis.del(key(date));
    return;
  }
  if (existsSync(file(date))) unlinkSync(file(date));
}

export async function clearAllPending(): Promise<void> {
  if (redis) {
    // Upstash Redis JS client에는 SCAN이 있지만 패턴 삭제가 번거로움.
    // 호출 빈도가 낮으므로 알려진 키 1주일치를 best-effort 로 삭제.
    const today = new Date();
    for (let i = -3; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const date = d.toISOString().split("T")[0];
      try {
        await redis.del(key(date));
      } catch {
        // ignore
      }
    }
    return;
  }
  if (!existsSync(PENDING_DIR)) return;
  for (const f of readdirSync(PENDING_DIR)) {
    try {
      unlinkSync(join(PENDING_DIR, f));
    } catch {
      // ignore
    }
  }
}
