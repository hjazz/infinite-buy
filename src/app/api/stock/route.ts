import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance();

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const ticker = searchParams.get("ticker");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!ticker || !start || !end) {
    return NextResponse.json(
      { error: "ticker, start, end parameters are required" },
      { status: 400 }
    );
  }

  try {
    const result = await yf.chart(ticker, {
      period1: start,
      period2: end,
      interval: "1d",
    });

    const data = (result.quotes ?? [])
      .filter((q) => q.close != null)
      .map((q) => ({
        date: new Date(q.date).toISOString().split("T")[0],
        close: Math.round(q.close! * 100) / 100,
      }));

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
