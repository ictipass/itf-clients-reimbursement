type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitState>();
const sharedLimiters = new Map<string, Ratelimit>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

function checkMemoryRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const current = buckets.get(input.key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + input.windowMs;
    buckets.set(input.key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: input.limit - 1,
      resetAt: new Date(resetAt),
    };
  }

  if (current.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(current.resetAt),
    };
  }

  current.count += 1;
  buckets.set(input.key, current);

  return {
    allowed: true,
    remaining: input.limit - current.count,
    resetAt: new Date(current.resetAt),
  };
}

function getSharedRateLimiter(input: RateLimitInput) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const key = `${input.limit}:${input.windowMs}`;
  const existing = sharedLimiters.get(key);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.fixedWindow(input.limit, `${input.windowMs} ms`),
    prefix: "itf-reimbursement",
  });
  sharedLimiters.set(key, limiter);
  return limiter;
}

export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const limiter = getSharedRateLimiter(input);
  if (!limiter) return checkMemoryRateLimit(input);

  const result = await limiter.limit(input.key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: new Date(result.reset),
  };
}

export async function assertRateLimit(input: RateLimitInput) {
  const result = await checkRateLimit(input);

  if (!result.allowed) {
    throw new Error(`Too many requests. Try again after ${result.resetAt.toLocaleTimeString()}.`);
  }

  return result;
}

export function assertUploadRateLimit(identity: string) {
  return assertRateLimit({
    key: `upload:${identity.toLowerCase()}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
}

export function assertPublicVerificationRateLimit(identity: string) {
  return assertRateLimit({
    key: `public-verification:${identity.toLowerCase()}`,
    limit: 30,
    windowMs: 60 * 1000,
  });
}
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
