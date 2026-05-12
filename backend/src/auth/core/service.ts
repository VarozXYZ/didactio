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
import {SYSTEM_DEFAULT_THEME, type PresentationTheme} from "../../presentation-theme/types.js";
import {normalizePresentationTheme} from "../../presentation-theme/validate.js";
import {
	BRONZE_FAIR_USE_MONTHLY_LIMIT,
	isActiveBillingStatus,
} from "../../billing/pricing.js";

function emptyCredits(): CreditBalances {
	return {
		bronze: 0,
		silver: 0,
		gold: 0,
	};
}

const LAUNCH_GIFT_CREDITS: CreditBalances = {
	bronze: 30,
	silver: 15,
	gold: 1,
};

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
		const user = await this.ensureLaunchGift(
			await this.userStore.upsertFromGoogleProfile(profile, role),
		);
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

		const foundUser = await this.userStore.findById(session.userId);
		const user = foundUser ? await this.ensureLaunchGift(foundUser) : null;
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
		const user = await this.userStore.findById(id);
		return user ? this.ensureLaunchGift(user) : null;
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

		const foundUser = await this.userStore.findById(input.userId);
		const user = foundUser ? await this.ensureLaunchGift(foundUser) : null;
		if (!user) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		const delta = input.direction === "credit" ? input.amount : -input.amount;
		const updatedUser = await this.userStore.applyCreditDelta({
			id: user.id,
			coinType: input.coinType,
			delta,
			requireSufficientBalance: input.direction === "debit",
		});
		if (!updatedUser) {
			throw new AuthError(
				"insufficient_credits",
				409,
				"Credit adjustment would make the balance negative.",
			);
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

	async reserveUserCredits(input: {
		userId: string;
		coinType: CreditCoinType;
		amount: number;
		reason: string;
		metadata?: unknown;
	}): Promise<{user: AuthUser; transaction: CreditTransaction}> {
		this.assertPositiveAmount(input.amount);
		const foundUser = await this.userStore.findById(input.userId);
		const user = foundUser ? await this.ensureLaunchGift(foundUser) : null;
		if (!user) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		if (
			input.coinType === "bronze" &&
			isActiveBillingStatus(user.billing?.subscriptionStatus)
		) {
			const transactions = await this.creditTransactionStore.listByUserId(user.id);
			const periodStart = new Date();
			periodStart.setUTCDate(1);
			periodStart.setUTCHours(0, 0, 0, 0);
			const coveredBronzeThisMonth = transactions
				.filter(
					(transaction) =>
						transaction.coinType === "bronze" &&
						transaction.direction === "debit" &&
						transaction.createdAt >= periodStart &&
						typeof transaction.metadata === "object" &&
						transaction.metadata !== null &&
						(transaction.metadata as {subscriptionCovered?: unknown})
							.subscriptionCovered === true,
				)
				.reduce((sum, transaction) => sum + transaction.amount, 0);

			if (coveredBronzeThisMonth + input.amount <= BRONZE_FAIR_USE_MONTHLY_LIMIT) {
				const transaction = await this.createCreditTransaction({
					userId: user.id,
					coinType: input.coinType,
					direction: "debit",
					amount: input.amount,
					reason: input.reason,
					actorUserId: user.id,
					metadata: {
						...(typeof input.metadata === "object" && input.metadata !== null ?
							input.metadata
						:	{}),
						subscriptionCovered: true,
						fairUseMonthlyLimit: BRONZE_FAIR_USE_MONTHLY_LIMIT,
					},
				});
				return {user, transaction};
			}
		}

		const updatedUser = await this.userStore.applyCreditDelta({
			id: user.id,
			coinType: input.coinType,
			delta: -input.amount,
			requireSufficientBalance: true,
		});

		if (!updatedUser) {
			throw new AuthError(
				"insufficient_credits",
				402,
				"Not enough coins for this generation.",
				{
					requiredCost: {
						coinType: input.coinType,
						amount: input.amount,
					},
					credits: user.credits ?? emptyCredits(),
				},
			);
		}

		const transaction = await this.createCreditTransaction({
			userId: user.id,
			coinType: input.coinType,
			direction: "debit",
			amount: input.amount,
			reason: input.reason,
			actorUserId: user.id,
			metadata: input.metadata,
		});

		return {user: updatedUser, transaction};
	}

	async refundUserCredits(input: {
		userId: string;
		coinType: CreditCoinType;
		amount: number;
		reason: string;
		metadata?: unknown;
	}): Promise<AuthUser> {
		this.assertPositiveAmount(input.amount);
		const user = await this.userStore.applyCreditDelta({
			id: input.userId,
			coinType: input.coinType,
			delta: input.amount,
			requireSufficientBalance: false,
		});
		if (!user) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		await this.createCreditTransaction({
			userId: input.userId,
			coinType: input.coinType,
			direction: "credit",
			amount: input.amount,
			reason: input.reason,
			actorUserId: input.userId,
			metadata: input.metadata,
		});

		return user;
	}

	async listUserCreditTransactions(userId: string): Promise<CreditTransaction[]> {
		return this.creditTransactionStore.listByUserId(userId);
	}

	async updateDefaultPresentationTheme(
		userId: string,
		theme: PresentationTheme,
	): Promise<AuthUser> {
		const updatedUser = await this.userStore.updateDefaultPresentationTheme(
			userId,
			normalizePresentationTheme(theme),
		);
		if (!updatedUser) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		return updatedUser;
	}

	async updateDisplayName(userId: string, displayName: string): Promise<AuthUser> {
		const trimmed = displayName.trim();
		if (!trimmed) {
			throw new AuthError("invalid_display_name", 400, "Display name must not be empty.");
		}

		const updatedUser = await this.userStore.updateDisplayName(userId, trimmed);
		if (!updatedUser) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		return updatedUser;
	}

	async completeOnboarding(userId: string): Promise<AuthUser> {
		const updatedUser = await this.userStore.completeOnboarding(userId, new Date());
		if (!updatedUser) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

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
			billing: user.billing ?
				{
					stripeCustomerId: user.billing.stripeCustomerId,
					stripeSubscriptionId: user.billing.stripeSubscriptionId,
					subscriptionTier: user.billing.subscriptionTier,
					subscriptionStatus: user.billing.subscriptionStatus,
					currentPeriodStart:
						user.billing.currentPeriodStart?.toISOString(),
					currentPeriodEnd: user.billing.currentPeriodEnd?.toISOString(),
					cancelAtPeriodEnd: user.billing.cancelAtPeriodEnd,
				}
			:	undefined,
			defaultPresentationTheme:
				user.defaultPresentationTheme ?? SYSTEM_DEFAULT_THEME,
			launchGiftGrantedAt: user.launchGiftGrantedAt?.toISOString(),
			onboardingCompletedAt: user.onboardingCompletedAt?.toISOString(),
			lastLoginAt: user.lastLoginAt?.toISOString(),
		};
	}

	private assertPositiveAmount(amount: number): void {
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new AuthError(
				"invalid_credit_adjustment",
				400,
				"Credit adjustment amount must be a positive integer.",
			);
		}
	}

	private async ensureLaunchGift(user: AuthUser): Promise<AuthUser> {
		if (user.launchGiftGrantedAt) {
			return user;
		}

		const grantedAt = new Date();
		const updatedUser = await this.userStore.grantLaunchCredits(
			user.id,
			LAUNCH_GIFT_CREDITS,
			grantedAt,
		);
		if (!updatedUser) {
			throw new AuthError("user_not_found", 404, "User not found.");
		}

		if (
			updatedUser.launchGiftGrantedAt?.getTime() === grantedAt.getTime()
		) {
			await Promise.all(
				(["bronze", "silver", "gold"] as const).map((coinType) =>
					this.createCreditTransaction({
						userId: user.id,
						coinType,
						direction: "credit",
						amount: LAUNCH_GIFT_CREDITS[coinType],
						reason: "launch_gift",
						actorUserId: user.id,
						metadata: {source: "launch_gift"},
					}),
				),
			);
		}

		return updatedUser;
	}

	private async createCreditTransaction(input: {
		userId: string;
		coinType: CreditCoinType;
		direction: CreditDirection;
		amount: number;
		reason: string;
		actorUserId: string;
		metadata?: unknown;
	}): Promise<CreditTransaction> {
		const transaction: CreditTransaction = {
			id: crypto.randomUUID(),
			userId: input.userId,
			coinType: input.coinType,
			direction: input.direction,
			amount: input.amount,
			reason: input.reason,
			actorUserId: input.actorUserId,
			metadata: input.metadata,
			createdAt: new Date(),
		};
		await this.creditTransactionStore.create(transaction);
		return transaction;
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
