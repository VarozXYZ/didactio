import crypto from "node:crypto";
import {AuthError} from "./errors.js";
import {
	hashToken,
	signAccessToken,
	signRefreshToken,
	verifyRefreshToken,
} from "./tokens.js";
import type {
	AuthConfig,
	AuthenticatedPrincipal,
	AuthUser,
	CompleteGoogleAuthResult,
	CreditBalances,
	CreditCoinType,
	CreditDirection,
	CreditTransaction,
	CreditTransactionStore,
	NormalizedGoogleProfile,
	PublicAuthUser,
	RefreshSessionResult,
	SessionContext,
	SessionStore,
	UserRole,
	UserStore,
} from "./types.js";

function emptyCredits(): CreditBalances {
	return {
		bronze: 0,
		silver: 0,
		gold: 0,
	};
}

export class AuthService {
	constructor(
		private readonly userStore: UserStore,
		private readonly sessionStore: SessionStore,
		private readonly creditTransactionStore: CreditTransactionStore,
		private readonly config: AuthConfig,
	) {}

	resolveRoleForEmail(email: string | null): UserRole {
		if (!email) {
			return "user";
		}

		return this.config.adminEmails.includes(email.toLowerCase()) ?
				"admin"
			:	"user";
	}

	async completeGoogleAuth(
		profile: NormalizedGoogleProfile,
		context: SessionContext = {},
	): Promise<CompleteGoogleAuthResult> {
		if (!profile.providerUserId) {
			throw new AuthError(
				"invalid_google_profile",
				401,
				"Google profile does not include a stable account id.",
			);
		}

		const role = this.resolveRoleForEmail(profile.email);
		const user = await this.userStore.upsertFromGoogleProfile(profile, role);
		if (user.status !== "active") {
			throw new AuthError("user_disabled", 403, "User is disabled.");
		}

		const sessionId = crypto.randomUUID();
		const refreshToken = signRefreshToken(user.id, sessionId, this.config);
		const refreshTokenHash = hashToken(refreshToken);
		const expiresAt = new Date(
			Date.now() + this.config.refreshTokenTtlSeconds * 1000,
		);

		await this.sessionStore.createSession({
			id: sessionId,
			userId: user.id,
			refreshTokenHash,
			expiresAt,
			ipAddress: context.ipAddress,
			userAgent: context.userAgent,
		});

		const principal = this.buildPrincipal(
			user.id,
			sessionId,
			user.email,
			user.role,
		);

		return {
			accessToken: signAccessToken(principal, this.config),
			refreshToken,
			accessTokenExpiresInSeconds: this.config.accessTokenTtlSeconds,
			refreshTokenExpiresInSeconds: this.config.refreshTokenTtlSeconds,
			user,
			principal,
		};
	}

	async refreshSession(
		refreshToken: string,
		context: SessionContext = {},
	): Promise<RefreshSessionResult> {
		const decoded = verifyRefreshToken(refreshToken, this.config);
		const refreshTokenHash = hashToken(refreshToken);
		const session = await this.sessionStore.findByRefreshTokenHash(
			refreshTokenHash,
		);

		if (!session) {
			throw new AuthError(
				"invalid_refresh_token",
				401,
				"Refresh token is unknown.",
			);
		}

		if (session.userId !== decoded.sub || session.id !== decoded.sid) {
			await this.sessionStore.revokeSession(session.id);
			throw new AuthError(
				"session_mismatch",
				401,
				"Refresh token does not match the stored session.",
			);
		}

		if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
			await this.sessionStore.revokeSession(session.id);
			throw new AuthError(
				"session_expired",
				401,
				"Session is expired or revoked.",
			);
		}

		const reuseDetected = session.refreshTokenHash !== refreshTokenHash;
		if (reuseDetected) {
			await this.sessionStore.revokeAllForUser(session.userId);
			throw new AuthError(
				"refresh_token_reuse_detected",
				401,
				"Refresh token reuse detected.",
			);
		}

		const user = await this.userStore.findById(session.userId);
		if (!user || user.status !== "active") {
			await this.sessionStore.revokeAllForUser(session.userId);
			throw new AuthError(
				"user_unavailable",
				401,
				"User is no longer available.",
			);
		}

		const nextRefreshToken = signRefreshToken(user.id, session.id, this.config);
		const nextRefreshTokenHash = hashToken(nextRefreshToken);
		const nextExpiresAt = new Date(
			Date.now() + this.config.refreshTokenTtlSeconds * 1000,
		);

		const rotatedSession = await this.sessionStore.rotateSession(
			session.id,
			nextRefreshTokenHash,
			nextExpiresAt,
		);
		if (!rotatedSession) {
			throw new AuthError(
				"session_rotation_failed",
				401,
				"Could not rotate session.",
			);
		}

		if (context.ipAddress) {
			rotatedSession.ipAddress = context.ipAddress;
		}
		if (context.userAgent) {
			rotatedSession.userAgent = context.userAgent;
		}

		const principal = this.buildPrincipal(
			user.id,
			rotatedSession.id,
			user.email,
			user.role,
		);

		return {
			accessToken: signAccessToken(principal, this.config),
			refreshToken: nextRefreshToken,
			accessTokenExpiresInSeconds: this.config.accessTokenTtlSeconds,
			refreshTokenExpiresInSeconds: this.config.refreshTokenTtlSeconds,
			user,
			principal,
			reuseDetected: false,
		};
	}

	async logout(refreshToken: string | null | undefined): Promise<void> {
		if (!refreshToken) {
			return;
		}

		const refreshTokenHash = hashToken(refreshToken);
		const session = await this.sessionStore.findByRefreshTokenHash(
			refreshTokenHash,
		);
		if (!session) {
			return;
		}

		await this.sessionStore.revokeSession(session.id);
	}

	async getUserById(id: string): Promise<AuthUser | null> {
		return this.userStore.findById(id);
	}

	async listUsers(): Promise<AuthUser[]> {
		return this.userStore.list();
	}

	async updateUserRole(userId: string, role: UserRole): Promise<AuthUser> {
		const updatedUser = await this.userStore.updateRole(userId, role);
		if (!updatedUser) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		return updatedUser;
	}

	async adjustUserCredits(input: {
		userId: string;
		actorUserId: string;
		coinType: CreditCoinType;
		direction: CreditDirection;
		amount: number;
		reason: string;
		metadata?: unknown;
	}): Promise<AuthUser> {
		if (!Number.isInteger(input.amount) || input.amount <= 0) {
			throw new AuthError(
				"invalid_credit_adjustment",
				400,
				"Credit adjustment amount must be a positive integer.",
			);
		}

		const user = await this.userStore.findById(input.userId);
		if (!user) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		const nextCredits = {
			...(user.credits ?? emptyCredits()),
		};
		const delta = input.direction === "credit" ? input.amount : -input.amount;
		const nextValue = nextCredits[input.coinType] + delta;

		if (nextValue < 0) {
			throw new AuthError(
				"insufficient_credits",
				409,
				"Credit adjustment would make the balance negative.",
			);
		}

		nextCredits[input.coinType] = nextValue;
		const updatedUser = await this.userStore.updateCredits(user.id, nextCredits);
		if (!updatedUser) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		const transaction: CreditTransaction = {
			id: crypto.randomUUID(),
			userId: user.id,
			coinType: input.coinType,
			direction: input.direction,
			amount: input.amount,
			reason: input.reason,
			actorUserId: input.actorUserId,
			metadata: input.metadata,
			createdAt: new Date(),
		};
		await this.creditTransactionStore.create(transaction);

		return updatedUser;
	}

	toPublicUser(user: AuthUser): PublicAuthUser {
		return {
			id: user.id,
			provider: user.provider,
			email: user.email,
			emailVerified: user.emailVerified,
			displayName: user.displayName,
			firstName: user.firstName,
			lastName: user.lastName,
			pictureUrl: user.pictureUrl,
			locale: user.locale,
			role: user.role,
			status: user.status,
			credits: user.credits ?? emptyCredits(),
			lastLoginAt: user.lastLoginAt?.toISOString(),
		};
	}

	private buildPrincipal(
		userId: string,
		sessionId: string,
		email: string | null,
		role: UserRole,
	): AuthenticatedPrincipal {
		return {
			sub: userId,
			sid: sessionId,
			provider: "google",
			email,
			role,
		};
	}
}
