"use client";

import type { VRDailyRecord, BuyHoldResult, DCAResult } from "@/lib/types";
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
  records: VRDailyRecord[];
  buyHold: BuyHoldResult;
  dca: DCAResult;
}

interface ChartRow {
  date: string;
  stockValue: number;
  V: number;
  upperBand: number;
  lowerBand: number;
  totalValue: number;
  buyHoldValue: number | null;
  dcaValue: number | null;
  buyPoint: number | null;
  sellPoint: number | null;
}

function formatDate(d: string) {
  return d.slice(5); // MM-DD
}

export default function VRChart({ records, buyHold, dca }: Props) {
  const bhMap = new Map(buyHold.dailyValues.map((d) => [d.date, d.value]));
  const dcaMap = new Map(dca.dailyValues.map((d) => [d.date, d.value]));

  const data: ChartRow[] = records.map((r) => ({
    date: r.date,
    stockValue: Math.round(r.stockValue * 100) / 100,
    V: Math.round(r.V * 100) / 100,
    upperBand: Math.round(r.upperBand * 100) / 100,
    lowerBand: Math.round(r.lowerBand * 100) / 100,
    totalValue: Math.round(r.totalValue * 100) / 100,
    buyHoldValue: bhMap.get(r.date) ?? null,
    dcaValue: dcaMap.get(r.date) ?? null,
    buyPoint: r.action === "buy" ? Math.round(r.stockValue * 100) / 100 : null,
    sellPoint: r.action === "sell" ? Math.round(r.stockValue * 100) / 100 : null,
  }));

  // Sample data for performance if too many points; always keep buy/sell points
  const sampled =
    data.length > 500
      ? data.filter((_, i) => {
          const r = records[i];
          if (r.action === "buy" || r.action === "sell") return true;
          return i % Math.ceil(data.length / 500) === 0;
        })
      : data;

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-400 mb-3">
        밸류 리밸런싱 차트 — 평가금 & 총자산
      </h3>
      <ResponsiveContainer width="100%" height={460}>
        <ComposedChart data={sampled}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            interval="preserveStartEnd"
            minTickGap={50}
          />
          {/* 좌측 Y축: 주식 평가금 / V / 밴드 */}
          <YAxis
            yAxisId="stock"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          {/* 우측 Y축: 총자산 비교 */}
          <YAxis
            yAxisId="total"
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
                stockValue: "주식 평가금",
                V: "목표 V",
                upperBand: "상단 밴드",
                lowerBand: "하단 밴드",
                totalValue: "VR 총자산",
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
                stockValue: "주식 평가금",
                V: "목표 V",
                upperBand: "상단 밴드",
                lowerBand: "하단 밴드",
                totalValue: "VR 총자산",
                buyHoldValue: "Buy & Hold",
                dcaValue: "적립식(DCA)",
                buyPoint: "매수",
                sellPoint: "매도",
              };
              return labels[value] ?? value;
            }}
          />

          {/* 총자산 Area (우측 축) */}
          <Area
            yAxisId="total"
            type="monotone"
            dataKey="totalValue"
            fill="#3b82f610"
            stroke="#3b82f6"
            strokeWidth={2}
          />

          {/* Buy & Hold (우측 축) */}
          <Line
            yAxisId="total"
            type="monotone"
            dataKey="buyHoldValue"
            stroke="#a78bfa"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />

          {/* DCA (우측 축) */}
          <Line
            yAxisId="total"
            type="monotone"
            dataKey="dcaValue"
            stroke="#22d3ee"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />

          {/* 주식 평가금 (좌측 축) */}
          <Line
            yAxisId="stock"
            type="monotone"
            dataKey="stockValue"
            stroke="#f97316"
            dot={false}
            strokeWidth={2}
          />

          {/* 목표 V (좌측 축) */}
          <Line
            yAxisId="stock"
            type="stepAfter"
            dataKey="V"
            stroke="#3b82f6"
            dot={false}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />

          {/* 상단 밴드 (좌측 축) */}
          <Line
            yAxisId="stock"
            type="stepAfter"
            dataKey="upperBand"
            stroke="#ef4444"
            dot={false}
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* 하단 밴드 (좌측 축) */}
          <Line
            yAxisId="stock"
            type="stepAfter"
            dataKey="lowerBand"
            stroke="#22c55e"
            dot={false}
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* 매수 포인트 (좌측 축) */}
          <Scatter
            yAxisId="stock"
            dataKey="buyPoint"
            fill="#34d399"
            shape="triangle"
            r={4}
          />

          {/* 매도 포인트 (좌측 축) */}
          <Scatter
            yAxisId="stock"
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
