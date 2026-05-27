import type express from "express";

export interface AuthenticatedRequest extends express.Request {
  currentUser: {
    id: string;
  };
}

export function asAuthenticatedRequest(
  request: express.Request,
): AuthenticatedRequest {
  const ownerId = request.auth?.sub;
  if (!ownerId) {
    throw new Error("Authentication required.");
  }

  return Object.assign(request, {
    currentUser: {
      id: ownerId,
    },
  });
}
