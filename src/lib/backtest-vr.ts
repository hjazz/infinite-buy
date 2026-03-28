import type { VRInput, VRResult, VRDailyRecord, BuyHoldResult, DCAResult, StockData } from './types';

export function runBacktestVR(input: VRInput, stockData: StockData[]): VRResult {
  const { initialV, initialPool, G, bandPct, depositPerCycle, poolUsageLimit } = input;

  const firstPrice = stockData[0]?.close ?? 1;
  let shares = initialV / firstPrice;
  let pool = initialPool;
  let V = initialV;
  let lastRebalanceDate = new Date(stockData[0]?.date ?? '');
  let cycleNumber = 1;
  let totalInvested = initialV + initialPool;
  let buyCount = 0;
  let sellCount = 0;

  const records: VRDailyRecord[] = [];

  for (let i = 0; i < stockData.length; i++) {
    const { date, close } = stockData[i];
    const currentDate = new Date(date);
    const daysSinceRebalance = Math.floor(
      (currentDate.getTime() - lastRebalanceDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const isRebalanceDay = i === 0 || daysSinceRebalance >= 14;

    let action: VRDailyRecord['action'] = 'hold';
    let tradeAmount = 0;

    if (isRebalanceDay && i > 0) {
      // 1. V 갱신: 적립금 추가 전 Pool 기준으로 V 증가
      const poolBeforeDeposit = pool;
      V = V + poolBeforeDeposit / G + depositPerCycle;
      pool += depositPerCycle;
      totalInvested += depositPerCycle;
      cycleNumber++;
      lastRebalanceDate = currentDate;

      // 2. 밴드 체크
      const stockValue = shares * close;
      const upperBand = V * (1 + bandPct);
      const lowerBand = V * (1 - bandPct);

      if (stockValue < lowerBand) {
        // 매수
        const need = V - stockValue;
        const maxBuy = pool * poolUsageLimit;
        const buyAmount = Math.min(need, maxBuy, pool);
        if (buyAmount > 0 && close > 0) {
          shares += buyAmount / close;
          pool -= buyAmount;
          tradeAmount = buyAmount;
          action = 'buy';
          buyCount++;
        } else {
          action = 'rebalance_hold';
        }
      } else if (stockValue > upperBand) {
        // 매도
        const excess = stockValue - V;
        const sellShares = excess / close;
        shares -= sellShares;
        pool += excess;
        tradeAmount = -excess;
        action = 'sell';
        sellCount++;
      } else {
        action = 'rebalance_hold';
      }
    }

    const stockValue = shares * close;
    const totalValue = stockValue + pool;

    records.push({
      date,
      closePrice: close,
      stockValue,
      pool,
      totalValue,
      V,
      upperBand: V * (1 + bandPct),
      lowerBand: V * (1 - bandPct),
      action,
      tradeAmount,
      cycleNumber,
      isRebalanceDay: isRebalanceDay && i > 0,
    });
  }

  const lastRecord = records[records.length - 1];
  const finalValue = lastRecord?.totalValue ?? totalInvested;
  const totalReturn = ((finalValue - totalInvested) / totalInvested) * 100;

  // Buy & Hold 벤치마크
  const bhShares = (initialV + initialPool) / firstPrice;
  const lastClose = stockData[stockData.length - 1]?.close ?? firstPrice;
  const buyHold: BuyHoldResult = {
    finalValue: bhShares * lastClose,
    totalReturn: ((lastClose - firstPrice) / firstPrice) * 100,
    dailyValues: stockData.map((d) => ({
      date: d.date,
      value: Math.round(bhShares * d.close * 100) / 100,
    })),
  };

  // DCA 벤치마크
  const dcaMonthly = input.dcaMonthlyAmount ?? 500;
  let dcaShares = 0;
  let dcaTotalInvested = 0;
  let dcaLastMonth = '';
  const dcaDailyValues: { date: string; value: number }[] = [];
  for (const d of stockData) {
    const month = d.date.slice(0, 7);
    if (month !== dcaLastMonth) {
      dcaShares += dcaMonthly / d.close;
      dcaTotalInvested += dcaMonthly;
      dcaLastMonth = month;
    }
    dcaDailyValues.push({ date: d.date, value: Math.round(dcaShares * d.close * 100) / 100 });
  }
  const dcaFinalValue = dcaDailyValues[dcaDailyValues.length - 1]?.value ?? 0;
  const dca: DCAResult = {
    finalValue: dcaFinalValue,
    totalInvested: dcaTotalInvested,
    totalReturn: dcaTotalInvested > 0 ? ((dcaFinalValue - dcaTotalInvested) / dcaTotalInvested) * 100 : 0,
    dailyValues: dcaDailyValues,
  };

  return {
    records,
    totalReturn,
    finalValue,
    totalInvested,
    finalStockValue: lastRecord?.stockValue ?? 0,
    finalPool: lastRecord?.pool ?? 0,
    buyCount,
    sellCount,
    totalCycles: cycleNumber,
    buyHold,
    dca,
  };
}
