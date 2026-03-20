import type { KISConfig } from "./types";
import { kisRequest } from "./client";

interface KISExecutionOutput {
  odno: string; // 주문번호
  orgn_odno: string; // 원주문번호
  sll_buy_dvsn_cd: string; // 매도매수구분
  sll_buy_dvsn_cd_name: string;
  ovrs_pdno: string; // 종목코드
  ft_ord_qty: string; // 주문수량
  ft_ccld_qty: string; // 체결수량
  ft_ccld_unpr3: string; // 체결단가
  ft_ccld_amt3: string; // 체결금액
  nccs_qty: string; // 미체결수량
  ord_dt: string; // 주문일자
  ord_tmd: string; // 주문시각
  ord_dvsn_cd: string; // 주문구분코드
}

export interface ExecutionResult {
  orderId: string;
  filledQuantity: number;
  filledPrice: number;
  filledAmount: number;
  unfilledQuantity: number;
  isFilled: boolean;
  isPartialFill: boolean;
}

/**
 * 해외주식 주문 체결 내역 조회
 */
export async function checkExecution(
  config: KISConfig,
  orderId: string,
): Promise<ExecutionResult | null> {
  const trId = config.isMock ? "VTTS3035R" : "TTTS3035R";

  const res = await kisRequest<KISExecutionOutput>(
    config,
    "GET",
    "/uapi/overseas-stock/v1/trading/inquire-ccnl",
    trId,
    {
      CANO: config.accountNo,
      ACNT_PRDT_CD: config.accountProduct,
      PDNO: "%",
      ORD_STRT_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      ORD_END_DT: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      SLL_BUY_DVSN: "00", // 전체
      CCLD_NCCS_DVSN: "00", // 전체
      OVRS_EXCG_CD: "NASD",
      SORT_SQN: "DS", // 최신순
      ORD_DT: "",
      ORD_GNO_BRNO: "",
      ODNO: "",
      CTX_AREA_NK200: "",
      CTX_AREA_FK200: "",
    },
  );

  if (res.rt_cd !== "0") {
    console.error(`[Execution] 체결 조회 실패: ${res.msg1}`);
    return null;
  }

  const executions = (res.output1 as unknown as KISExecutionOutput[]) ?? [];
  const found = executions.find((e) => e.odno === orderId);

  if (!found) return null;

  const filledQty = parseFloat(found.ft_ccld_qty) || 0;
  const orderQty = parseFloat(found.ft_ord_qty) || 0;
  const unfilledQty = parseFloat(found.nccs_qty) || 0;

  return {
    orderId: found.odno,
    filledQuantity: filledQty,
    filledPrice: parseFloat(found.ft_ccld_unpr3) || 0,
    filledAmount: parseFloat(found.ft_ccld_amt3) || 0,
    unfilledQuantity: unfilledQty,
    isFilled: filledQty > 0 && unfilledQty === 0,
    isPartialFill: filledQty > 0 && unfilledQty > 0,
  };
}

/**
 * 체결 완료까지 대기 (폴링)
 * maxAttempts 횟수만큼 intervalMs 간격으로 체크
 */
export async function waitForExecution(
  config: KISConfig,
  orderId: string,
  maxAttempts: number = 5,
  intervalMs: number = 30_000,
): Promise<ExecutionResult | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await checkExecution(config, orderId);

    if (result?.isFilled) {
      return result;
    }

    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  // 최종 상태 반환
  return checkExecution(config, orderId);
}
