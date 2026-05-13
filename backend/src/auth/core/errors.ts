export class AuthError extends Error {
	constructor(
		public readonly code: string,
		public readonly statusCode: number,
		message: string,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "AuthError";
	}
}

export function isAuthError(error: unknown): error is AuthError {
	return error instanceof AuthError;
}

const PUBLIC_SESSION_ERROR_CODES = new Set([
	"invalid_token",
	"invalid_access_token",
	"missing_authorization_header",
	"invalid_authorization_header",
	"missing_refresh_token",
	"invalid_refresh_token",
	"refresh_token_reuse_detected",
	"session_expired",
	"session_mismatch",
	"session_rotation_failed",
	"unauthenticated",
	"user_unavailable",
]);

export function getPublicAuthErrorMessage(error: AuthError): string {
	if (PUBLIC_SESSION_ERROR_CODES.has(error.code)) {
		return "Please sign in again.";
	}

	return error.message;
}
