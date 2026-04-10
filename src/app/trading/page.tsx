"use client";

import { useState, useEffect, useCallback } from "react";
import NavTabs from "@/components/NavTabs";
import type { TradeLog, OrderKind, PendingDay } from "@/lib/trading/types";

interface ComputedState {
  starPoint: number;
  targetPrice: number;
  reverseExitPrice: number;
  ma5: number;
  nextBuyAmount: number;
  portfolioValue: number;
  roundsRemaining: number;
  capitalUsageRate: number;
}

interface TradingStatus {
  active: boolean;
  state: {
    config: {
      ticker: string;
      totalCapital: number;
      rounds: number;
      targetReturn: number;
    };
    cycle: {
      cycleNumber: number;
      startDate: string;
      totalShares: number;
      avgCost: number;
      T: number;
      cycleCash: number;
      totalCash: number;
      mode: "normal" | "reverse";
      recentCloses: number[];
      reverseFirstDay: boolean;
    };
    lastTradeDate: string;
    lastSettleDate: string;
    createdAt: string;
    updatedAt: string;
    computed: ComputedState;
  } | null;
}

const kindStyles: Record<OrderKind, { label: string; color: string }> = {
  buy_half_star: { label: "매수 0.5×별", color: "text-red-300" },
  buy_half_avg: { label: "매수 0.5×평단", color: "text-red-300" },
  buy_full_star: { label: "매수 1×별", color: "text-red-400" },
  quarter_sell_star: { label: "쿼터매도", color: "text-yellow-400" },
  final_sell_target: { label: "익절매도", color: "text-blue-400" },
  reverse_moc_sell: { label: "리버스 MOC", color: "text-purple-400" },
  reverse_ladder_sell: { label: "리버스 매도", color: "text-purple-300" },
  reverse_quarter_buy: { label: "리버스 쿼터매수", color: "text-pink-300" },
};

export default function TradingPage() {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [pending, setPending] = useState<PendingDay | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, historyRes, pendingRes] = await Promise.all([
        fetch("/api/trading/status"),
        fetch("/api/trading/history?limit=20"),
        fetch("/api/trading/reservation"),
      ]);
      const statusData = await statusRes.json();
      const historyData = await historyRes.json();
      const pendingData = await pendingRes.json();
      setStatus(statusData);
      setTrades(historyData.trades ?? []);
      setTradeTotal(historyData.total ?? 0);
      setPending(pendingData.pending ?? null);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-400">로딩 중...</p>
      </main>
    );
  }

  const s = status?.state;
  const cycle = s?.cycle;
  const config = s?.config;
  const computed = s?.computed;

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <NavTabs />
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">트레이딩 대시보드 (V4)</h1>
        <p className="text-sm text-gray-500">
          무한매수법 V4.0 · LOC 예약매수 · 실체결 기준 기록
        </p>
      </div>

      {!status?.active ? (
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl mb-6">
          <p className="text-gray-400">
            아직 트레이딩 상태가 없습니다. <code className="text-gray-300">/api/trading/reset</code>{" "}
            로 초기화하거나 첫 예약을 실행하세요.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="종목" value={config?.ticker ?? "-"} />
            <StatCard
              label="총 자본"
              value={`$${config?.totalCapital.toLocaleString()}`}
            />
            <StatCard
              label="목표 수익률"
              value={`${((config?.targetReturn ?? 0) * 100).toFixed(0)}%`}
            />
            <StatCard label="라운드" value={`${config?.rounds ?? 0}회`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="모드"
              value={cycle?.mode === "reverse" ? "🔻 리버스" : "🟢 일반"}
              accent
            />
            <StatCard
              label="현재 사이클"
              value={`#${cycle?.cycleNumber ?? 0}`}
            />
            <StatCard
              label="보유수량"
              value={`${cycle?.totalShares ?? 0}주`}
            />
            <StatCard
              label="평균단가"
              value={`$${(cycle?.avgCost ?? 0).toFixed(2)}`}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="별지점"
              value={`$${(computed?.starPoint ?? 0).toFixed(2)}`}
              accent
            />
            <StatCard
              label="익절가"
              value={`$${(computed?.targetPrice ?? 0).toFixed(2)}`}
              accent
            />
            <StatCard
              label="T 값"
              value={`${(cycle?.T ?? 0).toFixed(2)} / ${config?.rounds ?? 0}`}
            />
            <StatCard
              label="잔여 라운드"
              value={`${(computed?.roundsRemaining ?? 0).toFixed(2)}`}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="다음 매수금"
              value={`$${(computed?.nextBuyAmount ?? 0).toFixed(2)}`}
            />
            <StatCard
              label="잔여 현금"
              value={`$${(cycle?.cycleCash ?? 0).toFixed(2)}`}
            />
            <StatCard
              label="자본 사용률"
              value={`${computed?.capitalUsageRate ?? 0}%`}
            />
            <StatCard
              label="MA5"
              value={
                (computed?.ma5 ?? 0) > 0
                  ? `$${(computed?.ma5 ?? 0).toFixed(2)}`
                  : "-"
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <StatCard
              label="마지막 제출일"
              value={s?.lastTradeDate || "없음"}
            />
            <StatCard
              label="마지막 정산일"
              value={s?.lastSettleDate || "없음"}
            />
            <StatCard
              label="리버스 첫날?"
              value={cycle?.reverseFirstDay ? "예" : "아니오"}
            />
          </div>
        </>
      )}

      {/* 오늘 펜딩 (제출 완료, 정산 대기) */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">오늘 제출한 LOC 주문</h2>
          {pending && (
            <span className="text-xs text-gray-500">
              {pending.date} · {pending.orders.length}건
            </span>
          )}
        </div>
        {!pending || pending.orders.length === 0 ? (
          <p className="text-sm text-gray-500">
            오늘 제출한 주문이 없습니다 (평일 KST 23:00 자동 실행).
          </p>
        ) : (
          <div className="space-y-1.5">
            {pending.orders.map((o) => {
              const style = kindStyles[o.kind] ?? {
                label: o.kind,
                color: "text-gray-400",
              };
              return (
                <div
                  key={o.orderId}
                  className="flex items-center gap-3 text-xs flex-wrap"
                >
                  <span className={`font-medium ${style.color}`}>
                    {style.label}
                  </span>
                  <span className="text-gray-300">
                    {o.quantity}주 @ ${o.limitPrice.toFixed(2)}
                  </span>
                  <span className="text-gray-600">{o.orderId}</span>
                  <span className="text-gray-700 truncate max-w-md">
                    {o.reason}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 실체결 거래 내역 */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold">실체결 내역</h2>
          <span className="text-xs text-gray-500">총 {tradeTotal}건</span>
        </div>
        {trades.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            체결 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left px-4 py-3">날짜</th>
                  <th className="text-left px-4 py-3">종류</th>
                  <th className="text-right px-4 py-3">단가</th>
                  <th className="text-right px-4 py-3">수량</th>
                  <th className="text-right px-4 py-3">금액</th>
                  <th className="text-right px-4 py-3">평균단가</th>
                  <th className="text-right px-4 py-3">T</th>
                  <th className="text-right px-4 py-3">잔여현금</th>
                  <th className="text-left px-4 py-3">사유</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => {
                  const style = kindStyles[t.kind] ?? {
                    label: t.kind,
                    color: "text-gray-400",
                  };
                  return (
                    <tr
                      key={i}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30"
                    >
                      <td className="px-4 py-2.5 text-gray-300">{t.date}</td>
                      <td className={`px-4 py-2.5 font-medium ${style.color}`}>
                        {style.label}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        ${t.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right">{t.quantity}</td>
                      <td className="px-4 py-2.5 text-right">
                        ${t.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        ${t.avgCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {t.T?.toFixed?.(2) ?? "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        ${t.cashRemaining.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-48 truncate">
                        {t.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div
        className={`text-lg font-semibold ${accent ? "text-blue-400" : "text-gray-100"}`}
      >
        {value}
      </div>
    </div>
  );
}
