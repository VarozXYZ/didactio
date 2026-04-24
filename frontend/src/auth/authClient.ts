export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type AuthUser = {
	id: string;
	provider: "google";
	email: string | null;
	emailVerified: boolean;
	displayName: string;
	firstName?: string;
	lastName?: string;
	pictureUrl?: string;
	locale?: string;
	role: "admin" | "user";
	status: "active" | "disabled";
	credits: {
		bronze: number;
		silver: number;
		gold: number;
	};
	lastLoginAt?: string;
};

type AuthSnapshot = {
	status: AuthStatus;
	user: AuthUser | null;
	accessToken: string | null;
	error: string | null;
};

type RefreshResponse = {
	accessToken: string;
	expiresIn: number;
	user: AuthUser;
};

type Listener = (snapshot: AuthSnapshot) => void;

let snapshot: AuthSnapshot = {
	status: "loading",
	user: null,
	accessToken: null,
	error: null,
};
let bootstrapPromise: Promise<AuthSnapshot> | null = null;
let refreshPromise: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

function emit() {
	for (const listener of listeners) {
		listener(snapshot);
	}
}

function setSnapshot(next: Partial<AuthSnapshot>) {
	snapshot = {
		...snapshot,
		...next,
	};
	emit();
}

async function parseErrorBody(response: Response): Promise<{message: string; error: string}> {
	try {
		const body = (await response.json()) as {message?: string; error?: string};
		return {
			message: body.message ?? body.error ?? "Authentication request failed.",
			error: body.error ?? "",
		};
	} catch {
		return {message: "Authentication request failed.", error: ""};
	}
}

async function requestRefresh(): Promise<string | null> {
	const response = await fetch("/auth/refresh", {
		method: "POST",
		credentials: "include",
	});

	if (!response.ok) {
		const {message, error} = await parseErrorBody(response);
		setSnapshot({
			status: "unauthenticated",
			user: null,
			accessToken: null,
			error: error === "missing_refresh_token" ? null : message,
		});
		return null;
	}

	const payload = (await response.json()) as RefreshResponse;
	setSnapshot({
		status: "authenticated",
		user: payload.user,
		accessToken: payload.accessToken,
		error: null,
	});
	return payload.accessToken;
}

export const authClient = {
	getSnapshot(): AuthSnapshot {
		return snapshot;
	},

	subscribe(listener: Listener) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	},

	async bootstrap() {
		if (!bootstrapPromise) {
			bootstrapPromise = requestRefresh().then(() => snapshot);
		}

		return bootstrapPromise;
	},

	async refreshAccessToken() {
		if (!refreshPromise) {
			refreshPromise = requestRefresh().finally(() => {
				refreshPromise = null;
			});
		}

		return refreshPromise;
	},

	async authorizedFetch(
		input: RequestInfo | URL,
		init: RequestInit = {},
	): Promise<Response> {
		let token = snapshot.accessToken;
		if (!token) {
			token = await this.refreshAccessToken();
		}

		const headers = new Headers(init.headers);
		if (token) {
			headers.set("Authorization", `Bearer ${token}`);
		}
		if (!headers.has("Content-Type") && init.body) {
			headers.set("Content-Type", "application/json");
		}

		let response = await fetch(input, {
			...init,
			cache: init.cache ?? "no-store",
			headers,
			credentials: "include",
		});

		if (response.status !== 401) {
			return response;
		}

		token = await this.refreshAccessToken();
		if (!token) {
			return response;
		}

		const retryHeaders = new Headers(init.headers);
		retryHeaders.set("Authorization", `Bearer ${token}`);
		if (!retryHeaders.has("Content-Type") && init.body) {
			retryHeaders.set("Content-Type", "application/json");
		}

		response = await fetch(input, {
			...init,
			cache: init.cache ?? "no-store",
			headers: retryHeaders,
			credentials: "include",
		});

		if (response.status === 401) {
			setSnapshot({
				status: "unauthenticated",
				user: null,
				accessToken: null,
				error: "Your session expired. Please sign in again.",
			});
		}

		return response;
	},

	beginGoogleLogin() {
		const redirectTo = `${window.location.origin}/auth/callback`;
		window.location.href = `/auth/google?redirectTo=${encodeURIComponent(redirectTo)}`;
	},

	async handleOAuthCallback(search: string) {
		const params = new URLSearchParams(search);
		const status = params.get("status");
		const error = params.get("error");

		if (status !== "success") {
			const message = error ? `Google sign-in failed: ${error}` : "Google sign-in failed.";
			setSnapshot({
				status: "unauthenticated",
				user: null,
				accessToken: null,
				error: message,
			});
			throw new Error(message);
		}

		await this.refreshAccessToken();
		return snapshot;
	},

	async logout() {
		await fetch("/auth/logout", {
			method: "POST",
			credentials: "include",
		});
		setSnapshot({
			status: "unauthenticated",
			user: null,
			accessToken: null,
			error: null,
		});
	},
};
