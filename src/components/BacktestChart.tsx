"use client";

import type { DailyRecord, BuyHoldResult, DCAResult } from "@/lib/types";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
} from "recharts";

interface Props {
  records: DailyRecord[];
  buyHold: BuyHoldResult;
  dca: DCAResult;
}

interface ChartRow {
  date: string;
  closePrice: number;
  avgCost: number | null;
  targetPrice: number | null;
  portfolioValue: number;
  buyHoldValue: number | null;
  dcaValue: number | null;
  buyPoint: number | null;
  sellPoint: number | null;
}

function formatDate(d: string) {
  return d.slice(5); // MM-DD
}

export default function BacktestChart({ records, buyHold, dca }: Props) {
  // Build lookups for benchmark daily values
  const bhMap = new Map(buyHold.dailyValues.map((d) => [d.date, d.value]));
  const dcaMap = new Map(dca.dailyValues.map((d) => [d.date, d.value]));

  const data: ChartRow[] = records.map((r) => ({
    date: r.date,
    closePrice: r.closePrice,
    avgCost: r.totalShares > 0 ? Math.round(r.avgCost * 100) / 100 : null,
    targetPrice:
      r.totalShares > 0
        ? Math.round(r.avgCost * 1.1 * 100) / 100
        : null,
    portfolioValue: Math.round(r.portfolioValue * 100) / 100,
    buyHoldValue: bhMap.get(r.date) ?? null,
    dcaValue: dcaMap.get(r.date) ?? null,
    buyPoint:
      r.action === "buy_full" || r.action === "buy_half"
        ? r.closePrice
        : null,
    sellPoint:
      r.action === "sell" || r.action === "quarter_sell"
        ? r.closePrice
        : null,
  }));

  // Sample data for performance if too many points
  const sampled =
    data.length > 500
      ? data.filter((_, i) => {
          // Always keep buy/sell points
          const r = records[i];
          if (
            r.action === "sell" ||
            r.action === "quarter_sell" ||
            r.action === "buy_full"
          )
            return true;
          return i % Math.ceil(data.length / 500) === 0;
        })
      : data;

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-3">
        주가 & 매매 포인트
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={sampled}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          <YAxis
            yAxisId="price"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `$${v}`}
          />
          <YAxis
            yAxisId="portfolio"
            orientation="right"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value, name) => {
              const labels: Record<string, string> = {
                closePrice: "종가",
                avgCost: "평균단가",
                targetPrice: "목표가(+10%)",
                portfolioValue: "무한매수법",
                buyHoldValue: "Buy & Hold",
                dcaValue: "적립식(DCA)",
                buyPoint: "매수",
                sellPoint: "매도",
              };
              const numVal = Number(value);
              if (isNaN(numVal)) return null;
              return [`$${numVal.toFixed(2)}`, labels[String(name)] ?? String(name)];
            }}
            labelFormatter={(label) => `날짜: ${String(label)}`}
          />
          <Legend
            formatter={(value) => {
              const labels: Record<string, string> = {
                closePrice: "종가",
                avgCost: "평균단가",
                targetPrice: "목표가",
                portfolioValue: "무한매수법",
                buyHoldValue: "Buy & Hold",
                dcaValue: "적립식(DCA)",
                buyPoint: "매수",
                sellPoint: "매도",
              };
              return labels[value] ?? value;
            }}
          />

          {/* Portfolio value area */}
          <Area
            yAxisId="portfolio"
            type="monotone"
            dataKey="portfolioValue"
            fill="#3b82f630"
            stroke="#3b82f6"
            strokeWidth={2}
          />

          {/* Buy & Hold line */}
          <Line
            yAxisId="portfolio"
            type="monotone"
            dataKey="buyHoldValue"
            stroke="#a78bfa"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />

          {/* DCA line */}
          <Line
            yAxisId="portfolio"
            type="monotone"
            dataKey="dcaValue"
            stroke="#22d3ee"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />

          {/* Price line */}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="closePrice"
            stroke="#60a5fa"
            dot={false}
            strokeWidth={1.5}
          />

          {/* Average cost line */}
          <Line
            yAxisId="price"
            type="stepAfter"
            dataKey="avgCost"
            stroke="#f59e0b"
            dot={false}
            strokeWidth={1}
            strokeDasharray="4 4"
            connectNulls={false}
          />

          {/* Target price line */}
          <Line
            yAxisId="price"
            type="stepAfter"
            dataKey="targetPrice"
            stroke="#ef4444"
            dot={false}
            strokeWidth={1}
            strokeDasharray="2 2"
            connectNulls={false}
          />

          {/* Buy points */}
          <Scatter
            yAxisId="price"
            dataKey="buyPoint"
            fill="#34d399"
            shape="circle"
            r={3}
          />

          {/* Sell points */}
          <Scatter
            yAxisId="price"
            dataKey="sellPoint"
            fill="#f87171"
            shape="diamond"
            r={5}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
