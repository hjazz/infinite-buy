import type {
  CycleState,
  FilledOrder,
  OrderKind,
  PlannedOrder,
  TradingConfig,
} from "./types";

/** kind → side 매핑. 매수 kind 만 화이트리스트, 나머지는 매도. */
export function sideOfKind(kind: OrderKind): "buy" | "sell" {
  switch (kind) {
    case "buy_half_star":
    case "buy_half_avg":
    case "buy_full_star":
    case "reverse_quarter_buy":
      return "buy";
    default:
      return "sell";
  }
}

/**
 * 무한매수법 V4.0 실전 전략 모듈
 *
 * 두 가지 책임:
 *  1) planV4Orders(state, refPrice): 오늘 제출할 LOC 주문 목록
 *  2) applyFillsV4(state, fills, todayClose): 실체결 결과를 state 에 반영
 *
 * 백테스트 엔진(`src/lib/backtest-v4.ts`)과 동일한 수식 (T·별지점·MA5)을 사용하되,
 * 백테스트는 종가 한 점에 단일 액션을 결정하는 반면 실전은 LOC를 미리 N개 걸어둔다.
 */

const MA_WINDOW = 5;

export function starPoint(avgCost: number, T: number): number {
  if (avgCost <= 0) return 0;
  const starPct = (15 - 0.75 * T) / 100;
  return +(avgCost * (1 + starPct)).toFixed(2);
}

export function ma5(recentCloses: number[]): number {
  const window = recentCloses.slice(-MA_WINDOW);
  if (window.length === 0) return 0;
  const avg = window.reduce((a, b) => a + b, 0) / window.length;
  return +avg.toFixed(2);
}

function reverseExitThreshold(avgCost: number): number {
  // TQQQ 기준 -15%. SOXL 기준은 -20% (필요 시 ticker 분기).
  return +(avgCost * (1 - 0.15)).toFixed(2);
}

function priceWithBuyMargin(price: number, marginPct: number): number {
  // LOC 매수 한도가는 의미상 "이하면 체결". KIS 한도가에 약간의 슬리피지 마진을 더해 거부 회피.
  return +(price * (1 + marginPct)).toFixed(2);
}

function priceWithSellMargin(price: number, marginPct: number): number {
  // LOC 매도 한도가는 의미상 "이상이면 체결". 매도는 한도가를 살짝 낮춰 거부 회피.
  return +(price * (1 - marginPct)).toFixed(2);
}

/**
 * 오늘 제출할 V4 주문 목록을 만든다. (LOC 위주)
 *
 * @param refPrice 현재가 (KIS getCurrentPrice). 첫 매수 reference 및 수량 산정용.
 */
export function planV4Orders(
  config: TradingConfig,
  state: CycleState,
  refPrice: number,
): PlannedOrder[] {
  const orders: PlannedOrder[] = [];
  const { rounds, locPriceMargin, targetReturn } = config;
  const { mode, totalShares, avgCost, T, cycleCash } = state;

  if (refPrice <= 0) return orders;

  // ─────────────── REVERSE MODE ───────────────
  if (mode === "reverse" && totalShares > 0) {
    // 리버스모드 종료 조건은 settle 단계에서 종가로 체크. 여기 도달했다는 건 아직 리버스 유지 중.
    const lotSize = Math.floor(totalShares / (rounds / 2));

    if (state.reverseFirstDay) {
      // 첫날: MOC 매도. KIS 해외주식 시장가 미지원 → LOC 한도가를 매우 낮게 잡아 사실상 시장가 효과.
      if (lotSize > 0) {
        orders.push({
          kind: "reverse_moc_sell",
          side: "sell",
          quantity: lotSize,
          limitPrice: priceWithSellMargin(refPrice, 0.2), // 강제 체결 목적: -20%
          reason: `리버스 첫날 MOC 매도 ${lotSize}주`,
        });
      }
      return orders;
    }

    // 둘째날 이후: 별지점 = MA5. MA5 < 0 이면 refPrice fallback.
    const star = ma5(state.recentCloses) || refPrice;

    // 매도 ladder
    if (lotSize > 0) {
      orders.push({
        kind: "reverse_ladder_sell",
        side: "sell",
        quantity: lotSize,
        limitPrice: priceWithSellMargin(star, locPriceMargin),
        reason: `리버스 매도 ${lotSize}주 @ MA5≈$${star.toFixed(2)}`,
      });
    }

    // 쿼터 매수
    const buyAmount = cycleCash / 4;
    const buyLimit = priceWithBuyMargin(star, locPriceMargin);
    const buyQty = Math.floor(buyAmount / buyLimit);
    if (buyQty > 0 && buyAmount > 0) {
      orders.push({
        kind: "reverse_quarter_buy",
        side: "buy",
        quantity: buyQty,
        limitPrice: buyLimit,
        reason: `리버스 쿼터매수 ${buyQty}주 @ MA5≈$${star.toFixed(2)}`,
      });
    }

    return orders;
  }

  // ─────────────── NORMAL MODE ───────────────

  // 매수 가능한지
  if (cycleCash > 0 && T < rounds) {
    const buyAmount = cycleCash / Math.max(rounds - T, 0.5);

    if (totalShares === 0) {
      // 첫 매수: 1배 LOC @ 현재가 (기준가). 한도가는 약간 위로.
      const limit = priceWithBuyMargin(refPrice, locPriceMargin);
      const qty = Math.floor(buyAmount / limit);
      if (qty > 0) {
        orders.push({
          kind: "buy_full_star",
          side: "buy",
          quantity: qty,
          limitPrice: limit,
          reason: `첫 매수 1배 (${qty}주 × $${limit.toFixed(2)})`,
        });
      }
    } else {
      const star = starPoint(avgCost, T);

      if (T < rounds / 2) {
        // 전반전: 두 LOC 동시 제출 (별지점 0.5배 + 평단가 0.5배)
        const half = buyAmount * 0.5;

        const starLimit = priceWithBuyMargin(star, locPriceMargin);
        const starQty = Math.floor(half / starLimit);
        if (starQty > 0) {
          orders.push({
            kind: "buy_half_star",
            side: "buy",
            quantity: starQty,
            limitPrice: starLimit,
            reason: `전반전 별지점 0.5배 (${starQty}주 × $${starLimit.toFixed(2)}, T=${T.toFixed(2)})`,
          });
        }

        const avgLimit = priceWithBuyMargin(avgCost, locPriceMargin);
        const avgQty = Math.floor(half / avgLimit);
        if (avgQty > 0) {
          orders.push({
            kind: "buy_half_avg",
            side: "buy",
            quantity: avgQty,
            limitPrice: avgLimit,
            reason: `전반전 평단가 0.5배 (${avgQty}주 × $${avgLimit.toFixed(2)}, T=${T.toFixed(2)})`,
          });
        }
      } else {
        // 후반전: 1건 (별지점 1배). 후반전엔 별지점 ≤ avgCost.
        const starLimit = priceWithBuyMargin(star, locPriceMargin);
        const qty = Math.floor(buyAmount / starLimit);
        if (qty > 0) {
          orders.push({
            kind: "buy_full_star",
            side: "buy",
            quantity: qty,
            limitPrice: starLimit,
            reason: `후반전 별지점 1배 (${qty}주 × $${starLimit.toFixed(2)}, T=${T.toFixed(2)})`,
          });
        }
      }
    }
  }

  // 매도 (보유중일 때만, 보유 0이면 사이클 시작 전이라 매도 없음)
  if (totalShares > 0 && avgCost > 0) {
    const star = starPoint(avgCost, T);
    const target = +(avgCost * (1 + targetReturn)).toFixed(2);

    // 쿼터 LOC 매도 @ 별지점
    const quarterQty = Math.floor(totalShares * 0.25);
    if (quarterQty > 0 && star > 0) {
      orders.push({
        kind: "quarter_sell_star",
        side: "sell",
        quantity: quarterQty,
        limitPrice: priceWithSellMargin(star, locPriceMargin),
        reason: `쿼터 매도 ${quarterQty}주 @ 별지점≈$${star.toFixed(2)} (T=${T.toFixed(2)})`,
      });
    }

    // 익절 LOC 매도 @ avgCost × (1 + targetReturn). 잔여 75%.
    const finalQty = Math.floor(totalShares - quarterQty);
    if (finalQty > 0) {
      orders.push({
        kind: "final_sell_target",
        side: "sell",
        quantity: finalQty,
        limitPrice: priceWithSellMargin(target, locPriceMargin),
        reason: `익절 매도 ${finalQty}주 @ avgCost×${(1 + targetReturn).toFixed(2)}≈$${target.toFixed(2)}`,
      });
    }
  }

  return orders;
}

/**
 * 체결 결과를 state.cycle 에 반영. (체결 정산 단계 핵심 로직)
 *
 * @param fills 오늘 제출했던 주문 중 실제로 체결된 것들 (kind 보존됨)
 * @param todayClose 오늘 종가 (recentCloses 슬라이딩 윈도우 갱신용 + 리버스 종료 체크용)
 *
 * @returns next: 갱신된 CycleState. cycleClosed: 사이클이 종료되었는지 (final_sell_target 또는 리버스 ladder 전량 매도).
 */
export function applyFillsV4(
  state: CycleState,
  fills: FilledOrder[],
  config: TradingConfig,
  todayClose: number,
): { next: CycleState; cycleClosed: boolean } {
  const next: CycleState = {
    ...state,
    recentCloses: [...state.recentCloses],
  };
  let cycleClosed = false;

  for (const f of fills) {
    if (f.filledQuantity <= 0) continue;

    const side = sideOfKind(f.kind);
    if (side === "buy") {
      const newShares = next.totalShares + f.filledQuantity;
      next.avgCost = newShares > 0
        ? (next.avgCost * next.totalShares + f.filledAmount) / newShares
        : 0;
      next.totalShares = newShares;
      next.cycleCash -= f.filledAmount;

      switch (f.kind) {
        case "buy_half_star":
        case "buy_half_avg":
          next.T += 0.5;
          break;
        case "buy_full_star":
          next.T += 1;
          break;
        case "reverse_quarter_buy":
          next.T = next.T + (config.rounds - next.T) * 0.25;
          break;
        default:
          break;
      }
    } else {
      // sell
      next.totalShares -= f.filledQuantity;
      next.cycleCash += f.filledAmount;

      switch (f.kind) {
        case "quarter_sell_star":
          if (next.mode === "normal") {
            next.T = next.T * 0.75;
          }
          break;
        case "final_sell_target":
          cycleClosed = true;
          break;
        case "reverse_moc_sell":
        case "reverse_ladder_sell":
          next.T = next.T * 0.95;
          if (next.totalShares <= 0) {
            cycleClosed = true;
          }
          break;
        default:
          break;
      }

      if (next.totalShares < 0) next.totalShares = 0;
    }
  }

  // 리버스 첫날 플래그는 첫날 fill 처리 후 무조건 해제 (체결 여부 무관)
  if (next.reverseFirstDay) {
    next.reverseFirstDay = false;
  }

  // 사이클 종료
  if (cycleClosed || next.totalShares <= 0.0001) {
    next.totalCash = next.cycleCash;
    next.totalShares = 0;
    next.avgCost = 0;
    next.T = 0;
    next.cycleCash = next.totalCash;
    next.cycleNumber += 1;
    next.startDate = new Date().toISOString().split("T")[0];
    next.mode = "normal";
    next.recentCloses = [];
    next.reverseFirstDay = false;
    cycleClosed = true;
  } else {
    // 리버스모드 진입 체크
    if (
      next.mode === "normal" &&
      next.totalShares > 0 &&
      next.T > config.rounds - 1
    ) {
      next.mode = "reverse";
      next.reverseFirstDay = true;
    }

    // 리버스모드 종료 체크: 종가 > avgCost × (1 - 0.15)
    if (
      next.mode === "reverse" &&
      next.avgCost > 0 &&
      todayClose > reverseExitThreshold(next.avgCost)
    ) {
      next.mode = "normal";
      next.reverseFirstDay = false;
      // T 그대로 유지
    }
  }

  // recentCloses 슬라이딩 윈도우 갱신 (사이클 종료 후엔 빈 상태)
  if (!cycleClosed) {
    next.recentCloses.push(todayClose);
    if (next.recentCloses.length > MA_WINDOW) {
      next.recentCloses.shift();
    }
  }

  return { next, cycleClosed };
}
