import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {"Content-Type": "application/json"},
	});
}

const user = {
	id: "u1",
	provider: "google",
	email: "test@example.com",
	emailVerified: true,
	displayName: "Test User",
	role: "user",
	status: "active",
	credits: {bronze: 1, silver: 2, gold: 3},
	defaultPresentationTheme: {},
};

describe("authClient", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("bootstraps, subscribes, refreshes, and logs out", async () => {
		const fetch = vi.mocked(globalThis.fetch);
		fetch.mockResolvedValueOnce(response({accessToken: "token", expiresIn: 60, user}));
		const {authClient} = await import("@/auth/authClient");
		const listener = vi.fn();
		const unsubscribe = authClient.subscribe(listener);
		await expect(authClient.bootstrap()).resolves.toMatchObject({status: "authenticated"});
		expect(authClient.getSnapshot().accessToken).toBe("token");
		expect(listener).toHaveBeenCalled();
		unsubscribe();
		fetch.mockResolvedValueOnce(response({}));
		await authClient.logout();
		expect(authClient.getSnapshot().status).toBe("unauthenticated");
	});

	it("authorizes calls, retries 401 responses, and clears expired sessions", async () => {
		const fetch = vi.mocked(globalThis.fetch);
		fetch
			.mockResolvedValueOnce(response({accessToken: "one", expiresIn: 60, user}))
			.mockResolvedValueOnce(response({}, 401))
			.mockResolvedValueOnce(response({accessToken: "two", expiresIn: 60, user}))
			.mockResolvedValueOnce(response({}, 401));
		const {authClient} = await import("@/auth/authClient");
		const result = await authClient.authorizedFetch("/api/data", {method: "POST", body: "{}"});
		expect(result.status).toBe(401);
		expect(authClient.getSnapshot().error).toContain("session expired");
		expect(fetch).toHaveBeenCalledTimes(4);
	});

	it("updates user profile data and retrieves transactions", async () => {
		const fetch = vi.mocked(globalThis.fetch);
		fetch
			.mockResolvedValueOnce(response({accessToken: "token", expiresIn: 60, user}))
			.mockResolvedValueOnce(response({user: {...user, displayName: "Updated"}}))
			.mockResolvedValueOnce(response({user}))
			.mockResolvedValueOnce(response({user}))
			.mockResolvedValueOnce(response({user}))
			.mockResolvedValueOnce(response({transactions: [{id: "tx"}]}));
		const {authClient} = await import("@/auth/authClient");
		await authClient.refreshAccessToken();
		await expect(authClient.refreshUser()).resolves.toMatchObject({id: "u1"});
		await expect(authClient.updateDisplayName("Updated")).resolves.toMatchObject({displayName: "Test User"});
		await expect(authClient.completeOnboarding()).resolves.toMatchObject({id: "u1"});
		await expect(authClient.updateDefaultPresentationTheme({} as never)).resolves.toMatchObject({id: "u1"});
		await expect(authClient.listCreditTransactions()).resolves.toEqual({transactions: [{id: "tx"}]});
	});

	it("surfaces refresh and OAuth errors without exposing technical token details", async () => {
		const fetch = vi.mocked(globalThis.fetch);
		fetch.mockResolvedValueOnce(response({error: "invalid_token", message: "token invalid"}, 401));
		const {authClient} = await import("@/auth/authClient");
		await expect(authClient.handleOAuthCallback("?status=success")).resolves.toMatchObject({
			status: "unauthenticated",
			error: expect.stringContaining("session expired"),
		});
		await expect(authClient.handleOAuthCallback("?status=failed&error=denied")).rejects.toThrow("denied");
		await expect(authClient.handleOAuthCallback("?status=failed&error=google_auth_failed")).rejects.toThrow("");
	});
});
