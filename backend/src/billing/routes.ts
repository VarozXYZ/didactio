import type {Request, Router} from "express";
import {Router as createRouter} from "express";
import {AuthError} from "../auth/core/errors.js";
import type {BillingService} from "./service.js";

function requireUserId(request: Request): string {
	if (!request.auth) {
		throw new AuthError("unauthenticated", 401, "Authentication required.");
	}
	return request.auth.sub;
}

export function createBillingRouter(billingService: BillingService): Router {
	const router = createRouter();

	router.get("/pricing", (_request, response) => {
		response.status(200).json(billingService.getPricing());
	});

	router.get("/me", async (request, response, next) => {
		try {
			response.status(200).json(
				await billingService.getBillingSummary(requireUserId(request)),
			);
		} catch (error) {
			next(error);
		}
	});

	router.post("/checkout-session", async (request, response, next) => {
		try {
			const body = request.body as {productId?: unknown};
			if (typeof body.productId !== "string") {
				throw new AuthError("invalid_billing_product", 400, "productId is required.");
			}

			response.status(200).json(
				await billingService.createCheckoutSession({
					userId: requireUserId(request),
					productId: body.productId,
				}),
			);
		} catch (error) {
			next(error);
		}
	});

	router.post("/portal-session", async (request, response, next) => {
		try {
			response.status(200).json(
				await billingService.createPortalSession(requireUserId(request)),
			);
		} catch (error) {
			next(error);
		}
	});

	return router;
}

export function createBillingWebhookHandler(billingService: BillingService) {
	return async (request: Request, response: import("express").Response, next: import("express").NextFunction) => {
		try {
			const payload = Buffer.isBuffer(request.body) ?
				request.body
			:	Buffer.from(JSON.stringify(request.body ?? {}));
			response.status(200).json(
				await billingService.handleWebhook(
					payload,
					request.get("stripe-signature") ?? undefined,
				),
			);
		} catch (error) {
			next(error);
		}
	};
}
