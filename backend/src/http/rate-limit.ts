import {createClient} from "redis";
import type {RequestHandler} from "express";
import type {AppEnv} from "../config/env.js";
import type {Logger} from "../logging/logger.js";

export interface RateLimitDecision {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: number;
}

export interface ApiRateLimiter {
	consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

interface MemoryBucket {
	count: number;
	resetAt: number;
}

export class InMemoryRateLimiter implements ApiRateLimiter {
	private readonly buckets = new Map<string, MemoryBucket>();

	async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
		const now = Date.now();
		const existing = this.buckets.get(key);
		const bucket = !existing || existing.resetAt <= now ?
			{count: 0, resetAt: now + windowSeconds * 1000}
			: existing;
		bucket.count += 1;
		this.buckets.set(key, bucket);

		return {
			allowed: bucket.count <= limit,
			limit,
			remaining: Math.max(0, limit - bucket.count),
			resetAt: bucket.resetAt,
		};
	}
}

interface RedisLike {
	connect(): Promise<unknown>;
	incr(key: string): Promise<number>;
	expire(key: string, seconds: number): Promise<boolean>;
	ttl(key: string): Promise<number>;
	eval(script: string, options: {keys: string[]; arguments: string[]}): Promise<unknown>;
	quit(): Promise<unknown>;
	on(event: "error", listener: (error: unknown) => void): unknown;
}

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`;

export class RedisRateLimiter implements ApiRateLimiter {
	constructor(
		private readonly client: RedisLike,
		private readonly keyPrefix = "didactio:ratelimit",
	) {}

	async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitDecision> {
		const redisKey = `${this.keyPrefix}:${key}`;
		const result = await this.client.eval(RATE_LIMIT_SCRIPT, {
			keys: [redisKey],
			arguments: [String(windowSeconds)],
		});
		const values = Array.isArray(result) ? result : [];
		const count = Number(values[0] ?? 0);
		const ttlSeconds = Math.max(1, Number(values[1] ?? windowSeconds));

		return {
			allowed: count <= limit,
			limit,
			remaining: Math.max(0, limit - count),
			resetAt: Date.now() + ttlSeconds * 1000,
		};
	}

	async close(): Promise<void> {
		await this.client.quit();
	}
}

export interface RedisRateLimiterConnection {
	limiter: RedisRateLimiter;
	close(): Promise<void>;
}

export async function connectRedisRateLimiter(
	env: Pick<AppEnv, "redisUrl" | "redisKeyPrefix">,
	logger?: Logger,
): Promise<RedisRateLimiterConnection | null> {
	if (!env.redisUrl) {
		return null;
	}

	const client = createClient({url: env.redisUrl}) as unknown as RedisLike;
	client.on("error", (error) => {
		logger?.error("Redis rate limiter client error", {error});
	});
	await client.connect();
	const limiter = new RedisRateLimiter(client, env.redisKeyPrefix);
	return {
		limiter,
		close: () => limiter.close(),
	};
}

export function createApiRateLimitMiddleware(input: {
	limiter: ApiRateLimiter;
	limitPerMinute: number;
	logger?: Logger;
	failClosed?: boolean;
}): RequestHandler {
	return async (request, response, next) => {
		if (request.path === "/health" || request.path === "/billing/pricing") {
			next();
			return;
		}

		const identity = request.auth?.sub ?? request.ip ?? "anonymous";
		try {
			const decision = await input.limiter.consume(identity, input.limitPerMinute, 60);
			response.setHeader("RateLimit-Limit", decision.limit);
			response.setHeader("RateLimit-Remaining", decision.remaining);
			response.setHeader("RateLimit-Reset", Math.ceil(decision.resetAt / 1000));
			if (!decision.allowed) {
				response.status(429).json({
					error: "rate_limit_exceeded",
					message: "Too many requests. Please try again later.",
				});
				return;
			}
			next();
		} catch (error) {
			input.logger?.error("API rate limiter failed", {error});
			if (input.failClosed) {
				response.status(503).json({
					error: "rate_limiter_unavailable",
					message: "Request protection is temporarily unavailable.",
				});
				return;
			}
			next();
		}
	};
}
