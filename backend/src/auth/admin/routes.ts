import {Router} from "express";
import {AuthError} from "../core/errors.js";
import type {AuthService} from "../core/service.js";
import type {CreditCoinType, CreditDirection, UserRole} from "../core/types.js";
import {authErrorHandler} from "../http/middleware.js";

function parseRole(body: unknown): UserRole {
	if (!body || typeof body !== "object") {
		throw new AuthError("invalid_request", 400, "Request body must be a JSON object.");
	}

	const role = (body as {role?: unknown}).role;
	if (role !== "admin" && role !== "user") {
		throw new AuthError("invalid_role", 400, 'role must be "admin" or "user".');
	}

	return role;
}

function parseCreditAdjustment(body: unknown): {
	coinType: CreditCoinType;
	direction: CreditDirection;
	amount: number;
	reason: string;
	metadata?: unknown;
} {
	if (!body || typeof body !== "object") {
		throw new AuthError("invalid_request", 400, "Request body must be a JSON object.");
	}

	const payload = body as {
		coinType?: unknown;
		direction?: unknown;
		amount?: unknown;
		reason?: unknown;
		metadata?: unknown;
	};
	if (
		payload.coinType !== "bronze" &&
		payload.coinType !== "silver" &&
		payload.coinType !== "gold"
	) {
		throw new AuthError(
			"invalid_coin_type",
			400,
			'coinType must be "bronze", "silver", or "gold".',
		);
	}

	if (payload.direction !== "credit" && payload.direction !== "debit") {
		throw new AuthError(
			"invalid_credit_direction",
			400,
			'direction must be "credit" or "debit".',
		);
	}

	if (
		typeof payload.amount !== "number" ||
		!Number.isFinite(payload.amount) ||
		!Number.isInteger(payload.amount)
	) {
		throw new AuthError(
			"invalid_credit_amount",
			400,
			"amount must be a positive integer.",
		);
	}

	if (typeof payload.reason !== "string" || !payload.reason.trim()) {
		throw new AuthError(
			"invalid_credit_reason",
			400,
			"reason must be a non-empty string.",
		);
	}

	return {
		coinType: payload.coinType,
		direction: payload.direction,
		amount: payload.amount,
		reason: payload.reason.trim(),
		metadata: payload.metadata,
	};
}

export function createAdminRouter(authService: AuthService): Router {
	const router = Router();

	router.get("/users", async (_request, response, next) => {
		try {
			const users = await authService.listUsers();
			response.json({
				users: users.map((user) => authService.toPublicUser(user)),
			});
		} catch (error) {
			next(error);
		}
	});

	router.get("/users/:id", async (request, response, next) => {
		try {
			const user = await authService.getUserById(String(request.params.id));
			if (!user) {
				throw new AuthError("user_not_found", 404, "User not found.");
			}

			response.json({
				user: authService.toPublicUser(user),
			});
		} catch (error) {
			next(error);
		}
	});

	router.patch("/users/:id/role", async (request, response, next) => {
		try {
			const user = await authService.updateUserRole(
				String(request.params.id),
				parseRole(request.body),
			);
			response.json({
				user: authService.toPublicUser(user),
			});
		} catch (error) {
			next(error);
		}
	});

	router.patch("/users/:id/credits", async (request, response, next) => {
		try {
			if (!request.auth) {
				throw new AuthError("unauthenticated", 401, "Authentication required.");
			}

			const adjustment = parseCreditAdjustment(request.body);
			const user = await authService.adjustUserCredits({
				userId: String(request.params.id),
				actorUserId: request.auth.sub,
				...adjustment,
			});
			response.json({
				user: authService.toPublicUser(user),
			});
		} catch (error) {
			next(error);
		}
	});

	router.use(authErrorHandler);
	return router;
}
