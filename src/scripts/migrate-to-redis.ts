/**
 * 로컬 파일시스템 데이터를 Upstash Redis로 마이그레이션
 * 실행: npx tsx src/scripts/migrate-to-redis.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { Redis } from "@upstash/redis";

const DATA_DIR = join(process.cwd(), "data");
const LOG_DIR = join(DATA_DIR, "logs");

async function main() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    console.error("UPSTASH_REDIS_REST_URL / TOKEN 환경변수가 없습니다.");
    process.exit(1);
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // 1. trading-state.json 마이그레이션
  const stateFile = join(DATA_DIR, "trading-state.json");
  if (existsSync(stateFile)) {
    const state = JSON.parse(readFileSync(stateFile, "utf-8"));
    await redis.set("trading:state", state);
    console.log("✓ trading:state 업로드 완료");
  }

  // 2. reservation.json 마이그레이션
  const resvFile = join(DATA_DIR, "reservation.json");
  if (existsSync(resvFile)) {
    const resv = JSON.parse(readFileSync(resvFile, "utf-8"));
    const today = new Date().toISOString().split("T")[0];
    if (resv.date === today) {
      await redis.set(`trading:reservation:${today}`, resv, {
        ex: 60 * 60 * 48,
      });
      console.log(`✓ trading:reservation:${today} 업로드 완료`);
    } else {
      console.log("ℹ reservation.json은 오늘 날짜가 아니라 스킵합니다.");
    }
  }

  // 3. 거래 로그 마이그레이션
  if (!existsSync(LOG_DIR)) {
    console.log("ℹ 로그 파일이 없습니다.");
    return;
  }

  const files = readdirSync(LOG_DIR)
    .filter((f) => f.startsWith("trades-") && f.endsWith(".jsonl"))
    .sort();

  const allLogs: string[] = [];
  for (const file of files) {
    const lines = readFileSync(join(LOG_DIR, file), "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean);
    allLogs.push(...lines);
  }

  if (allLogs.length === 0) {
    console.log("ℹ 거래 로그가 없습니다.");
    return;
  }

  // 기존 Redis 로그 삭제 후 재업로드
  await redis.del("trading:logs");
  for (const line of allLogs) {
    await redis.rpush("trading:logs", line);
  }

  console.log(`✓ trading:logs ${allLogs.length}건 업로드 완료`);
  console.log("\n마이그레이션 완료!");
}

main().catch((err) => {
  console.error("오류:", err);
  process.exit(1);
});
