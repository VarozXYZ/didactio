import crypto from "node:crypto";
import jwt, {type JwtPayload} from "jsonwebtoken";
import {AuthError} from "./errors.js";
import type {AuthConfig, AuthenticatedPrincipal} from "./types.js";

interface AccessTokenPayload extends JwtPayload {
	type: "access";
	sid: string;
	provider: "google";
	email: string | null;
	role: "admin" | "user";
}

interface RefreshTokenPayload extends JwtPayload {
	type: "refresh";
	sid: string;
	jti: string;
}

interface FlowTokenPayload extends JwtPayload {
	type: "oauth_flow";
	state: string;
	redirectTo?: string;
}

function assertPayload(value: string | JwtPayload): JwtPayload {
	if (typeof value === "string") {
		throw new AuthError("invalid_token", 401, "Unexpected token payload.");
	}

	return value;
}

export function hashToken(token: string): string {
	return crypto.createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(
	principal: AuthenticatedPrincipal,
	config: AuthConfig,
): string {
	return jwt.sign(
		{
			type: "access",
			sid: principal.sid,
			provider: principal.provider,
			email: principal.email,
			role: principal.role,
		},
		config.jwtAccessSecret,
		{
			expiresIn: config.accessTokenTtlSeconds,
			issuer: config.jwtIssuer,
			audience: config.jwtAudience,
			subject: principal.sub,
		},
	);
}

export function verifyAccessToken(
	token: string,
	config: AuthConfig,
): AuthenticatedPrincipal {
	let payload: AccessTokenPayload;
	try {
		payload = assertPayload(
			jwt.verify(token, config.jwtAccessSecret, {
				issuer: config.jwtIssuer,
				audience: config.jwtAudience,
			}),
		) as AccessTokenPayload;
	} catch {
		throw new AuthError("invalid_access_token", 401, "Invalid access token.");
	}

	if (
		payload.type !== "access" ||
		typeof payload.sub !== "string" ||
		typeof payload.sid !== "string" ||
		(payload.role !== "admin" && payload.role !== "user")
	) {
		throw new AuthError("invalid_access_token", 401, "Invalid access token.");
	}

	return {
		sub: payload.sub,
		sid: payload.sid,
		provider: "google",
		email: typeof payload.email === "string" ? payload.email : null,
		role: payload.role,
	};
}

export function signRefreshToken(
	userId: string,
	sessionId: string,
	config: AuthConfig,
): string {
	return jwt.sign(
		{
			type: "refresh",
			sid: sessionId,
			jti: crypto.randomUUID(),
		},
		config.jwtRefreshSecret,
		{
			expiresIn: config.refreshTokenTtlSeconds,
			issuer: config.jwtIssuer,
			audience: config.jwtAudience,
			subject: userId,
		},
	);
}

export function verifyRefreshToken(
	token: string,
	config: AuthConfig,
): {sub: string; sid: string; jti: string} {
	let payload: RefreshTokenPayload;
	try {
		payload = assertPayload(
			jwt.verify(token, config.jwtRefreshSecret, {
				issuer: config.jwtIssuer,
				audience: config.jwtAudience,
			}),
		) as RefreshTokenPayload;
	} catch {
		throw new AuthError(
			"invalid_refresh_token",
			401,
			"Invalid refresh token.",
		);
	}

	if (
		payload.type !== "refresh" ||
		typeof payload.sub !== "string" ||
		typeof payload.sid !== "string" ||
		typeof payload.jti !== "string"
	) {
		throw new AuthError(
			"invalid_refresh_token",
			401,
			"Invalid refresh token.",
		);
	}

	return {
		sub: payload.sub,
		sid: payload.sid,
		jti: payload.jti,
	};
}

export function signFlowToken(
	flow: {state: string; redirectTo?: string},
	config: AuthConfig,
): string {
	return jwt.sign(
		{
			type: "oauth_flow",
			state: flow.state,
			redirectTo: flow.redirectTo,
		},
		config.cookieSecret,
		{
			expiresIn: 600,
			issuer: config.jwtIssuer,
			audience: `${config.jwtAudience}:oauth-flow`,
		},
	);
}

export function verifyFlowToken(
	token: string,
	config: AuthConfig,
): {state: string; redirectTo?: string} {
	let payload: FlowTokenPayload;
	try {
		payload = assertPayload(
			jwt.verify(token, config.cookieSecret, {
				issuer: config.jwtIssuer,
				audience: `${config.jwtAudience}:oauth-flow`,
			}),
		) as FlowTokenPayload;
	} catch {
		throw new AuthError(
			"invalid_oauth_flow",
			401,
			"Invalid OAuth flow cookie.",
		);
	}

	if (payload.type !== "oauth_flow" || typeof payload.state !== "string") {
		throw new AuthError(
			"invalid_oauth_flow",
			401,
			"Invalid OAuth flow cookie.",
		);
	}

	return {
		state: payload.state,
		redirectTo:
			typeof payload.redirectTo === "string" ? payload.redirectTo : undefined,
	};
}
