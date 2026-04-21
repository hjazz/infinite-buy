"use client";

import { useState, useMemo, useEffect } from "react";
import NavTabs from "@/components/NavTabs";
import {
  planV4Orders,
  applyFillsV4,
  starPoint,
} from "@/lib/trading/strategy-v4";
import type {
  CycleState,
  TradingConfig,
  OrderKind,
  FilledOrder,
} from "@/lib/trading/types";

const DEFAULT_CONFIG: TradingConfig = {
  ticker: "TQQQ",
  totalCapital: 10000,
  rounds: 40,
  targetReturn: 0.15,
  exchange: "NASD",
  locPriceMargin: 0.05,
  maxDailyOrderAmount: 5000,
};

function makeInitialState(capital: number): CycleState {
  return {
    cycleNumber: 1,
    startDate: new Date().toISOString().split("T")[0],
    totalShares: 0,
    avgCost: 0,
    T: 0,
    cycleCash: capital,
    totalCash: capital,
    mode: "normal",
    recentCloses: [],
    reverseFirstDay: false,
  };
}

interface FillEntry {
  id: string;
  date: string;
  kind: OrderKind;
  filledPrice: number;
  filledQuantity: number;
}

const KIND_LABELS: Record<OrderKind, string> = {
  buy_half_star: "전반전 매수 — 별지점 0.5배",
  buy_half_avg: "전반전 매수 — 평단가 0.5배",
  buy_full_star: "매수 — 별지점 1배",
  quarter_sell_star: "쿼터 매도 — 별지점",
  final_sell_target: "익절 매도 — 목표가",
  reverse_moc_sell: "리버스 첫날 MOC 매도",
  reverse_ladder_sell: "리버스 사다리 매도",
  reverse_quarter_buy: "리버스 쿼터 매수",
};

const KIND_SIDE: Record<OrderKind, "buy" | "sell"> = {
  buy_half_star: "buy",
  buy_half_avg: "buy",
  buy_full_star: "buy",
  quarter_sell_star: "sell",
  final_sell_target: "sell",
  reverse_moc_sell: "sell",
  reverse_ladder_sell: "sell",
  reverse_quarter_buy: "buy",
};

function getAvailableKinds(
  state: CycleState,
  config: TradingConfig
): OrderKind[] {
  if (state.mode === "reverse") {
    if (state.reverseFirstDay) return ["reverse_moc_sell"];
    return ["reverse_ladder_sell", "reverse_quarter_buy"];
  }
  if (state.totalShares === 0) return ["buy_full_star"];

  const kinds: OrderKind[] = [];
  if (state.cycleCash > 0 && state.T < config.rounds) {
    if (state.T < config.rounds / 2) {
      kinds.push("buy_half_star", "buy_half_avg");
    } else {
      kinds.push("buy_full_star");
    }
  }
  if (state.totalShares > 0 && state.avgCost > 0) {
    kinds.push("quarter_sell_star", "final_sell_target");
  }
  return kinds;
}

function replayFills(
  fills: FillEntry[],
  config: TradingConfig
): CycleState {
  let state = makeInitialState(config.totalCapital);
  for (const f of fills) {
    const fill: FilledOrder = {
      orderId: f.id,
      kind: f.kind,
      filledQuantity: f.filledQuantity,
      filledPrice: f.filledPrice,
      filledAmount: +(f.filledPrice * f.filledQuantity).toFixed(2),
    };
    const { next } = applyFillsV4(state, [fill], config, f.filledPrice);
    state = next;
  }
  return state;
}

export default function JournalPage() {
  const [config, setConfig] = useState<TradingConfig>(DEFAULT_CONFIG);
  const [fills, setFills] = useState<FillEntry[]>([]);
  const [cycleState, setCycleState] = useState<CycleState>(() =>
    makeInitialState(DEFAULT_CONFIG.totalCapital)
  );
  const [showConfig, setShowConfig] = useState(false);

  const lastFillPrice = fills.length > 0 ? fills[fills.length - 1].filledPrice : 0;

  const today = new Date().toISOString().split("T")[0];
  const availableKinds = getAvailableKinds(cycleState, config);

  const [formDate, setFormDate] = useState(today);
  const [formKind, setFormKind] = useState<OrderKind>(availableKinds[0]);
  const [formPrice, setFormPrice] = useState("");
  const [formQty, setFormQty] = useState("");

  // Keep formKind valid when available kinds change
  useEffect(() => {
    if (!availableKinds.includes(formKind)) {
      setFormKind(availableKinds[0]);
    }
  }, [availableKinds, formKind]);

  const plannedOrders = useMemo(() => {
    if (lastFillPrice <= 0) return [];
    return planV4Orders(config, cycleState, lastFillPrice);
  }, [config, cycleState, lastFillPrice]);

  const star =
    cycleState.avgCost > 0 ? starPoint(cycleState.avgCost, cycleState.T) : 0;
  const targetPrice =
    cycleState.avgCost > 0
      ? +(cycleState.avgCost * (1 + config.targetReturn)).toFixed(2)
      : 0;
  const nextBuyAmount =
    cycleState.cycleCash / Math.max(config.rounds - cycleState.T, 0.5);

  function handleAddFill() {
    const price = parseFloat(formPrice);
    const qty = parseInt(formQty);
    if (!price || price <= 0 || !qty || qty <= 0) return;

    const fill: FilledOrder = {
      orderId: `manual-${Date.now()}`,
      kind: formKind,
      filledQuantity: qty,
      filledPrice: price,
      filledAmount: +(price * qty).toFixed(2),
    };

    const { next } = applyFillsV4(cycleState, [fill], config, price);
    setCycleState(next);

    setFills((prev) => [
      ...prev,
      {
        id: fill.orderId,
        date: formDate,
        kind: formKind,
        filledPrice: price,
        filledQuantity: qty,
      },
    ]);

    setFormPrice("");
    setFormQty("");
  }

  function handleDeleteFill(id: string) {
    if (!confirm("이 체결 기록을 삭제하면 이후 상태가 재계산됩니다. 계속할까요?"))
      return;
    const newFills = fills.filter((f) => f.id !== id);
    setFills(newFills);
    setCycleState(replayFills(newFills, config));
  }

  function handleReset() {
    if (!confirm("모든 체결 기록과 상태를 초기화할까요?")) return;
    setFills([]);
    setCycleState(makeInitialState(config.totalCapital));
  }

  function handleConfigChange(
    key: keyof TradingConfig,
    rawValue: string
  ) {
    let value: string | number = rawValue;
    if (key !== "ticker" && key !== "exchange") {
      const n = parseFloat(rawValue);
      if (isNaN(n)) return;
      value =
        key === "targetReturn" || key === "locPriceMargin" ? n / 100 : n;
    }
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    setCycleState(replayFills(fills, newConfig));
  }

  const formAmount =
    formPrice && formQty
      ? (parseFloat(formPrice) * parseInt(formQty)) || 0
      : 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <NavTabs />
        <h1 className="text-2xl font-bold mb-6">V4 체결 일지</h1>

        {/* Config */}
        <div className="bg-gray-900 rounded-xl p-4 mb-6">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => setShowConfig((v) => !v)}
          >
            <span className="font-semibold text-gray-200">
              설정{" "}
              <span className="text-gray-500 text-xs font-normal">
                (투자금 ${config.totalCapital.toLocaleString()} · {config.rounds}라운드 · 목표 {(config.targetReturn * 100).toFixed(0)}%)
              </span>
            </span>
            <span className="text-gray-400 text-xs">{showConfig ? "▲ 닫기" : "▼ 펼치기"}</span>
          </button>
          {showConfig && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">총 투자금 ($)</span>
                <input
                  type="number"
                  defaultValue={config.totalCapital}
                  onBlur={(e) => handleConfigChange("totalCapital", e.target.value)}
                  className="bg-gray-800 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">라운드 수</span>
                <input
                  type="number"
                  defaultValue={config.rounds}
                  onBlur={(e) => handleConfigChange("rounds", e.target.value)}
                  className="bg-gray-800 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">목표 수익률 (%)</span>
                <input
                  type="number"
                  defaultValue={config.targetReturn * 100}
                  onBlur={(e) => handleConfigChange("targetReturn", e.target.value)}
                  className="bg-gray-800 rounded px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-400">LOC 마진 (%)</span>
                <input
                  type="number"
                  defaultValue={config.locPriceMargin * 100}
                  onBlur={(e) => handleConfigChange("locPriceMargin", e.target.value)}
                  className="bg-gray-800 rounded px-3 py-2 text-sm"
                />
              </label>
              <div className="sm:col-span-4 flex justify-end">
                <button
                  onClick={handleReset}
                  className="bg-red-900/40 hover:bg-red-900/70 text-red-300 px-4 py-2 rounded text-sm transition-colors"
                >
                  전체 초기화
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Current State */}
            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="font-semibold text-gray-200 mb-3">현재 상태</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
                <StateRow
                  label="모드"
                  value={
                    <span
                      className={
                        cycleState.mode === "reverse"
                          ? "text-red-400 font-semibold"
                          : "text-green-400"
                      }
                    >
                      {cycleState.mode === "reverse" ? "리버스" : "일반"}
                    </span>
                  }
                />
                <StateRow label="사이클" value={`#${cycleState.cycleNumber}`} />
                <StateRow
                  label="T / 라운드"
                  value={
                    <span className="font-mono">
                      {cycleState.T.toFixed(2)}{" "}
                      <span className="text-gray-500">/ {config.rounds}</span>
                    </span>
                  }
                />
                <StateRow
                  label="보유 수량"
                  value={<span className="font-mono">{cycleState.totalShares}주</span>}
                />
                <StateRow
                  label="평단가"
                  value={
                    <span className="font-mono">
                      {cycleState.avgCost > 0
                        ? `$${cycleState.avgCost.toFixed(2)}`
                        : "—"}
                    </span>
                  }
                />
                <StateRow
                  label="잔여 캐시"
                  value={
                    <span className="font-mono">
                      ${cycleState.cycleCash.toFixed(2)}
                    </span>
                  }
                />
                {star > 0 && (
                  <StateRow
                    label="별지점"
                    value={
                      <span className="font-mono text-yellow-400">
                        ${star.toFixed(2)}
                      </span>
                    }
                  />
                )}
                {targetPrice > 0 && (
                  <StateRow
                    label="익절 목표가"
                    value={
                      <span className="font-mono text-green-400">
                        ${targetPrice.toFixed(2)}
                      </span>
                    }
                  />
                )}
                {cycleState.avgCost > 0 && (
                  <StateRow
                    label="다음 매수 예산"
                    value={
                      <span className="font-mono text-blue-400">
                        ${nextBuyAmount.toFixed(2)}
                      </span>
                    }
                  />
                )}
              </div>
            </div>

            {/* Next Orders */}
            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="font-semibold text-gray-200 mb-3">다음 주문 계획</h2>
              {lastFillPrice > 0 ? (
                plannedOrders.length > 0 ? (
                  <div className="space-y-2">
                    {plannedOrders.map((order, i) => (
                      <div key={i} className="bg-gray-800 rounded-lg p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-medium ${
                              order.side === "buy"
                                ? "text-blue-400"
                                : "text-red-400"
                            }`}
                          >
                            {order.side === "buy" ? "▲ 매수" : "▼ 매도"}{" "}
                            <span className="text-gray-300 font-normal">
                              {KIND_LABELS[order.kind]}
                            </span>
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-gray-200">
                          {order.quantity}주{" "}
                          <span className="text-gray-500">@</span> $
                          {order.limitPrice.toFixed(2)}
                          <span className="text-gray-500 text-xs ml-2">
                            ≈${(order.quantity * order.limitPrice).toFixed(0)}
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5">
                          {order.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">계획된 주문 없음</p>
                )
              ) : (
                <p className="text-gray-500 text-sm">
                  체결 기록을 추가하면 계산됩니다
                </p>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Add Fill Form */}
            <div className="bg-gray-900 rounded-xl p-4">
              <h2 className="font-semibold text-gray-200 mb-3">체결 기록 추가</h2>
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">날짜</span>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="bg-gray-800 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">주문 종류</span>
                  <select
                    value={formKind}
                    onChange={(e) => setFormKind(e.target.value as OrderKind)}
                    className="bg-gray-800 rounded px-3 py-2 text-sm"
                  >
                    {availableKinds.map((k) => (
                      <option key={k} value={k}>
                        {KIND_SIDE[k] === "buy" ? "▲" : "▼"} {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400">체결 가격 ($)</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="예: 42.50"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="bg-gray-800 rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-400">수량 (주)</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      placeholder="예: 10"
                      value={formQty}
                      onChange={(e) => setFormQty(e.target.value)}
                      className="bg-gray-800 rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                {formAmount > 0 && (
                  <div className="text-xs text-gray-400 bg-gray-800/60 rounded px-3 py-2">
                    체결 금액:{" "}
                    <span className="text-gray-100 font-mono">
                      ${formAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                <button
                  onClick={handleAddFill}
                  disabled={!formPrice || !formQty || parseFloat(formPrice) <= 0 || parseInt(formQty) <= 0}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  체결 추가
                </button>
              </div>
            </div>

            {/* Fill History */}
            {fills.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4">
                <h2 className="font-semibold text-gray-200 mb-3">
                  체결 이력{" "}
                  <span className="text-gray-500 font-normal text-sm">
                    ({fills.length}건)
                  </span>
                </h2>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {[...fills].reverse().map((f) => (
                    <div
                      key={f.id}
                      className="bg-gray-800 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-gray-400 text-xs shrink-0">
                            {f.date}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              KIND_SIDE[f.kind] === "buy"
                                ? "text-blue-400"
                                : "text-red-400"
                            }`}
                          >
                            {KIND_LABELS[f.kind]}
                          </span>
                        </div>
                        <div className="font-mono text-xs text-gray-300 mt-0.5">
                          {f.filledQuantity}주 × ${f.filledPrice.toFixed(2)}{" "}
                          <span className="text-gray-500">
                            = ${(f.filledQuantity * f.filledPrice).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteFill(f.id)}
                        className="text-gray-600 hover:text-red-400 text-xs shrink-0 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StateRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <>
      <span className="text-gray-400">{label}</span>
      <span className="text-right">{value}</span>
    </>
  );
}
