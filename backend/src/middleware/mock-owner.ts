import type {NextFunction, Request, Response} from "express";

const DEFAULT_MOCK_OWNER_ID = "mock-user";

export interface MockOwner {
	id: string;
}

export interface RequestWithMockOwner extends Request {
	mockOwner: MockOwner;
}

export function resolveMockOwnerId(): string {
	return process.env.MOCK_OWNER_ID?.trim() || DEFAULT_MOCK_OWNER_ID;
}

export function attachMockOwner(
	request: Request,
	_response: Response,
	next: NextFunction,
): void {
	const requestWithMockOwner = request as RequestWithMockOwner;
	requestWithMockOwner.mockOwner = {
		id: resolveMockOwnerId(),
	};

	next();
}
