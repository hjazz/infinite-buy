"use client";

import { useState, useEffect, useCallback } from "react";
import NavTabs from "@/components/NavTabs";
import type { TradeLog } from "@/lib/trading/types";
import type { ReservationState } from "@/lib/trading/reservation";

interface ComputedState {
  targetPrice: number;
  roundAmount: number;
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
      roundsUsed: number;
      cycleCash: number;
      totalCash: number;
    };
    lastTradeDate: string;
    createdAt: string;
    updatedAt: string;
    computed: ComputedState;
  } | null;
}

const actionStyles: Record<string, { label: string; color: string }> = {
  buy_full: { label: "매수(1배)", color: "text-red-400" },
  buy_half: { label: "매수(0.5배)", color: "text-red-300" },
  sell: { label: "전량매도", color: "text-blue-400" },
  quarter_sell: { label: "쿼터손절", color: "text-yellow-400" },
  hold: { label: "홀드", color: "text-gray-400" },
};

export default function TradingPage() {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [trades, setTrades] = useState<TradeLog[]>([]);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [reservation, setReservation] = useState<ReservationState | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, historyRes, resvRes] = await Promise.all([
        fetch("/api/trading/status"),
        fetch("/api/trading/history?limit=20"),
        fetch("/api/trading/reservation"),
      ]);
      const statusData = await statusRes.json();
      const historyData = await historyRes.json();
      const resvData = await resvRes.json();
      setStatus(statusData);
      setTrades(historyData.trades ?? []);
      setTradeTotal(historyData.total ?? 0);
      setReservation(resvData.reservation ?? null);
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
        <h1 className="text-2xl font-bold mb-1">트레이딩 대시보드</h1>
        <p className="text-sm text-gray-500">
          무한매수법 자동매매 모니터링
        </p>
      </div>

      {/* Status Cards */}
      {!status?.active ? (
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-xl mb-6">
          <p className="text-gray-400">
            아직 트레이딩 상태가 없습니다. 아래 버튼으로 첫 실행을 하거나{" "}
            <code className="text-gray-300">npm run trade</code>를 실행하세요.
          </p>
        </div>
      ) : (
        <>
          {/* Config Summary */}
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
            <StatCard
              label="라운드"
              value={`${config?.rounds ?? 0}회`}
            />
          </div>

          {/* Cycle Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="현재 사이클"
              value={`#${cycle?.cycleNumber ?? 0}`}
              accent
            />
            <StatCard
              label="보유수량"
              value={`${(cycle?.totalShares ?? 0).toFixed(4)}주`}
            />
            <StatCard
              label="평균단가"
              value={`$${(cycle?.avgCost ?? 0).toFixed(2)}`}
            />
            <StatCard
              label="목표가"
              value={`$${(computed?.targetPrice ?? 0).toFixed(2)}`}
              accent
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="사용 라운드"
              value={`${cycle?.roundsUsed ?? 0} / ${config?.rounds ?? 0}`}
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
              label="마지막 거래"
              value={s?.lastTradeDate || "없음"}
            />
          </div>
        </>
      )}

      {/* Today's Reservation Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 mb-6">
        {reservation ? (
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="text-green-400 font-medium">오늘 예약됨 ✓</span>
            <span className="text-gray-300">
              {reservation.action} · {reservation.quantity}주 @ ${reservation.price.toFixed(2)}
            </span>
            <span className="text-gray-500">주문번호 {reservation.orderId}</span>
            <span className="text-gray-600">
              {new Date(reservation.createdAt).toLocaleTimeString("ko-KR")}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">오늘 예약 없음 (평일 KST 23:00 자동 실행)</span>
        )}
      </div>

      {/* Trade History */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold">거래 내역</h2>
          <span className="text-xs text-gray-500">총 {tradeTotal}건</span>
        </div>

        {trades.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            거래 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-800">
                  <th className="text-left px-4 py-3">날짜</th>
                  <th className="text-left px-4 py-3">액션</th>
                  <th className="text-right px-4 py-3">가격</th>
                  <th className="text-right px-4 py-3">수량</th>
                  <th className="text-right px-4 py-3">금액</th>
                  <th className="text-right px-4 py-3">평균단가</th>
                  <th className="text-right px-4 py-3">라운드</th>
                  <th className="text-right px-4 py-3">잔여현금</th>
                  <th className="text-left px-4 py-3">사유</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => {
                  const style = actionStyles[t.action] ?? {
                    label: t.action,
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
                      <td className="px-4 py-2.5 text-right">
                        {t.quantity > 0 ? t.quantity.toFixed(4) : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {t.amount > 0 ? `$${t.amount.toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        ${t.avgCost.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {t.roundsUsed}
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
