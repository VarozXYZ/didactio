import type {Express} from "express";
import type {AuthService} from "../../src/auth/core/service.js";
import type {NormalizedGoogleProfile} from "../../src/auth/core/types.js";

function defaultProfile(
	overrides: Partial<NormalizedGoogleProfile> = {},
): NormalizedGoogleProfile {
	return {
		provider: "google",
		providerUserId: "google-user-123",
		email: "user@example.com",
		emailVerified: true,
		displayName: "Ada Lovelace",
		firstName: "Ada",
		lastName: "Lovelace",
		pictureUrl: "https://example.com/avatar.png",
		locale: "en",
		...overrides,
	};
}

export async function loginTestUser(
	app: Express,
	overrides: Partial<NormalizedGoogleProfile> = {},
) {
	const authService = app.locals.authService as AuthService;
	return authService.completeGoogleAuth(defaultProfile(overrides));
}
