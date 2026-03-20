import type { KISConfig, KISBalanceOutput, KISCashBalance } from "./types";
import { kisRequest } from "./client";

/**
 * 해외주식 잔고 조회
 */
export async function getHoldings(
  config: KISConfig,
): Promise<KISBalanceOutput[]> {
  const trId = config.isMock ? "VTTS3012R" : "TTTS3012R";

  const res = await kisRequest<KISBalanceOutput>(
    config,
    "GET",
    "/uapi/overseas-stock/v1/trading/inquire-balance",
    trId,
    {
      CANO: config.accountNo,
      ACNT_PRDT_CD: config.accountProduct,
      OVRS_EXCG_CD: "NASD",
      TR_CRCY_CD: "USD",
      CTX_AREA_FK200: "",
      CTX_AREA_NK200: "",
    },
  );

  if (res.rt_cd !== "0") {
    throw new Error(`잔고 조회 실패: ${res.msg1}`);
  }

  return (res.output1 as unknown as KISBalanceOutput[]) ?? [];
}

/**
 * 특정 종목 보유 현황
 */
export async function getTickerHolding(
  config: KISConfig,
  ticker: string,
): Promise<{ quantity: number; avgPrice: number; evalAmount: number } | null> {
  const holdings = await getHoldings(config);
  const found = holdings.find((h) => h.ovrs_pdno === ticker);

  if (!found || parseFloat(found.ovrs_cblc_qty) === 0) {
    return null;
  }

  return {
    quantity: parseFloat(found.ovrs_cblc_qty),
    avgPrice: parseFloat(found.pchs_avg_pric),
    evalAmount: parseFloat(found.ovrs_stck_evlu_amt),
  };
}

/**
 * 해외주식 예수금(USD) 조회
 */
export async function getCashBalance(config: KISConfig): Promise<number> {
  const trId = config.isMock ? "VTTS3012R" : "TTTS3012R";

  const res = await kisRequest<KISCashBalance>(
    config,
    "GET",
    "/uapi/overseas-stock/v1/trading/inquire-balance",
    trId,
    {
      CANO: config.accountNo,
      ACNT_PRDT_CD: config.accountProduct,
      OVRS_EXCG_CD: "NASD",
      TR_CRCY_CD: "USD",
      CTX_AREA_FK200: "",
      CTX_AREA_NK200: "",
    },
  );

  if (res.rt_cd !== "0") {
    throw new Error(`예수금 조회 실패: ${res.msg1}`);
  }

  const cashData = res.output2 as unknown as KISCashBalance[];
  if (!cashData || cashData.length === 0) return 0;

  return parseFloat(cashData[0].frcr_dncl_amt_2) || 0;
}
