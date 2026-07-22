import {describe, expect, it, vi} from "vitest";
import {
	InMemoryRateLimiter,
	RedisRateLimiter,
	createApiRateLimitMiddleware,
} from "../src/http/rate-limit.js";

describe("API rate limiting", () => {
	it("enforces a fixed window in memory for tests and local development", async () => {
		const limiter = new InMemoryRateLimiter();
		await expect(limiter.consume("user", 2, 60)).resolves.toMatchObject({
			allowed: true,
			remaining: 1,
		});
		await expect(limiter.consume("user", 2, 60)).resolves.toMatchObject({
			allowed: true,
			remaining: 0,
		});
		await expect(limiter.consume("user", 2, 60)).resolves.toMatchObject({
			allowed: false,
			remaining: 0,
		});
	});

	it("uses an atomic Redis script and reports the distributed decision", async () => {
		const client = {
			eval: vi.fn().mockResolvedValue([3, 42]),
			quit: vi.fn().mockResolvedValue(undefined),
		};
		const limiter = new RedisRateLimiter(client as never, "didactio:test");
		const decision = await limiter.consume("user", 2, 60);

		expect(decision).toMatchObject({allowed: false, limit: 2, remaining: 0});
		expect(client.eval).toHaveBeenCalledWith(
			expect.stringContaining("redis.call('INCR'"),
			{keys: ["didactio:test:user"], arguments: ["60"]},
		);
		await limiter.close();
		expect(client.quit).toHaveBeenCalledOnce();
	});

	it("returns 429 and skips public health endpoints", async () => {
		const limiter = new InMemoryRateLimiter();
		const middleware = createApiRateLimitMiddleware({limiter, limitPerMinute: 1});
		const next = vi.fn();
		const response = {
			setHeader: vi.fn(),
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		};

		await middleware({path: "/data", auth: {sub: "user"}} as never, response as never, next);
		await middleware({path: "/data", auth: {sub: "user"}} as never, response as never, next);
		expect(response.status).toHaveBeenCalledWith(429);
		expect(next).toHaveBeenCalledOnce();

		const healthNext = vi.fn();
		await middleware({path: "/health", auth: undefined} as never, response as never, healthNext);
		expect(healthNext).toHaveBeenCalledOnce();
	});
});
