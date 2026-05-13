import type {NextFunction, Request, Response} from "express";
import {
	AuthError,
	getPublicAuthErrorMessage,
	isAuthError,
} from "../core/errors.js";
import {verifyAccessToken} from "../core/tokens.js";
import type {AuthConfig, UserRole} from "../core/types.js";

export function createRequireAuth(config: AuthConfig) {
	return (request: Request, _response: Response, next: NextFunction) => {
		try {
			const header = request.headers.authorization;
			if (!header) {
				throw new AuthError(
					"missing_authorization_header",
					401,
					"Authorization header is required.",
				);
			}

			const [scheme, token] = header.split(" ");
			if (scheme !== "Bearer" || !token) {
				throw new AuthError(
					"invalid_authorization_header",
					401,
					"Authorization header must use Bearer token.",
				);
			}

			request.auth = verifyAccessToken(token, config);
			next();
		} catch (error) {
			next(error);
		}
	};
}

export function createRequireRole(role: UserRole) {
	return (request: Request, _response: Response, next: NextFunction) => {
		try {
			if (!request.auth) {
				throw new AuthError("unauthenticated", 401, "Authentication required.");
			}

			if (request.auth.role !== role) {
				throw new AuthError("forbidden", 403, "Forbidden.");
			}

			next();
		} catch (error) {
			next(error);
		}
	};
}

export function authErrorHandler(
	error: unknown,
	_request: Request,
	response: Response,
	_next: NextFunction,
): void {
	if (isAuthError(error)) {
		response.status(error.statusCode).json({
			error: error.code,
			message: getPublicAuthErrorMessage(error),
			...(error.details ?? {}),
		});
		return;
	}

	response.status(500).json({
		error: "internal_server_error",
		message: error instanceof Error ? error.message : "Unexpected error.",
	});
}
