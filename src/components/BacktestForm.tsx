"use client";

import type { BacktestInput } from "@/lib/types";

interface Props {
  onSubmit: (input: BacktestInput) => void;
  loading: boolean;
}

export default function BacktestForm({ onSubmit, loading }: Props) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      ticker: (fd.get("ticker") as string).toUpperCase(),
      startDate: fd.get("startDate") as string,
      endDate: fd.get("endDate") as string,
      totalCapital: Number(fd.get("totalCapital")),
      rounds: Number(fd.get("rounds")),
      targetReturn: Number(fd.get("targetReturn")) / 100,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-900 rounded-2xl p-6 border border-gray-800"
    >
      <h2 className="text-lg font-semibold mb-4">백테스트 설정</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">종목 (티커)</label>
          <input
            name="ticker"
            defaultValue="TQQQ"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">시작일</label>
          <input
            name="startDate"
            type="date"
            defaultValue="2020-01-02"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">종료일</label>
          <input
            name="endDate"
            type="date"
            defaultValue="2024-12-31"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            총 투자금 ($)
          </label>
          <input
            name="totalCapital"
            type="number"
            defaultValue={10000}
            min={100}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">분할 횟수</label>
          <input
            name="rounds"
            type="number"
            defaultValue={40}
            min={10}
            max={100}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            목표 수익률 (%)
          </label>
          <input
            name="targetReturn"
            type="number"
            defaultValue={10}
            min={1}
            max={50}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer"
      >
        {loading ? "시뮬레이션 중..." : "백테스트 실행"}
      </button>
    </form>
  );
}
