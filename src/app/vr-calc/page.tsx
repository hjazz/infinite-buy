"use client";

import { useState, useMemo } from "react";
import NavTabs from "@/components/NavTabs";

interface CalcInput {
  currentV: number;
  shares: number;
  pool: number;
  poolUsageLimit: number;
  G: number;
  depositPerCycle: number;
  bandPct: number;
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

    const nextV = currentV + pool / G + depositPerCycle;
    const nextPool = pool + depositPerCycle;

    const upperBand = nextV * (1 + band);
    const lowerBand = nextV * (1 - band);
    const buyTriggerPrice = lowerBand / shares;
    const sellTriggerPrice = upperBand / shares;

    const buyNeed = nextV - lowerBand;
    const maxBuy = nextPool * usageLimit;
    const actualBuy = Math.min(buyNeed, maxBuy, nextPool);
    const sellAmount = upperBand - nextV;

    // 매수 사다리: k번째 매수가 = lowerBand / (shares + k - 1)
    // 해석: 매수 직전 (shares+k-1)주 × 가격 = 하단밴드가 되는 시점에 1주 추가 매수
    type BuyRow = { k: number; totalShares: number; price: number; pool: number };
    const buyRows: BuyRow[] = [];
    let buyPool = nextPool;
    for (let k = 1; k <= 50; k++) {
      const price = lowerBand / (shares + k - 1);
      if (buyPool < price) break;
      buyPool -= price;
      buyRows.push({ k, totalShares: shares + k, price, pool: buyPool });
    }

    // 매도 사다리: k번째 매도가 = upperBand / (shares - k + 1)
    // 해석: 매도 직전 (shares-k+1)주 × 가격 = 상단밴드가 되는 시점에 1주 매도
    type SellRow = { k: number; remainShares: number; price: number; pool: number };
    const sellRows: SellRow[] = [];
    let sellPool = nextPool;
    for (let k = 1; k <= 50; k++) {
      const beforeSellShares = shares - k + 1;
      if (beforeSellShares <= 0) break;
      const price = upperBand / beforeSellShares;
      sellPool += price;
      sellRows.push({ k, remainShares: shares - k, price, pool: sellPool });
    }

    return {
      nextV,
      nextPool,
      upperBand,
      lowerBand,
      buyTriggerPrice,
      sellTriggerPrice,
      buyNeed,
      maxBuy,
      actualBuy,
      sellAmount,
      poolLimited: buyNeed > maxBuy,
      buyRows,
      sellRows,
    };
  }, [form]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <NavTabs />
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">VR 라운드 계산기</h1>
        <p className="text-gray-400 text-sm">2주 사이클 기준 1주 단위 매수/매도 잔량주문 가격을 계산합니다.</p>
      </div>

      {/* 입력 */}
      <div className="bg-gray-800 rounded-xl p-5 mb-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">입력값</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Field label="현재 V ($)" name="currentV" value={form.currentV} onChange={handleChange} />
          <Field label="보유수량 (주)" name="shares" value={form.shares} onChange={handleChange} step="1" />
          <Field label="Pool ($)" name="pool" value={form.pool} onChange={handleChange} />
          <Field label="적립금/사이클 ($)" name="depositPerCycle" value={form.depositPerCycle} onChange={handleChange} />
          <Field label="G" name="G" value={form.G} onChange={handleChange} step="1" />
          <Field label="밴드폭 (%)" name="bandPct" value={form.bandPct} onChange={handleChange} step="5" min={5} max={30} />
          <Field label="Pool 한도 (%)" name="poolUsageLimit" value={form.poolUsageLimit} onChange={handleChange} step="5" min={10} max={100} />
        </div>
      </div>

      {result && (
        <>
          {/* 요약 */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
            <SummaryCard label="다음 V" value={`$${fmt(result.nextV)}`} />
            <SummaryCard label="다음 Pool" value={`$${fmt(result.nextPool)}`} />
            <SummaryCard
              label="하단 밴드"
              value={`$${fmt(result.lowerBand)}`}
              color="text-blue-400"
              sub={`매수 트리거 $${fmt(result.buyTriggerPrice)}/주`}
            />
            <SummaryCard
              label="상단 밴드"
              value={`$${fmt(result.upperBand)}`}
              color="text-red-400"
              sub={`매도 트리거 $${fmt(result.sellTriggerPrice)}/주`}
            />
          </div>

          {/* 주문 테이블 */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* 매수 테이블 */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-blue-400">매수 잔량주문</h2>
                <p className="text-xs text-gray-500 mt-0.5">주문가 = 하단밴드 ÷ 매수 전 보유수량</p>
              </div>
              <div className="overflow-y-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">#</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">잔여개수</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">매수점</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-yellow-400/10 border-b border-gray-700">
                      <td className="px-4 py-2 text-yellow-400 font-semibold text-xs">현재</td>
                      <td className="px-4 py-2 text-right text-yellow-400 font-semibold">{form.shares}</td>
                      <td className="px-4 py-2 text-right text-gray-500">—</td>
                      <td className="px-4 py-2 text-right text-yellow-400 font-semibold font-mono">{fmt(result.nextPool)}</td>
                    </tr>
                    {result.buyRows.map((row) => (
                      <tr key={row.k} className="border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-2 text-gray-500 text-xs">{row.k}</td>
                        <td className="px-4 py-2 text-right text-white">{row.totalShares}</td>
                        <td className="px-4 py-2 text-right text-blue-400 font-mono font-semibold">{fmt(row.price)}</td>
                        <td className="px-4 py-2 text-right text-gray-300 font-mono">{fmt(row.pool)}</td>
                      </tr>
                    ))}
                    {result.buyRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-gray-500 text-xs">Pool 잔액 부족</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 매도 테이블 */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-red-400">매도 잔량주문</h2>
                <p className="text-xs text-gray-500 mt-0.5">주문가 = 상단밴드 ÷ 매도 전 보유수량</p>
              </div>
              <div className="overflow-y-auto max-h-[480px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800">
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-2 text-left text-xs text-gray-500 font-medium">#</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">잔여개수</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">매도점</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 font-medium">Pool</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-yellow-400/10 border-b border-gray-700">
                      <td className="px-4 py-2 text-yellow-400 font-semibold text-xs">현재</td>
                      <td className="px-4 py-2 text-right text-yellow-400 font-semibold">{form.shares}</td>
                      <td className="px-4 py-2 text-right text-gray-500">—</td>
                      <td className="px-4 py-2 text-right text-yellow-400 font-semibold font-mono">{fmt(result.nextPool)}</td>
                    </tr>
                    {result.sellRows.map((row) => (
                      <tr key={row.k} className="border-b border-gray-700/40 hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-2 text-gray-500 text-xs">{row.k}</td>
                        <td className="px-4 py-2 text-right text-white">{row.remainShares}</td>
                        <td className="px-4 py-2 text-right text-red-400 font-mono font-semibold">{fmt(row.price)}</td>
                        <td className="px-4 py-2 text-right text-gray-300 font-mono">{fmt(row.pool)}</td>
                      </tr>
                    ))}
                    {result.sellRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-4 text-center text-gray-500 text-xs">보유수량 없음</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
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

function SummaryCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
