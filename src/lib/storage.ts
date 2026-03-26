import { Redis } from "@upstash/redis";

// Upstash Redis 클라이언트 (환경변수 없으면 null → 로컬 파일시스템 폴백)
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
