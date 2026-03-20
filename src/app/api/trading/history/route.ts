import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const LOG_DIR = join(process.cwd(), "data", "logs");

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const limit = Number(searchParams.get("limit")) || 50;
  const offset = Number(searchParams.get("offset")) || 0;

  if (!existsSync(LOG_DIR)) {
    return NextResponse.json({ trades: [], total: 0 });
  }

  // 모든 로그 파일을 역순으로 읽기 (최신 먼저)
  const files = readdirSync(LOG_DIR)
    .filter((f) => f.startsWith("trades-") && f.endsWith(".jsonl"))
    .sort()
    .reverse();

  const allTrades: unknown[] = [];

  for (const file of files) {
    const content = readFileSync(join(LOG_DIR, file), "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        allTrades.push(JSON.parse(lines[i]));
      } catch {
        // skip malformed lines
      }
    }
  }

  return NextResponse.json({
    trades: allTrades.slice(offset, offset + limit),
    total: allTrades.length,
  });
}
