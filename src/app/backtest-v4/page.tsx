"use client";

import { useState } from "react";
import type { BacktestInput, BacktestResult, StockData } from "@/lib/types";
import { runBacktestV4 } from "@/lib/backtest-v4";
import BacktestForm from "@/components/BacktestForm";
import BacktestChart from "@/components/BacktestChart";
import ResultSummary from "@/components/ResultSummary";
import TradeTable from "@/components/TradeTable";

export default function BacktestV4Page() {
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

      const backtestResult = runBacktestV4(input, stockData);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">무한매수법 V4.0 시뮬레이터</h1>
          <p className="text-sm text-gray-500">
            별지점·동적 매수금·리버스모드 적용 — 과거 데이터 기반 시뮬레이션
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <a href="/" className="text-gray-400 hover:text-gray-200 transition">
            V1 백테스트
          </a>
          <a href="/trading" className="text-gray-400 hover:text-gray-200 transition">
            트레이딩 대시보드 &rarr;
          </a>
        </div>
      </div>

      {/* V4 핵심 규칙 요약 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-6 text-sm space-y-1 text-gray-400">
        <p className="text-gray-200 font-medium mb-2">V4.0 핵심 규칙</p>
        <p>• <span className="text-gray-300">별지점</span> = avgCost × (1 + (15 − 0.75×T)%) — T가 클수록 목표가 낮아짐</p>
        <p>• <span className="text-gray-300">1회 매수금</span> = 잔금 / (분할수 − T) — 동적 계산</p>
        <p>• <span className="text-gray-300">전반전</span>(T &lt; rounds/2): 별지점 아래 0.5배, avgCost 아래 1배</p>
        <p>• <span className="text-gray-300">후반전</span>(T ≥ rounds/2): 별지점 아래 1배 (별지점 ≤ avgCost)</p>
        <p>• <span className="text-gray-300">익절</span>: close ≥ avgCost×1.15 → 전량매도 / close ≥ 별지점 → 쿼터 T×0.75</p>
        <p>• <span className="text-gray-300">리버스모드</span>(T &gt; rounds−1): 5일MA 기준 매도·쿼터매수, close &gt; avgCost×0.85 복귀</p>
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
          <BacktestChart records={result.records} buyHold={result.buyHold} dca={result.dca} />
          <TradeTable records={result.records} totalRounds={rounds} />
        </div>
      )}
    </main>
  );
}
