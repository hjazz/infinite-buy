import type { KISConfig, KISResponse } from "./types";
import { getAccessToken } from "./auth";

export async function kisRequest<T>(
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KIS API 오류 [${trId}]: ${res.status} ${text}`);
  }

  return res.json();
}
