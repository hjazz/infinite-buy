"use client";

import type { VRResult } from "@/lib/types";

interface Props {
  result: VRResult;
}

export default function VRResultSummary({ result }: Props) {
  const {
    totalReturn,
    finalValue,
    totalInvested,
    finalStockValue,
    finalPool,
    buyCount,
    sellCount,
    totalCycles,
    buyHold,
    dca,
  } = result;

  const fmt = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const bhReturn = buyHold.totalReturn;
  const dcaReturn = dca.totalReturn;

  const stats = [
    {
      label: "VR 총 수익률",
      value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`,
      color: totalReturn >= 0 ? "text-emerald-400" : "text-red-400",
    },
    {
      label: "최종 총자산",
      value: `$${fmt(finalValue)}`,
      color: "text-white",
      sub: `투자 $${fmt(totalInvested)}`,
    },
    {
      label: "최종 주식 평가금",
      value: `$${fmt(finalStockValue)}`,
      color: "text-orange-400",
    },
    {
      label: "최종 Pool (현금)",
      value: `$${fmt(finalPool)}`,
      color: "text-blue-400",
    },
    {
      label: "총 사이클 수",
      value: `${totalCycles}회`,
      color: "text-gray-300",
      sub: `매수 ${buyCount}회 / 매도 ${sellCount}회`,
    },
    {
      label: "Buy & Hold 수익률",
      value: `${bhReturn >= 0 ? "+" : ""}${bhReturn.toFixed(2)}%`,
      color: "text-purple-400",
      sub: `최종 $${fmt(buyHold.finalValue)}`,
    },
    {
      label: "적립식(DCA) 수익률",
      value: `${dcaReturn >= 0 ? "+" : ""}${dcaReturn.toFixed(2)}%`,
      color: "text-cyan-400",
      sub: `투자 $${fmt(dca.totalInvested)} → $${fmt(dca.finalValue)}`,
    },
    {
      label: "VR vs Buy & Hold",
      value: `${(totalReturn - bhReturn) >= 0 ? "+" : ""}${(totalReturn - bhReturn).toFixed(2)}%p`,
      color: (totalReturn - bhReturn) >= 0 ? "text-emerald-400" : "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-gray-900 rounded-2xl p-4 border border-gray-800"
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
