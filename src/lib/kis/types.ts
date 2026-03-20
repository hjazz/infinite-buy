export interface KISConfig {
  appKey: string;
  appSecret: string;
  accountNo: string;
  accountProduct: string;
  baseUrl: string;
  isMock: boolean;
}

export interface KISToken {
  accessToken: string;
  expiresAt: number;
}

export interface KISTokenResponse {
  access_token: string;
  access_token_token_expired: string;
  token_type: string;
  expires_in: number;
}

export interface KISResponse<T = unknown> {
  rt_cd: string; // "0" = success
  msg_cd: string;
  msg1: string;
  output?: T;
  output1?: T;
  output2?: T;
}

export interface KISQuote {
  rsym: string;
  base: string; // 전일 종가
  last: string; // 현재가
  sign: string;
  diff: string;
  rate: string;
  tvol: string;
  ordy: string; // 매수가능여부
}

export interface KISOrderOutput {
  KRX_FWDG_ORD_ORGNO: string;
  ODNO: string; // 주문번호
  ORD_TMD: string;
}

export interface KISBalanceOutput {
  ovrs_pdno: string; // 종목코드
  ovrs_item_name: string;
  pchs_avg_pric: string; // 매입 평균가
  ovrs_cblc_qty: string; // 잔고 수량
  ord_psbl_qty: string; // 주문 가능 수량
  frcr_pchs_amt1: string; // 외화 매입금액
  ovrs_stck_evlu_amt: string; // 평가금액
  now_pric2: string; // 현재가
  evlu_pfls_rt: string; // 평가 손익률
}

export interface KISCashBalance {
  frcr_dncl_amt_2: string; // 외화 예수금
  frcr_drwg_psbl_amt_1: string;
}

export type OrderSide = "buy" | "sell";
export type OrderType = "00" | "32" | "34"; // 00: 지정가, 32: LOO, 34: LOC

export interface OrderRequest {
  ticker: string;
  side: OrderSide;
  quantity: number;
  price: number;
  orderType: OrderType;
  exchange: "NASD" | "NYSE" | "AMEX";
}
