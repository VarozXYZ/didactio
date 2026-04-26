import type {Request, Router} from "express";
import {Router as createRouter} from "express";
import type {PassportStatic} from "passport";
import {AuthError} from "../core/errors.js";
import type {AuthService} from "../core/service.js";
import type {AuthConfig, NormalizedGoogleProfile} from "../core/types.js";
import {
	clearOAuthFlowCookie,
	clearRefreshCookie,
	generateOAuthState,
	readOAuthFlowCookie,
	setOAuthFlowCookie,
	setRefreshCookie,
} from "./cookies.js";
import {authErrorHandler, createRequireAuth} from "./middleware.js";

function getRequestContext(request: Request) {
	return {
		ipAddress: request.ip,
		userAgent: request.get("user-agent") ?? undefined,
	};
}

function buildRedirectUrl(baseUrl: string, params: Record<string, string>): string {
	const url = new URL(baseUrl);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	return url.toString();
}

function resolveRedirectUrl(
	request: Request,
	config: AuthConfig,
): string | undefined {
	const redirectTo =
		typeof request.query.redirectTo === "string" ? request.query.redirectTo : undefined;
	const finalRedirect = redirectTo ?? config.defaultRedirectUrl;

	if (!finalRedirect) {
		return undefined;
	}

	if (!config.allowedRedirectUrls.includes(finalRedirect)) {
		throw new AuthError(
			"invalid_redirect_url",
			400,
			"redirectTo is not allow-listed.",
		);
	}

	return finalRedirect;
}

export function createAuthRouter(
	config: AuthConfig,
	authService: AuthService,
	passport: PassportStatic,
): Router {
	const router = createRouter();
	const requireAuth = createRequireAuth(config);

	router.get("/google", (request, response, next) => {
		try {
			const state = generateOAuthState();
			const redirectTo = resolveRedirectUrl(request, config);
			setOAuthFlowCookie(response, config, {state, redirectTo});

			passport.authenticate("google", {
				session: false,
				scope: ["profile", "email"],
				state,
			})(request, response, next);
		} catch (error) {
			next(error);
		}
	});

	router.get("/google/callback", (request, response, next) => {
		const fail = (errorCode: string, message: string) => {
			clearRefreshCookie(response, config);

			let redirectTo: string | undefined;
			try {
				redirectTo =
					readOAuthFlowCookie(request, config).redirectTo ??
					config.defaultRedirectUrl;
			} catch {
				redirectTo = config.defaultRedirectUrl;
			}

			clearOAuthFlowCookie(response, config);

			if (redirectTo) {
				return response.redirect(
					buildRedirectUrl(redirectTo, {status: "error", error: errorCode}),
				);
			}

			return response.status(401).json({error: errorCode, message});
		};

		let flow: {state: string; redirectTo?: string};
		try {
			flow = readOAuthFlowCookie(request, config);
			const returnedState =
				typeof request.query.state === "string" ? request.query.state : "";
			if (!returnedState || returnedState !== flow.state) {
				return fail("invalid_oauth_state", "OAuth state validation failed.");
			}
		} catch (error) {
			return next(error);
		}

		passport.authenticate(
			"google",
			{session: false},
			async (error: unknown, user?: unknown | false) => {
				if (error || !user) {
					return fail("google_auth_failed", "Google authentication failed.");
				}

				try {
					const result = await authService.completeGoogleAuth(
						user as NormalizedGoogleProfile,
						getRequestContext(request),
					);
					setRefreshCookie(response, config, result.refreshToken);
					clearOAuthFlowCookie(response, config);

					if (flow.redirectTo) {
						return response.redirect(
							buildRedirectUrl(flow.redirectTo, {status: "success"}),
						);
					}

					return response.status(200).json({
						accessToken: result.accessToken,
						expiresIn: result.accessTokenExpiresInSeconds,
						user: authService.toPublicUser(result.user),
					});
				} catch (authError) {
					return next(authError);
				}
			},
		)(request, response, next);
	});

	router.post("/refresh", async (request, response, next) => {
		try {
			const refreshToken = request.cookies?.[config.cookie.name];
			if (!refreshToken || typeof refreshToken !== "string") {
				throw new AuthError(
					"missing_refresh_token",
					401,
					"Refresh token cookie is required.",
				);
			}

			const result = await authService.refreshSession(
				refreshToken,
				getRequestContext(request),
			);
			setRefreshCookie(response, config, result.refreshToken);

			response.status(200).json({
				accessToken: result.accessToken,
				expiresIn: result.accessTokenExpiresInSeconds,
				user: authService.toPublicUser(result.user),
			});
		} catch (error) {
			clearRefreshCookie(response, config);
			next(error);
		}
	});

	router.post("/logout", async (request, response, next) => {
		try {
			const refreshToken = request.cookies?.[config.cookie.name];
			await authService.logout(
				typeof refreshToken === "string" ? refreshToken : undefined,
			);
			clearRefreshCookie(response, config);
			response.sendStatus(204);
		} catch (error) {
			next(error);
		}
	});

	router.get("/me", requireAuth, async (request, response, next) => {
		try {
			if (!request.auth) {
				throw new AuthError("unauthenticated", 401, "Authentication required.");
			}

			const user = await authService.getUserById(request.auth.sub);
			if (!user) {
				throw new AuthError(
					"user_not_found",
					404,
					"Authenticated user was not found.",
				);
			}

			response.status(200).json({
				user: authService.toPublicUser(user),
			});
		} catch (error) {
			next(error);
		}
	});

	router.get(
		"/credits/transactions",
		requireAuth,
		async (request, response, next) => {
			try {
				if (!request.auth) {
					throw new AuthError("unauthenticated", 401, "Authentication required.");
				}

				const transactions = await authService.listUserCreditTransactions(
					request.auth.sub,
				);
				response.status(200).json({
					transactions: transactions.map((transaction) => ({
						...transaction,
						createdAt: transaction.createdAt.toISOString(),
					})),
				});
			} catch (error) {
				next(error);
			}
		},
	);

	router.use(authErrorHandler);
	return router;
}
