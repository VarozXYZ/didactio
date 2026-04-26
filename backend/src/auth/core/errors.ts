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
