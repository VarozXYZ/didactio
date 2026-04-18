import crypto from "node:crypto";
import type {Request, Response} from "express";
import {AuthError} from "../core/errors.js";
import {signFlowToken, verifyFlowToken} from "../core/tokens.js";
import type {AuthConfig} from "../core/types.js";

const OAUTH_FLOW_COOKIE_NAME = "oauth_flow";

function baseCookieOptions(config: AuthConfig) {
	return {
		httpOnly: true,
		secure: config.cookie.secure,
		sameSite: config.cookie.sameSite,
		domain: config.cookie.domain,
		path: "/",
	} as const;
}

export function generateOAuthState(): string {
	return crypto.randomBytes(24).toString("hex");
}

export function setRefreshCookie(
	response: Response,
	config: AuthConfig,
	refreshToken: string,
): void {
	response.cookie(config.cookie.name, refreshToken, {
		...baseCookieOptions(config),
		maxAge: config.refreshTokenTtlSeconds * 1000,
	});
}

export function clearRefreshCookie(
	response: Response,
	config: AuthConfig,
): void {
	response.clearCookie(config.cookie.name, baseCookieOptions(config));
}

export function setOAuthFlowCookie(
	response: Response,
	config: AuthConfig,
	flow: {state: string; redirectTo?: string},
): void {
	response.cookie(OAUTH_FLOW_COOKIE_NAME, signFlowToken(flow, config), {
		...baseCookieOptions(config),
		maxAge: 10 * 60 * 1000,
	});
}

export function clearOAuthFlowCookie(
	response: Response,
	config: AuthConfig,
): void {
	response.clearCookie(OAUTH_FLOW_COOKIE_NAME, baseCookieOptions(config));
}

export function readOAuthFlowCookie(
	request: Request,
	config: AuthConfig,
): {state: string; redirectTo?: string} {
	const value = request.cookies?.[OAUTH_FLOW_COOKIE_NAME];
	if (!value || typeof value !== "string") {
		throw new AuthError(
			"missing_oauth_flow",
			401,
			"OAuth flow cookie is missing.",
		);
	}

	return verifyFlowToken(value, config);
}
