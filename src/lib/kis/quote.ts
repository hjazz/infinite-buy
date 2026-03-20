import type { KISConfig, KISQuote } from "./types";
import { kisRequest } from "./client";

/**
 * 해외주식 현재가 조회
 */
export async function getQuote(
  config: KISConfig,
  ticker: string,
  exchange: string = "NAS",
): Promise<KISQuote> {
  const res = await kisRequest<KISQuote>(
    config,
    "GET",
    "/uapi/overseas-price/v1/quotations/price",
    "HHDFS00000300",
    { AUTH: "", EXCD: exchange, SYMB: ticker },
  );

  if (res.rt_cd !== "0") {
    throw new Error(`시세 조회 실패: ${res.msg1}`);
  }

  return res.output!;
}

/**
 * 현재가를 숫자로 반환
 */
export async function getCurrentPrice(
  config: KISConfig,
  ticker: string,
  exchange: string = "NAS",
): Promise<number> {
  const quote = await getQuote(config, ticker, exchange);
  return parseFloat(quote.last);
}
