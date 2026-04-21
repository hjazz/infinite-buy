import { NextResponse } from "next/server";
import { redis } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";

const REDIS_KEY = "journal:data";
const FILE_PATH = path.join(process.cwd(), "data", "journal.json");

async function loadJournal(): Promise<unknown> {
  if (redis) {
    return await redis.get(REDIS_KEY);
  }
  try {
    const raw = await fs.readFile(FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveJournal(data: unknown): Promise<void> {
  if (redis) {
    await redis.set(REDIS_KEY, data);
    return;
  }
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2));
}

export async function GET() {
  const data = await loadJournal();
  return NextResponse.json(data ?? null);
}

export async function POST(req: Request) {
  const body = await req.json();
  await saveJournal(body);
  return NextResponse.json({ ok: true });
}
