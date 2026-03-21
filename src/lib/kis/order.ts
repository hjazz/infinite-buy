import type { KISConfig, KISOrderOutput, OrderRequest } from "./types";
import { kisRequest } from "./client";

function getTrId(config: KISConfig, side: "buy" | "sell"): string {
  if (side === "buy") {
    return config.isMock ? "VTTT1002U" : "TTTT1002U";
  }
  return config.isMock ? "VTTT1001U" : "TTTT1006U";
}

/**
 * 해외주식 주문 실행
 */
export async function placeOrder(
  config: KISConfig,
  order: OrderRequest,
): Promise<KISOrderOutput> {
  const trId = getTrId(config, order.side);

  const body: Record<string, string> = {
    CANO: config.accountNo,
    ACNT_PRDT_CD: config.accountProduct,
    OVRS_EXCG_CD: order.exchange,
    PDNO: order.ticker,
    ORD_QTY: String(Math.floor(order.quantity)),
    OVRS_ORD_UNPR: order.price.toFixed(2),
    ORD_SVR_DVSN_CD: "0",
    ORD_DVSN: order.orderType,
  };

  const res = await kisRequest<KISOrderOutput>(
    config,
    "POST",
    "/uapi/overseas-stock/v1/trading/order",
    trId,
    undefined,
    body,
  );

  if (res.rt_cd !== "0") {
    throw new Error(`주문 실패: ${res.msg1}`);
  }

  return res.output!;
}

/**
 * LOC 매수 (장마감지정가, ord_dvsn: 34)
 * limitPrice 이하로 종가가 형성되면 종가에 체결
 */
export async function placeLOCBuy(
  config: KISConfig,
  ticker: string,
  quantity: number,
  limitPrice: number,
  exchange: "NASD" | "NYSE" | "AMEX" = "NASD",
): Promise<KISOrderOutput> {
  return placeOrder(config, {
    ticker,
    side: "buy",
    quantity,
    price: limitPrice,
    orderType: "34",
    exchange,
  });
}

/**
 * LOC 매도 (장마감지정가, ord_dvsn: 34)
 * limitPrice 이상으로 종가가 형성되면 종가에 체결
 */
export async function placeLOCSell(
  config: KISConfig,
  ticker: string,
  quantity: number,
  limitPrice: number,
  exchange: "NASD" | "NYSE" | "AMEX" = "NASD",
): Promise<KISOrderOutput> {
  return placeOrder(config, {
    ticker,
    side: "sell",
    quantity,
    price: limitPrice,
    orderType: "34",
    exchange,
  });
}

/**
 * 지정가 매수 (모의투자용 - LOC 미지원 대체)
 */
export async function placeLimitBuy(
  config: KISConfig,
  ticker: string,
  quantity: number,
  price: number,
  exchange: "NASD" | "NYSE" | "AMEX" = "NASD",
): Promise<KISOrderOutput> {
  return placeOrder(config, {
    ticker,
    side: "buy",
    quantity,
    price,
    orderType: "00",
    exchange,
  });
}

/**
 * 지정가 매도 (모의투자용 - LOC 미지원 대체)
 */
export async function placeLimitSell(
  config: KISConfig,
  ticker: string,
  quantity: number,
  price: number,
  exchange: "NASD" | "NYSE" | "AMEX" = "NASD",
): Promise<KISOrderOutput> {
  return placeOrder(config, {
    ticker,
    side: "sell",
    quantity,
    price,
    orderType: "00",
    exchange,
  });
}
