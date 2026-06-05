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

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
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

export function assertRateLimit(input: RateLimitInput) {
  const result = checkRateLimit(input);

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
