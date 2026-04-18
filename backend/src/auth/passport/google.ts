import passport from "passport";
import {Profile, Strategy as GoogleStrategy} from "passport-google-oauth20";
import {AuthError} from "../core/errors.js";
import type {AuthConfig, NormalizedGoogleProfile} from "../core/types.js";

function takeString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value : undefined;
}

function takeObject(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function decodeJwtPayload(token: string | undefined): Record<string, unknown> | undefined {
	if (!token) {
		return undefined;
	}

	const parts = token.split(".");
	if (parts.length < 2) {
		return undefined;
	}

	try {
		const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
		const padded = normalized.padEnd(
			normalized.length + ((4 - (normalized.length % 4 || 4)) % 4),
			"=",
		);
		const decoded = Buffer.from(padded, "base64").toString("utf8");
		return takeObject(JSON.parse(decoded));
	} catch {
		return undefined;
	}
}

export function normalizeGoogleProfile(profile: Profile): NormalizedGoogleProfile {
	const raw = (profile._json ?? {}) as Record<string, unknown>;
	const rawUser = takeObject(raw.user) ?? raw;
	const rawImage = takeObject(rawUser.image) ?? takeObject(raw.image);
	const rawCredentials = takeObject(raw.credentials);
	const idTokenPayload = decodeJwtPayload(
		takeString(rawCredentials?.id_token),
	);
	const providerUserId =
		takeString(profile.id) ??
		takeString(rawUser.id) ??
		takeString(rawUser.sub) ??
		takeString(idTokenPayload?.sub);

	if (!providerUserId) {
		throw new AuthError(
			"invalid_google_profile",
			401,
			"Google profile did not include a stable id.",
		);
	}

	const firstName =
		takeString(profile.name?.givenName) ??
		takeString(rawUser.given_name) ??
		takeString(rawUser.givenName) ??
		takeString(idTokenPayload?.given_name);
	const lastName =
		takeString(profile.name?.familyName) ??
		takeString(rawUser.family_name) ??
		takeString(rawUser.familyName) ??
		takeString(idTokenPayload?.family_name);
	const displayName =
		takeString(profile.displayName) ??
		takeString(rawUser.name) ??
		takeString(idTokenPayload?.name) ??
		([firstName, lastName].filter(Boolean).join(" ") || "Google user");

	return {
		provider: "google",
		providerUserId,
		email:
			takeString(profile.emails?.[0]?.value) ??
			takeString(rawUser.email) ??
			takeString(raw.email) ??
			takeString(idTokenPayload?.email) ??
			null,
		emailVerified:
			rawUser.email_verified === true ||
			rawUser.verified_email === true ||
			raw.email_verified === true ||
			raw.verified_email === true ||
			idTokenPayload?.email_verified === true,
		displayName,
		firstName,
		lastName,
		pictureUrl:
			takeString(profile.photos?.[0]?.value) ??
			takeString(rawUser.picture) ??
			takeString(rawImage?.url) ??
			takeString(raw.picture) ??
			takeString(idTokenPayload?.picture),
		locale:
			takeString(rawUser.locale) ??
			takeString(raw.locale) ??
			takeString(idTokenPayload?.locale),
	};
}

export function configureGooglePassport(config: AuthConfig) {
	passport.use(
		"google",
		new GoogleStrategy(
			{
				clientID: config.googleClientId,
				clientSecret: config.googleClientSecret,
				callbackURL: config.googleCallbackUrl,
			},
			async (_accessToken, _refreshToken, profile, done) => {
				try {
					return done(null, normalizeGoogleProfile(profile));
				} catch (error) {
					return done(error as Error);
				}
			},
		),
	);

	return passport;
}
