export class AuthError extends Error {
	constructor(
		public readonly code: string,
		public readonly statusCode: number,
		message: string,
	) {
		super(message);
		this.name = "AuthError";
	}
}

export function isAuthError(error: unknown): error is AuthError {
	return error instanceof AuthError;
}
