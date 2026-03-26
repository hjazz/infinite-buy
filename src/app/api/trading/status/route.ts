import { NextResponse } from "next/server";
import { loadState } from "@/lib/trading/state";

export async function GET() {
  const state = await loadState();

  if (!state) {
    return NextResponse.json({ active: false, state: null });
  }

  const { config, cycle } = state;
  const portfolioValue =
    cycle.cycleCash + cycle.totalShares * (cycle.avgCost || 0);

  return NextResponse.json({
    active: true,
    state: {
      ...state,
      computed: {
        targetPrice: +(cycle.avgCost * (1 + config.targetReturn)).toFixed(2),
        roundAmount: +(config.totalCapital / config.rounds).toFixed(2),
        portfolioValue: +portfolioValue.toFixed(2),
        roundsRemaining: config.rounds - cycle.roundsUsed,
        capitalUsageRate: +(
          ((config.totalCapital - cycle.cycleCash) / config.totalCapital) *
          100
        ).toFixed(1),
      },
    },
  });
}
