"use client";

import { useState } from "react";
import type { BacktestInput, BacktestResult, StockData } from "@/lib/types";
import { runBacktest } from "@/lib/backtest";
import BacktestForm from "@/components/BacktestForm";
import BacktestChart from "@/components/BacktestChart";
import ResultSummary from "@/components/ResultSummary";
import TradeTable from "@/components/TradeTable";

export default function Home() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [rounds, setRounds] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: BacktestInput) {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        ticker: input.ticker,
        start: input.startDate,
        end: input.endDate,
      });

      const res = await fetch(`/api/stock?${params}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "주가 데이터를 가져오는데 실패했습니다");
      }

      const stockData: StockData[] = json.data;
      if (stockData.length === 0) {
        throw new Error("해당 기간의 주가 데이터가 없습니다");
      }

      const backtestResult = runBacktest(input, stockData);
      setRounds(input.rounds);
      setResult(backtestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">무한매수법 백테스트</h1>
        <p className="text-sm text-gray-500">
          라오어의 무한매수법(V1) 시뮬레이터 — 과거 데이터 기반 백테스트
        </p>
      </div>

      <BacktestForm onSubmit={handleSubmit} loading={loading} />

      {error && (
        <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <ResultSummary result={result} />
          <BacktestChart records={result.records} buyHold={result.buyHold} />
          <TradeTable records={result.records} totalRounds={rounds} />
        </div>
      )}
    </main>
  );
}
