import {AuthError} from "./errors.js";
import type {AuthConfig} from "./types.js";

function requireString(env: NodeJS.ProcessEnv, key: string): string {
	const value = env[key]?.trim();
	if (!value) {
		throw new AuthError(
			"invalid_config",
			500,
			`Missing required environment variable: ${key}`,
		);
	}

	return value;
}

function parsePositiveInt(
	value: string | undefined,
	fallback: number,
	key: string,
): number {
	if (value === undefined || value === "") {
		return fallback;
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new AuthError(
			"invalid_config",
			500,
			`Environment variable ${key} must be a positive integer.`,
		);
	}

	return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined || value === "") {
		return fallback;
	}

	return value.trim().toLowerCase() === "true";
}

function parseCsv(value: string | undefined): string[] {
	if (!value) {
		return [];
	}

	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseSameSite(
	value: string | undefined,
): "lax" | "strict" | "none" {
	if (!value) {
		return "lax";
	}

	if (value === "lax" || value === "strict" || value === "none") {
		return value;
	}

	throw new AuthError(
		"invalid_config",
		500,
		"COOKIE_SAME_SITE must be one of: lax, strict, none.",
	);
}

function ensureSecretLength(secret: string, key: string): void {
	if (secret.length < 32) {
		throw new AuthError(
			"invalid_config",
			500,
			`${key} must be at least 32 characters long.`,
		);
	}
}

function validateRedirects(
	defaultRedirectUrl: string | undefined,
	allowedRedirectUrls: string[],
): void {
	if (defaultRedirectUrl && !allowedRedirectUrls.includes(defaultRedirectUrl)) {
		throw new AuthError(
			"invalid_config",
			500,
			"AUTH_DEFAULT_REDIRECT must also be present in AUTH_ALLOWED_REDIRECTS.",
		);
	}
}

export function loadAuthConfigFromEnv(
	env: NodeJS.ProcessEnv = process.env,
): AuthConfig {
	const nodeEnv = env.NODE_ENV?.trim() ?? "development";
	const cookieSecure = parseBoolean(env.COOKIE_SECURE, nodeEnv === "production");
	const sameSite = parseSameSite(env.COOKIE_SAME_SITE);

	if (sameSite === "none" && !cookieSecure) {
		throw new AuthError(
			"invalid_config",
			500,
			"COOKIE_SECURE must be true when COOKIE_SAME_SITE is none.",
		);
	}

	const jwtAccessSecret = requireString(env, "JWT_ACCESS_SECRET");
	const jwtRefreshSecret = requireString(env, "JWT_REFRESH_SECRET");
	const cookieSecret = requireString(env, "COOKIE_SECRET");
	ensureSecretLength(jwtAccessSecret, "JWT_ACCESS_SECRET");
	ensureSecretLength(jwtRefreshSecret, "JWT_REFRESH_SECRET");
	ensureSecretLength(cookieSecret, "COOKIE_SECRET");

	const allowedRedirectUrls = parseCsv(env.AUTH_ALLOWED_REDIRECTS);
	const defaultRedirectUrl = env.AUTH_DEFAULT_REDIRECT?.trim() || undefined;
	validateRedirects(defaultRedirectUrl, allowedRedirectUrls);

	return {
		googleClientId: requireString(env, "GOOGLE_CLIENT_ID"),
		googleClientSecret: requireString(env, "GOOGLE_CLIENT_SECRET"),
		googleCallbackUrl: requireString(env, "GOOGLE_CALLBACK_URL"),
		jwtAccessSecret,
		jwtRefreshSecret,
		jwtIssuer: env.JWT_ISSUER?.trim() || "didactio",
		jwtAudience: env.JWT_AUDIENCE?.trim() || "web",
		accessTokenTtlSeconds: parsePositiveInt(
			env.ACCESS_TOKEN_TTL_SECONDS,
			900,
			"ACCESS_TOKEN_TTL_SECONDS",
		),
		refreshTokenTtlSeconds: parsePositiveInt(
			env.REFRESH_TOKEN_TTL_SECONDS,
			1209600,
			"REFRESH_TOKEN_TTL_SECONDS",
		),
		cookie: {
			name: env.AUTH_COOKIE_NAME?.trim() || "refresh_token",
			secure: cookieSecure,
			sameSite,
			domain: env.COOKIE_DOMAIN?.trim() || undefined,
		},
		cookieSecret,
		allowedRedirectUrls,
		defaultRedirectUrl,
		adminEmails: parseCsv(env.AUTH_ADMIN_EMAILS).map((email) =>
			email.toLowerCase(),
		),
		trustProxy: parseBoolean(env.TRUST_PROXY, false),
		corsAllowedOrigins: parseCsv(env.CORS_ALLOWED_ORIGINS),
	};
}
