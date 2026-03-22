"use client";

import type { BacktestResult } from "@/lib/types";

interface Props {
  result: BacktestResult;
}

export default function ResultSummary({ result }: Props) {
  const { records, cycles, totalReturn, finalValue, totalCapital } = result;

  const completedCycles = cycles.filter((c) => c.sellType === "target");
  const quarterSells = records.filter((r) => r.action === "quarter_sell").length;

  const avgCycleDays =
    completedCycles.length > 0
      ? Math.round(
          completedCycles.reduce((sum, c) => sum + c.daysHeld, 0) /
            completedCycles.length
        )
      : 0;

  // Max drawdown calculation
  let peak = totalCapital;
  let maxDrawdown = 0;
  for (const r of records) {
    if (r.portfolioValue > peak) peak = r.portfolioValue;
    const dd = ((peak - r.portfolioValue) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const { buyHold, dca } = result;
  const bhReturn = buyHold.totalReturn;
  const dcaReturn = dca.totalReturn;

  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const stats = [
    {
      label: "무한매수법 수익률",
      value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`,
      color: totalReturn >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "Buy & Hold 수익률",
      value: `${bhReturn >= 0 ? "+" : ""}${bhReturn.toFixed(2)}%`,
      color: "text-purple-400",
    },
    {
      label: `적립식(월$${dca.totalInvested > 0 ? Math.round(dca.totalInvested / Math.max(1, new Set(dca.dailyValues.map(d => d.date.slice(0, 7))).size)) : 0}) 수익률`,
      value: `${dcaReturn >= 0 ? "+" : ""}${dcaReturn.toFixed(2)}%`,
      color: "text-cyan-400",
      sub: `투자 $${fmt(dca.totalInvested)} → $${fmt(dca.finalValue)}`,
    },
    {
      label: "최종 자산",
      value: `$${fmt(finalValue)}`,
      color: "text-white",
    },
    {
      label: "완료 사이클",
      value: `${completedCycles.length}회 (평균 ${avgCycleDays > 0 ? avgCycleDays : "-"}일)`,
      color: "text-blue-400",
    },
    {
      label: "최대 낙폭",
      value: `-${maxDrawdown.toFixed(2)}%`,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-gray-900 rounded-xl p-4 border border-gray-800"
        >
          <div className="text-xs text-gray-500 mb-1">{s.label}</div>
          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
          {"sub" in s && s.sub && (
            <div className="text-xs text-gray-500 mt-0.5">{s.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}
