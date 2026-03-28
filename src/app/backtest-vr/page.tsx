"use client";

import { useState } from "react";
import type { VRInput, VRResult, StockData } from "@/lib/types";
import { runBacktestVR } from "@/lib/backtest-vr";
import VRChart from "@/components/VRChart";
import VRResultSummary from "@/components/VRResultSummary";
import NavTabs from "@/components/NavTabs";

const DEFAULT_INPUT: VRInput = {
  ticker: "TQQQ",
  startDate: "2020-01-02",
  endDate: "2024-12-31",
  initialV: 5000,
  initialPool: 0,
  G: 10,
  bandPct: 0.15,
  depositPerCycle: 250,
  poolUsageLimit: 0.75,
  dcaMonthlyAmount: 500,
};

export default function BacktestVRPage() {
  const [form, setForm] = useState<VRInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<VRResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    const numFields = [
      "initialV", "initialPool", "G", "bandPct", "depositPerCycle",
      "poolUsageLimit", "dcaMonthlyAmount",
    ];
    setForm((prev) => ({
      ...prev,
      [name]: numFields.includes(name) ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        ticker: form.ticker,
        start: form.startDate,
        end: form.endDate,
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

      const vrResult = runBacktestVR(form, stockData);
      setResult(vrResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <NavTabs />
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">밸류 리밸런싱(VR) 백테스트</h1>
        <p className="text-sm text-gray-500">
          라오어의 밸류 리밸런싱 전략 — 2주 주기 V 추적 시뮬레이터
        </p>
      </div>

      {/* 전략 설명 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-6 text-sm space-y-1 text-gray-400">
        <p className="text-gray-200 font-medium mb-2">밸류 리밸런싱(VR) 핵심 규칙</p>
        <p>
          <span className="text-gray-300">V (목표 평가금)</span> — 주식 평가금이 따라가야 할 목표선.
          2주마다 <code className="text-gray-300">V += Pool/G + 적립금</code>으로 갱신
        </p>
        <p>
          <span className="text-gray-300">밴드 ±{Math.round(form.bandPct * 100)}%</span> —
          평가금 &lt; V×(1−밴드) 시 <span className="text-green-400">매수</span> /
          평가금 &gt; V×(1+밴드) 시 <span className="text-red-400">매도</span> /
          그 사이 <span className="text-gray-400">홀드</span>
        </p>
        <p>
          <span className="text-gray-300">Pool 사용 제한</span> — 1사이클당 Pool의 최대 {Math.round(form.poolUsageLimit * 100)}%까지 매수에 사용
        </p>
        <p>
          <span className="text-gray-300">G (Gradient)</span> = {form.G} —
          적립식/거치식은 10, 인출식은 20 권장
        </p>
      </div>

      {/* 입력 폼 */}
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-5 mb-6"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 종목 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">종목 (Ticker)</label>
            <input
              type="text"
              name="ticker"
              value={form.ticker}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 시작일 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 종료일 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 초기 V */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">초기 V ($)</label>
            <input
              type="number"
              name="initialV"
              value={form.initialV}
              onChange={handleChange}
              min={100}
              step={100}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 초기 Pool */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">초기 Pool ($)</label>
            <input
              type="number"
              name="initialPool"
              value={form.initialPool}
              onChange={handleChange}
              min={0}
              step={100}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* G */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">G (Gradient)</label>
            <input
              type="number"
              name="G"
              value={form.G}
              onChange={handleChange}
              min={1}
              step={1}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 밴드 % */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">밴드 %</label>
            <select
              name="bandPct"
              value={form.bandPct}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={0.05}>5%</option>
              <option value={0.10}>10%</option>
              <option value={0.15}>15%</option>
            </select>
          </div>

          {/* 적립금/2주 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">적립금/2주 ($)</label>
            <input
              type="number"
              name="depositPerCycle"
              value={form.depositPerCycle}
              onChange={handleChange}
              min={0}
              step={50}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Pool 사용 제한 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Pool 사용 제한 %</label>
            <select
              name="poolUsageLimit"
              value={form.poolUsageLimit}
              onChange={handleChange}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value={0.25}>25% (인출식)</option>
              <option value={0.50}>50% (거치식)</option>
              <option value={0.75}>75% (적립식)</option>
            </select>
          </div>

          {/* DCA 월 적립금 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">DCA 월 적립금 ($)</label>
            <input
              type="number"
              name="dcaMonthlyAmount"
              value={form.dcaMonthlyAmount}
              onChange={handleChange}
              min={0}
              step={100}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition"
          >
            {loading ? "계산 중..." : "백테스트 실행"}
          </button>
          <button
            type="button"
            onClick={() => setForm(DEFAULT_INPUT)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-400 transition"
          >
            초기화
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <VRChart records={result.records} buyHold={result.buyHold} dca={result.dca} />
          <VRResultSummary result={result} />
        </div>
      )}
    </main>
  );
}
