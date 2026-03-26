import type {
  BacktestInput,
  BacktestResult,
  BuyHoldResult,
  CycleResult,
  DCAResult,
  DailyRecord,
  StockData,
} from "./types";

/**
 * 무한매수법 V4.0 시뮬레이터
 *
 * 핵심 차이 (V1 대비):
 * - T값: 소수점 카운터. 매수 +1/+0.5, 쿼터 ×0.75
 * - 별지점: avgCost × (1 + (15 - 0.75×T)%) — T에 따라 동적으로 변함
 * - 1회 매수금: 잔금 / (분할수 - T) — 동적 계산
 * - 전반전(T < rounds/2): 별지점 아래 0.5배, avgCost 아래 1배
 * - 후반전(T >= rounds/2): 별지점 아래 1배 (별지점이 avgCost 이하로 내려감)
 * - 익절: close >= avgCost×1.15 → 전량매도 / close >= 별지점 → 쿼터 매도 T×0.75
 * - 소진(T > rounds-1): 리버스모드 전환
 * - 리버스모드: 별지점=5일MA, 첫날 MOC매도, 이후 별지점 기준 매도/쿼터매수
 */
export function runBacktestV4(
  input: BacktestInput,
  stockData: StockData[]
): BacktestResult {
  const { totalCapital, rounds } = input;
  const FINAL_EXIT_MULT = 1.15; // avgCost × 1.15: 최종 익절 목표
  const REVERSE_EXIT_LOSS = 0.15; // 리버스 종료: close > avgCost × (1 - 0.15)
  const MA_WINDOW = 5;

  const records: DailyRecord[] = [];
  const cycles: CycleResult[] = [];

  let cycleNumber = 1;
  let cycleStartDate = stockData[0]?.date ?? "";
  let totalShares = 0;
  let avgCost = 0;
  let T = 0;
  let cycleCash = totalCapital;
  let totalCash = totalCapital;
  let mode: "normal" | "reverse" = "normal";
  let reverseFirstDay = false;

  // Sliding window of recent closes (for MA5 in reverse mode)
  const recentCloses: number[] = [];

  function starPoint(): number {
    if (avgCost <= 0) return 0;
    const starPct = (15 - 0.75 * T) / 100;
    return avgCost * (1 + starPct);
  }

  function ma5(): number {
    const window = recentCloses.slice(-MA_WINDOW);
    if (window.length === 0) return 0;
    return window.reduce((a, b) => a + b, 0) / window.length;
  }

  function recordHold(date: string, close: number) {
    records.push({
      date, closePrice: close, action: "hold",
      buyAmount: 0, shares: 0, totalShares, avgCost,
      roundsUsed: T, cashRemaining: cycleCash,
      portfolioValue: cycleCash + totalShares * close, cycleNumber,
    });
  }

  function doBuy(
    date: string,
    close: number,
    amount: number,
    action: "buy_full" | "buy_half",
    tDelta: number
  ) {
    const capped = Math.min(amount, cycleCash);
    if (capped <= 0 || close <= 0) {
      recordHold(date, close);
      return;
    }
    const shares = capped / close;
    avgCost = (avgCost * totalShares + capped) / (totalShares + shares);
    totalShares += shares;
    cycleCash -= capped;
    T += tDelta;
    records.push({
      date, closePrice: close, action, buyAmount: capped, shares,
      totalShares, avgCost, roundsUsed: T, cashRemaining: cycleCash,
      portfolioValue: cycleCash + totalShares * close, cycleNumber,
    });
  }

  function doQuarterSell(date: string, close: number, shares: number) {
    const sellValue = shares * close;
    totalShares -= shares;
    cycleCash += sellValue;
    if (mode === "normal") {
      T = T * 0.75;
    }
    records.push({
      date, closePrice: close, action: "quarter_sell",
      buyAmount: 0, shares: -shares, totalShares, avgCost,
      roundsUsed: T, cashRemaining: cycleCash,
      portfolioValue: cycleCash + totalShares * close, cycleNumber,
    });
  }

  function doFullSell(date: string, close: number) {
    const sellValue = totalShares * close;
    totalCash = cycleCash + sellValue;

    cycles.push({
      cycleNumber,
      startDate: cycleStartDate,
      endDate: date,
      daysHeld: records.filter((r) => r.cycleNumber === cycleNumber).length,
      returnRate: ((totalCash - totalCapital) / totalCapital) * 100,
      roundsUsed: T,
      sellType: "target",
    });

    records.push({
      date, closePrice: close, action: "sell",
      buyAmount: 0, shares: -totalShares, totalShares: 0, avgCost: 0,
      roundsUsed: T, cashRemaining: totalCash,
      portfolioValue: totalCash, cycleNumber,
    });

    cycleNumber++;
    cycleStartDate = stockData.find((_, idx) => stockData[idx - 1]?.date === date)?.date ?? "";
    totalShares = 0; avgCost = 0; T = 0;
    cycleCash = totalCash;
    mode = "normal";
  }

  for (let i = 0; i < stockData.length; i++) {
    const { date, close } = stockData[i];
    const star = starPoint();
    const finalExit = avgCost > 0 ? avgCost * FINAL_EXIT_MULT : 0;

    if (mode === "reverse") {
      const ma = ma5();

      // 종료 조건: 종가가 보유평단 기준 -15% 이상 회복
      if (totalShares > 0 && avgCost > 0 && close > avgCost * (1 - REVERSE_EXIT_LOSS)) {
        mode = "normal";
        reverseFirstDay = false;
        recordHold(date, close);
        recentCloses.push(close);
        continue;
      }

      if (reverseFirstDay) {
        // 첫날: MOC 무조건 매도 (보유수량 / (rounds/2) 등분)
        reverseFirstDay = false;
        const sellCount = Math.floor(totalShares / (rounds / 2));
        if (sellCount > 0 && totalShares > 0) {
          const saleShares = Math.min(sellCount, totalShares);
          const sellValue = saleShares * close;
          totalShares -= saleShares;
          cycleCash += sellValue;
          T = T * 0.95; // 40분할: 매도 시 T × 0.95
          records.push({
            date, closePrice: close, action: "quarter_sell",
            buyAmount: 0, shares: -saleShares, totalShares, avgCost,
            roundsUsed: T, cashRemaining: cycleCash,
            portfolioValue: cycleCash + totalShares * close, cycleNumber,
          });
        } else {
          recordHold(date, close);
        }
      } else {
        // 둘째날 이후: 별지점(MA5) 기준 매도 or 쿼터매수
        if (ma > 0 && close >= ma) {
          // 별지점 이상: 매도 (보유수량 / (rounds/2) 등분)
          const sellCount = Math.floor(totalShares / (rounds / 2));
          if (sellCount > 0 && totalShares > 0) {
            const saleShares = Math.min(sellCount, totalShares);
            const sellValue = saleShares * close;
            totalShares -= saleShares;
            cycleCash += sellValue;
            T = T * 0.95;
            records.push({
              date, closePrice: close, action: "quarter_sell",
              buyAmount: 0, shares: -saleShares, totalShares, avgCost,
              roundsUsed: T, cashRemaining: cycleCash,
              portfolioValue: cycleCash + totalShares * close, cycleNumber,
            });
            // 전량 매도 시 사이클 종료
            if (totalShares <= 0) {
              totalCash = cycleCash;
              cycles.push({
                cycleNumber, startDate: cycleStartDate, endDate: date,
                daysHeld: records.filter((r) => r.cycleNumber === cycleNumber).length,
                returnRate: ((totalCash - totalCapital) / totalCapital) * 100,
                roundsUsed: T, sellType: "quarter_sell",
              });
              cycleNumber++;
              cycleStartDate = stockData[i + 1]?.date ?? date;
              totalShares = 0; avgCost = 0; T = 0; mode = "normal";
              cycleCash = totalCash;
            }
          } else {
            recordHold(date, close);
          }
        } else {
          // 별지점 미만: 쿼터매수 (잔금/4)
          const buyAmount = cycleCash / 4;
          if (buyAmount > 0 && close > 0) {
            const shares = buyAmount / close;
            avgCost = totalShares > 0
              ? (avgCost * totalShares + buyAmount) / (totalShares + shares)
              : close;
            totalShares += shares;
            cycleCash -= buyAmount;
            T = T + (rounds - T) * 0.25; // 매수 시 T 증가
            records.push({
              date, closePrice: close, action: "buy_half",
              buyAmount, shares, totalShares, avgCost,
              roundsUsed: T, cashRemaining: cycleCash,
              portfolioValue: cycleCash + totalShares * close, cycleNumber,
            });
          } else {
            recordHold(date, close);
          }
        }
      }

      recentCloses.push(close);
      continue;
    }

    // ── NORMAL MODE ──

    // 1. 최종 익절: close >= avgCost × 1.15
    if (totalShares > 0 && finalExit > 0 && close >= finalExit) {
      doFullSell(date, close);
      recentCloses.push(close);
      continue;
    }

    // 2. 별지점 쿼터 매도 (별지점 < 최종 익절 목표일 때)
    if (totalShares > 0 && star > 0 && close >= star && close < finalExit) {
      doQuarterSell(date, close, totalShares * 0.25);
      recentCloses.push(close);
      continue;
    }

    // 3. 소진 → 리버스모드 전환
    if (T > rounds - 1 && totalShares > 0) {
      mode = "reverse";
      reverseFirstDay = true;
      // 첫날 매도 즉시 처리
      const sellCount = Math.floor(totalShares / (rounds / 2));
      if (sellCount > 0) {
        const saleShares = Math.min(sellCount, totalShares);
        const sellValue = saleShares * close;
        totalShares -= saleShares;
        cycleCash += sellValue;
        T = T * 0.95;
        records.push({
          date, closePrice: close, action: "quarter_sell",
          buyAmount: 0, shares: -saleShares, totalShares, avgCost,
          roundsUsed: T, cashRemaining: cycleCash,
          portfolioValue: cycleCash + totalShares * close, cycleNumber,
        });
      } else {
        recordHold(date, close);
      }
      reverseFirstDay = false;
      recentCloses.push(close);
      continue;
    }

    // 4. 매수 로직
    if (cycleCash > 0 && T < rounds) {
      const buyAmount = cycleCash / Math.max(rounds - T, 0.5);

      if (totalShares === 0) {
        // 첫 매수: 무조건 1배
        doBuy(date, close, buyAmount, "buy_full", 1);
      } else if (T < rounds / 2) {
        // 전반전
        if (close <= avgCost) {
          // 평단 이하 → 1배
          doBuy(date, close, buyAmount, "buy_full", 1);
        } else if (star > 0 && close < star) {
          // 평단 ~ 별지점 사이 → 0.5배
          doBuy(date, close, buyAmount * 0.5, "buy_half", 0.5);
        } else {
          recordHold(date, close);
        }
      } else {
        // 후반전 (별지점 ≤ avgCost)
        if (star > 0 && close < star) {
          // 별지점 미만 → 1배
          doBuy(date, close, buyAmount, "buy_full", 1);
        } else {
          recordHold(date, close);
        }
      }
    } else {
      recordHold(date, close);
    }

    recentCloses.push(close);
  }

  // 미완 사이클
  if (totalShares > 0 || cycleCash < totalCash) {
    cycles.push({
      cycleNumber,
      startDate: cycleStartDate,
      endDate: stockData[stockData.length - 1]?.date ?? "",
      daysHeld: records.filter((r) => r.cycleNumber === cycleNumber).length,
      returnRate: 0,
      roundsUsed: T,
      sellType: "ongoing",
    });
  }

  const lastRecord = records[records.length - 1];
  const finalValue = lastRecord?.portfolioValue ?? totalCapital;

  // Buy & Hold 벤치마크
  const firstClose = stockData[0]?.close ?? 1;
  const bhShares = totalCapital / firstClose;
  const buyHold: BuyHoldResult = {
    finalValue: bhShares * (stockData[stockData.length - 1]?.close ?? firstClose),
    totalReturn:
      (((stockData[stockData.length - 1]?.close ?? firstClose) - firstClose) / firstClose) * 100,
    dailyValues: stockData.map((d) => ({
      date: d.date,
      value: Math.round(bhShares * d.close * 100) / 100,
    })),
  };

  // DCA 벤치마크
  const dcaMonthly = input.dcaMonthlyAmount ?? 500;
  let dcaShares = 0, dcaTotalInvested = 0, dcaLastMonth = "";
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
    totalReturn:
      dcaTotalInvested > 0 ? ((dcaFinalValue - dcaTotalInvested) / dcaTotalInvested) * 100 : 0,
    dailyValues: dcaDailyValues,
  };

  return {
    records,
    cycles,
    totalReturn: ((finalValue - totalCapital) / totalCapital) * 100,
    finalValue,
    totalCapital,
    buyHold,
    dca,
  };
}
