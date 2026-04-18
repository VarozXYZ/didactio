import type {AuthenticatedPrincipal} from "../auth/core/types.js";

declare global {
	namespace Express {
		interface Request {
			auth?: AuthenticatedPrincipal;
		}
	}
}

export {};
