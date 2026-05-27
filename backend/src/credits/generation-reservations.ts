import type { Response } from "express";
import { AuthError, getPublicAuthErrorMessage } from "../auth/core/errors.js";
import type { AuthService } from "../auth/core/service.js";
import type { GenerationCoinCost } from "./generation-costs.js";

export type CreditReservation = Awaited<
  ReturnType<AuthService["reserveUserCredits"]>
>;

export function sendAuthErrorResponse(
  response: Response,
  error: AuthError,
): void {
  response.status(error.statusCode).json({
    error: error.code,
    message: getPublicAuthErrorMessage(error),
    ...(error.details ?? {}),
  });
}

export async function reserveGenerationCredits(input: {
  authService: AuthService;
  ownerId: string;
  cost: GenerationCoinCost;
  reason: string;
  metadata: Record<string, unknown>;
}): Promise<CreditReservation | null> {
  const user = await input.authService.getUserById(input.ownerId);
  if (user?.role === "admin") {
    return null;
  }

  return input.authService.reserveUserCredits({
    userId: input.ownerId,
    coinType: input.cost.coinType,
    amount: input.cost.amount,
    reason: input.reason,
    metadata: input.metadata,
  });
}

export async function refundGenerationCredits(input: {
  authService: AuthService;
  reservation: CreditReservation | null;
  reason: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  if (!input.reservation) {
    return;
  }

  await input.authService.refundUserCredits({
    userId: input.reservation.transaction.userId,
    coinType: input.reservation.transaction.coinType,
    amount: input.reservation.transaction.amount,
    reason: input.reason,
    metadata: {
      ...input.metadata,
      refundedTransactionId: input.reservation.transaction.id,
    },
  });
}
