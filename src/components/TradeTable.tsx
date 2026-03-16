"use client";

import { useState } from "react";
import type { DailyRecord } from "@/lib/types";

interface Props {
  records: DailyRecord[];
  totalRounds?: number;
}

function getActionLabel(r: DailyRecord, totalRounds: number): string {
  switch (r.action) {
    case "buy_full":
      return `1배 매수 (${r.roundsUsed}/${totalRounds}회)`;
    case "buy_half":
      return `0.5배 매수 (${r.roundsUsed}/${totalRounds}회)`;
    case "sell":
      return "전량 매도";
    case "quarter_sell":
      return "쿼터손절 (25%)";
    case "hold":
      return "보유";
  }
}

const ACTION_COLORS: Record<DailyRecord["action"], string> = {
  buy_full: "text-emerald-400",
  buy_half: "text-emerald-300",
  sell: "text-red-400",
  quarter_sell: "text-yellow-400",
  hold: "text-gray-500",
};

export default function TradeTable({ records, totalRounds = 40 }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "trades">("trades");

  const filtered =
    filter === "trades"
      ? records.filter((r) => r.action !== "hold")
      : records;

  const displayed = showAll ? filtered : filtered.slice(0, 50);

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400">
          거래 내역 ({filtered.length}건)
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter(filter === "all" ? "trades" : "all")}
            className="text-xs px-3 py-1 rounded-md bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {filter === "all" ? "매매만 보기" : "전체 보기"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left py-2 px-2">날짜</th>
              <th className="text-left py-2 px-2">사이클</th>
              <th className="text-left py-2 px-2">액션</th>
              <th className="text-right py-2 px-2">종가</th>
              <th className="text-right py-2 px-2">매수금</th>
              <th className="text-right py-2 px-2">주수</th>
              <th className="text-right py-2 px-2">보유량</th>
              <th className="text-right py-2 px-2">평단</th>
              <th className="text-right py-2 px-2">회차</th>
              <th className="text-right py-2 px-2">포트폴리오</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => (
              <tr
                key={`${r.date}-${i}`}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="py-1.5 px-2 text-gray-300">{r.date}</td>
                <td className="py-1.5 px-2 text-gray-400">#{r.cycleNumber}</td>
                <td className={`py-1.5 px-2 font-medium ${ACTION_COLORS[r.action]}`}>
                  {getActionLabel(r, totalRounds)}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-300">
                  ${r.closePrice.toFixed(2)}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-300">
                  {r.buyAmount > 0 ? `$${r.buyAmount.toFixed(2)}` : "-"}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-300">
                  {r.shares !== 0 ? r.shares.toFixed(4) : "-"}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-300">
                  {r.totalShares > 0 ? r.totalShares.toFixed(4) : "-"}
                </td>
                <td className="py-1.5 px-2 text-right text-amber-400">
                  {r.avgCost > 0 ? `$${r.avgCost.toFixed(2)}` : "-"}
                </td>
                <td className="py-1.5 px-2 text-right text-gray-400">
                  {r.roundsUsed}
                </td>
                <td className="py-1.5 px-2 text-right text-blue-400">
                  ${r.portfolioValue.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showAll && filtered.length > 50 && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-3 w-full text-xs text-gray-500 hover:text-gray-300 py-2 cursor-pointer"
        >
          나머지 {filtered.length - 50}건 더 보기
        </button>
      )}
    </div>
  );
}
