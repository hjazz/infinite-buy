import type { KISConfig, KISResponse } from "./types";
import { getAccessToken, clearToken } from "./auth";

async function doRequest<T>(
  config: KISConfig,
  method: "GET" | "POST",
  path: string,
  trId: string,
  params?: Record<string, string>,
  body?: Record<string, string>,
): Promise<KISResponse<T>> {
  const token = await getAccessToken(config);

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    authorization: `Bearer ${token}`,
    appkey: config.appKey,
    appsecret: config.appSecret,
    tr_id: trId,
  };

  let url = `${config.baseUrl}${path}`;
  if (method === "GET" && params) {
    url += `?${new URLSearchParams(params).toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`KIS API 오류 [${trId}]: ${res.status} ${text}`);
  }

  return JSON.parse(text);
}

export async function kisRequest<T>(
  config: KISConfig,
  method: "GET" | "POST",
  path: string,
  trId: string,
  params?: Record<string, string>,
  body?: Record<string, string>,
): Promise<KISResponse<T>> {
  try {
    return await doRequest<T>(config, method, path, trId, params, body);
  } catch (err) {
    // 토큰 만료(EGW00123) 또는 HTTP 401/403 → 캐시 초기화 후 1회 재시도
    if (err instanceof Error && (
      err.message.includes("EGW00123") ||
      err.message.includes(": 401 ") ||
      err.message.includes(": 403 ")
    )) {
      clearToken();
      return await doRequest<T>(config, method, path, trId, params, body);
    }
    throw err;
  }
}
