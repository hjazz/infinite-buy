import type {
  BacktestInput,
  BacktestResult,
  BuyHoldResult,
  CycleResult,
  DCAResult,
  DailyRecord,
  StockData,
} from "./types";

export function runBacktest(
  input: BacktestInput,
  stockData: StockData[]
): BacktestResult {
  const { totalCapital, rounds, targetReturn } = input;
  const roundAmount = totalCapital / rounds;

  const records: DailyRecord[] = [];
  const cycles: CycleResult[] = [];

  // Cycle state
  let cycleNumber = 1;
  let cycleStartDate = stockData[0]?.date ?? "";
  let totalShares = 0;
  let avgCost = 0;
  let roundsUsed = 0;
  let cycleCash = totalCapital; // cash allocated to current cycle
  let totalCash = totalCapital; // overall cash including realized profits

  for (let i = 0; i < stockData.length; i++) {
    const { date, close } = stockData[i];

    // Check sell condition first: close >= avgCost * (1 + targetReturn)
    if (totalShares > 0 && close >= avgCost * (1 + targetReturn)) {
      const sellValue = totalShares * close;
      totalCash = cycleCash + sellValue;

      records.push({
        date,
        closePrice: close,
        action: "sell",
        buyAmount: 0,
        shares: -totalShares,
        totalShares: 0,
        avgCost: 0,
        roundsUsed,
        cashRemaining: totalCash,
        portfolioValue: totalCash,
        cycleNumber,
      });

      cycles.push({
        cycleNumber,
        startDate: cycleStartDate,
        endDate: date,
        daysHeld: records.filter((r) => r.cycleNumber === cycleNumber).length,
        returnRate: (sellValue - (totalCapital / rounds) * roundsUsed * (roundsUsed > 0 ? 1 : 1)) / totalCapital,
        roundsUsed,
        sellType: "target",
      });

      // Reset for new cycle
      cycleNumber++;
      cycleStartDate = stockData[i + 1]?.date ?? date;
      totalShares = 0;
      avgCost = 0;
      roundsUsed = 0;
      cycleCash = totalCash;
      continue;
    }

    // Check quarter sell if rounds exhausted OR cash depleted (can't buy anymore)
    const minBuyAmount = roundAmount * 0.5; // minimum possible buy (half round)
    if (
      totalShares > 0 &&
      (roundsUsed >= rounds || (cycleCash < minBuyAmount && roundsUsed > 0))
    ) {
      const quarterShares = totalShares * 0.25;
      const sellValue = quarterShares * close;
      totalShares -= quarterShares;
      cycleCash += sellValue;

      // Recalculate: free up some rounds worth of buying power
      const freedRounds = Math.min(Math.floor(rounds * 0.25), roundsUsed);
      roundsUsed -= freedRounds;

      records.push({
        date,
        closePrice: close,
        action: "quarter_sell",
        buyAmount: 0,
        shares: -quarterShares,
        totalShares,
        avgCost,
        roundsUsed,
        cashRemaining: cycleCash,
        portfolioValue: cycleCash + totalShares * close,
        cycleNumber,
      });

      continue;
    }

    // Buy logic
    if (roundsUsed < rounds) {
      let buyAmount: number;
      let action: "buy_full" | "buy_half";

      if (roundsUsed === 0) {
        // First buy: always full round
        buyAmount = roundAmount;
        action = "buy_full";
      } else if (close < avgCost) {
        // Price below average: buy full round
        buyAmount = roundAmount;
        action = "buy_full";
      } else {
        // Price at or above average: buy half round
        buyAmount = roundAmount * 0.5;
        action = "buy_half";
      }

      // Don't exceed available cash
      buyAmount = Math.min(buyAmount, cycleCash);

      if (buyAmount > 0 && close > 0) {
        const sharesBought = buyAmount / close;
        const prevTotalCost = avgCost * totalShares;
        totalShares += sharesBought;
        avgCost = (prevTotalCost + buyAmount) / totalShares;
        cycleCash -= buyAmount;

        roundsUsed += action === "buy_full" ? 1 : 0.5;

        records.push({
          date,
          closePrice: close,
          action,
          buyAmount,
          shares: sharesBought,
          totalShares,
          avgCost,
          roundsUsed,
          cashRemaining: cycleCash,
          portfolioValue: cycleCash + totalShares * close,
          cycleNumber,
        });
      } else {
        // No cash to buy, record as hold
        records.push({
          date,
          closePrice: close,
          action: "hold",
          buyAmount: 0,
          shares: 0,
          totalShares,
          avgCost,
          roundsUsed,
          cashRemaining: cycleCash,
          portfolioValue: cycleCash + totalShares * close,
          cycleNumber,
        });
      }
    } else {
      // No rounds left, just hold
      records.push({
        date,
        closePrice: close,
        action: "hold",
        buyAmount: 0,
        shares: 0,
        totalShares,
        avgCost,
        roundsUsed,
        cashRemaining: cycleCash,
        portfolioValue: cycleCash + totalShares * close,
        cycleNumber,
      });
    }
  }

  // If there's an ongoing cycle at the end
  if (totalShares > 0) {
    const lastPrice = stockData[stockData.length - 1]?.close ?? 0;
    cycles.push({
      cycleNumber,
      startDate: cycleStartDate,
      endDate: stockData[stockData.length - 1]?.date ?? "",
      daysHeld: records.filter((r) => r.cycleNumber === cycleNumber).length,
      returnRate: 0,
      roundsUsed,
      sellType: "ongoing",
    });
  }

  const lastRecord = records[records.length - 1];
  const finalValue = lastRecord?.portfolioValue ?? totalCapital;

  // Buy & Hold benchmark: invest all capital at first day's close
  const firstClose = stockData[0]?.close ?? 1;
  const bhShares = totalCapital / firstClose;
  const buyHold: BuyHoldResult = {
    finalValue: bhShares * (stockData[stockData.length - 1]?.close ?? firstClose),
    totalReturn:
      (((stockData[stockData.length - 1]?.close ?? firstClose) - firstClose) /
        firstClose) *
      100,
    dailyValues: stockData.map((d) => ({
      date: d.date,
      value: Math.round(bhShares * d.close * 100) / 100,
    })),
  };

  // DCA benchmark: invest fixed amount monthly
  const dcaMonthly = input.dcaMonthlyAmount ?? 500;
  let dcaShares = 0;
  let dcaTotalInvested = 0;
  let dcaLastMonth = "";
  const dcaDailyValues: { date: string; value: number }[] = [];

  for (const d of stockData) {
    const month = d.date.slice(0, 7); // YYYY-MM
    if (month !== dcaLastMonth) {
      // First trading day of new month: invest
      dcaShares += dcaMonthly / d.close;
      dcaTotalInvested += dcaMonthly;
      dcaLastMonth = month;
    }
    dcaDailyValues.push({
      date: d.date,
      value: Math.round(dcaShares * d.close * 100) / 100,
    });
  }

  const dcaFinalValue = dcaDailyValues[dcaDailyValues.length - 1]?.value ?? 0;
  const dca: DCAResult = {
    finalValue: dcaFinalValue,
    totalInvested: dcaTotalInvested,
    totalReturn:
      dcaTotalInvested > 0
        ? ((dcaFinalValue - dcaTotalInvested) / dcaTotalInvested) * 100
        : 0,
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
