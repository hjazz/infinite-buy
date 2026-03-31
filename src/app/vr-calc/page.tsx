"use client";

import { useState, useMemo } from "react";
import NavTabs from "@/components/NavTabs";

interface CalcInput {
  currentV: number;
  shares: number;
  pool: number;
  poolUsageLimit: number; // %
  G: number;
  depositPerCycle: number;
  bandPct: number; // %
}

const DEFAULT: CalcInput = {
  currentV: 10000,
  shares: 100,
  pool: 2000,
  poolUsageLimit: 75,
  G: 10,
  depositPerCycle: 0,
  bandPct: 15,
};

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function VRCalcPage() {
  const [form, setForm] = useState<CalcInput>(DEFAULT);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: Number(value) }));
  }

  const result = useMemo(() => {
    const { currentV, shares, pool, poolUsageLimit, G, depositPerCycle, bandPct } = form;
    if (shares <= 0 || G <= 0) return null;

    const band = bandPct / 100;
    const usageLimit = poolUsageLimit / 100;

    // 다음 V 계산
    const nextV = currentV + pool / G + depositPerCycle;
    const nextPool = pool + depositPerCycle;

    // 밴드 (주식 평가금 기준)
    const upperBand = nextV * (1 + band);
    const lowerBand = nextV * (1 - band);

    // 트리거 가격 (주당)
    const sellTriggerPrice = upperBand / shares;
    const buyTriggerPrice = lowerBand / shares;

    // 매수 계산 (하단 밴드 도달 시)
    const buyNeed = nextV - lowerBand; // = nextV * band
    const maxBuy = nextPool * usageLimit;
    const actualBuy = Math.min(buyNeed, maxBuy, nextPool);
    const buyShares = buyTriggerPrice > 0 ? actualBuy / buyTriggerPrice : 0;

    // 매도 계산 (상단 밴드 도달 시)
    const sellAmount = upperBand - nextV; // = nextV * band
    const sellShares = sellTriggerPrice > 0 ? sellAmount / sellTriggerPrice : 0;

    return {
      nextV,
      nextPool,
      upperBand,
      lowerBand,
      sellTriggerPrice,
      buyTriggerPrice,
      buyNeed,
      maxBuy,
      actualBuy,
      buyShares,
      sellAmount,
      sellShares,
      poolLimited: buyNeed > maxBuy,
    };
  }, [form]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <NavTabs />
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">VR 라운드 계산기</h1>
        <p className="text-gray-400 text-sm">2주 사이클 기준 다음 라운드의 밴드 및 매수/매도 주문을 계산합니다.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* 입력 폼 */}
        <div className="bg-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">입력값</h2>

          <Field label="현재 V ($)" name="currentV" value={form.currentV} onChange={handleChange} />
          <Field label="현재 보유수량 (주)" name="shares" value={form.shares} onChange={handleChange} step="0.0001" />
          <Field label="Pool ($)" name="pool" value={form.pool} onChange={handleChange} />
          <Field label="적립금 / 사이클 ($)" name="depositPerCycle" value={form.depositPerCycle} onChange={handleChange} />
          <Field label="G (그라디언트)" name="G" value={form.G} onChange={handleChange} step="1" />
          <Field label="밴드폭 (%)" name="bandPct" value={form.bandPct} onChange={handleChange} step="5" min={5} max={30} />
          <Field label="Pool 사용한도 (%)" name="poolUsageLimit" value={form.poolUsageLimit} onChange={handleChange} step="5" min={10} max={100} />
        </div>

        {/* 결과 */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* 다음 라운드 V */}
              <div className="bg-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">다음 라운드</h2>
                <Row label="다음 V" value={`$${fmt(result.nextV)}`} highlight />
                <Row label="다음 Pool" value={`$${fmt(result.nextPool)}`} />
              </div>

              {/* 밴드 */}
              <div className="bg-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  밴드 (±{form.bandPct}%)
                </h2>
                <Row label="상단 밴드 (평가금)" value={`$${fmt(result.upperBand)}`} color="text-red-400" />
                <Row label="하단 밴드 (평가금)" value={`$${fmt(result.lowerBand)}`} color="text-blue-400" />
              </div>

              {/* 트리거 가격 */}
              <div className="bg-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">트리거 가격 (주당)</h2>
                <Row label="매도 트리거" value={`$${fmt(result.sellTriggerPrice)}`} color="text-red-400" />
                <Row label="매수 트리거" value={`$${fmt(result.buyTriggerPrice)}`} color="text-blue-400" />
              </div>

              {/* 매수 주문 */}
              <div className="bg-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  매수 주문 (하단 밴드 도달 시)
                </h2>
                <Row label="필요 금액" value={`$${fmt(result.buyNeed)}`} />
                <Row label="Pool 최대 사용 가능" value={`$${fmt(result.maxBuy)}`} />
                <Row
                  label="실제 매수금액"
                  value={`$${fmt(result.actualBuy)}`}
                  highlight
                  color={result.poolLimited ? "text-yellow-400" : "text-blue-400"}
                />
                <Row label="매수 수량" value={`${fmt(result.buyShares, 4)}주`} />
                {result.poolLimited && (
                  <p className="text-xs text-yellow-400 mt-2">
                    * Pool 사용한도 제한으로 필요 금액 전액 매수 불가
                  </p>
                )}
              </div>

              {/* 매도 주문 */}
              <div className="bg-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                  매도 주문 (상단 밴드 도달 시)
                </h2>
                <Row label="매도 금액" value={`$${fmt(result.sellAmount)}`} highlight color="text-red-400" />
                <Row label="매도 수량" value={`${fmt(result.sellShares, 4)}주`} />
              </div>
            </>
          ) : (
            <div className="bg-gray-800 rounded-xl p-6 text-gray-500 text-sm">
              보유수량과 G 값을 입력해주세요.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  step = "1",
  min,
  max,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        name={name}
        value={value}
        onChange={onChange}
        step={step}
        min={min}
        max={max}
        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  color,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-700 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-mono font-medium ${color ?? "text-white"} ${highlight ? "text-base" : ""}`}>
        {value}
      </span>
    </div>
  );
}
