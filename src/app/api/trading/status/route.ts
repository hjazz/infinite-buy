import { NextResponse } from "next/server";
import { loadState } from "@/lib/trading/state";
import { starPoint, ma5 } from "@/lib/trading/strategy-v4";

export async function GET() {
  const state = await loadState();

  if (!state) {
    return NextResponse.json({ active: false, state: null });
  }

  const { config, cycle } = state;
  const portfolioValue =
    cycle.cycleCash + cycle.totalShares * (cycle.avgCost || 0);

  const star = starPoint(cycle.avgCost, cycle.T);
  const target = +(cycle.avgCost * (1 + config.targetReturn)).toFixed(2);
  const reverseExit = +(cycle.avgCost * 0.85).toFixed(2);

  return NextResponse.json({
    active: true,
    state: {
      ...state,
      computed: {
        starPoint: star,
        targetPrice: target,
        reverseExitPrice: reverseExit,
        ma5: ma5(cycle.recentCloses),
        nextBuyAmount:
          cycle.T < config.rounds
            ? +(cycle.cycleCash / Math.max(config.rounds - cycle.T, 0.5)).toFixed(2)
            : 0,
        portfolioValue: +portfolioValue.toFixed(2),
        roundsRemaining: +(config.rounds - cycle.T).toFixed(2),
        capitalUsageRate: +(
          ((config.totalCapital - cycle.cycleCash) / config.totalCapital) *
          100
        ).toFixed(1),
      },
    },
  });
}
