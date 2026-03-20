import type { KISConfig, KISToken, KISTokenResponse } from "./types";

let cachedToken: KISToken | null = null;

export async function getAccessToken(config: KISConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(`${config.baseUrl}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: config.appKey,
      appsecret: config.appSecret,
    }),
  });

  if (!res.ok) {
    throw new Error(`KIS 인증 실패: ${res.status} ${await res.text()}`);
  }

  const data: KISTokenResponse = await res.json();

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.accessToken;
}

export function clearToken(): void {
  cachedToken = null;
}
