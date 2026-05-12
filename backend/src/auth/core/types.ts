import type {PresentationTheme} from "../../presentation-theme/types.js";

export type AuthProvider = "google";
export type UserRole = "admin" | "user";
export type AuthUserStatus = "active" | "disabled";
export type CreditCoinType = "bronze" | "silver" | "gold";
export type CreditDirection = "credit" | "debit";

export interface CreditBalances {
	bronze: number;
	silver: number;
	gold: number;
}

export type BillingSubscriptionTier = "teacher" | "teacher_pro";

export interface UserBillingProfile {
	stripeCustomerId?: string;
	stripeSubscriptionId?: string;
	subscriptionTier?: BillingSubscriptionTier;
	subscriptionStatus?: string;
	currentPeriodStart?: Date;
	currentPeriodEnd?: Date;
	cancelAtPeriodEnd?: boolean;
}

export interface AuthUser {
	id: string;
	provider: AuthProvider;
	providerUserId: string;
	email: string | null;
	emailVerified: boolean;
	displayName: string;
	firstName?: string;
	lastName?: string;
	pictureUrl?: string;
	locale?: string;
	role: UserRole;
	status: AuthUserStatus;
	credits: CreditBalances;
	billing?: UserBillingProfile;
	defaultPresentationTheme?: PresentationTheme;
	launchGiftGrantedAt?: Date;
	onboardingCompletedAt?: Date;
	createdAt: Date;
	updatedAt: Date;
	lastLoginAt?: Date;
}

export interface NormalizedGoogleProfile {
	provider: "google";
	providerUserId: string;
	email: string | null;
	emailVerified: boolean;
	displayName: string;
	firstName?: string;
	lastName?: string;
	pictureUrl?: string;
	locale?: string;
}

export interface AuthenticatedPrincipal {
	sub: string;
	sid: string;
	provider: AuthProvider;
	email: string | null;
	role: UserRole;
}

export interface SessionRecord {
	id: string;
	userId: string;
	refreshTokenHash: string;
	previousRefreshTokenHashes: string[];
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
	revokedAt?: Date;
	ipAddress?: string;
	userAgent?: string;
}

export interface SessionContext {
	ipAddress?: string;
	userAgent?: string;
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresInSeconds: number;
	refreshTokenExpiresInSeconds: number;
}

export interface CompleteGoogleAuthResult extends AuthTokens {
	user: AuthUser;
	principal: AuthenticatedPrincipal;
}

export interface RefreshSessionResult extends AuthTokens {
	user: AuthUser;
	principal: AuthenticatedPrincipal;
	reuseDetected: boolean;
}

export interface CreditTransaction {
	id: string;
	userId: string;
	coinType: CreditCoinType;
	direction: CreditDirection;
	amount: number;
	reason: string;
	actorUserId: string;
	metadata?: unknown;
	createdAt: Date;
}

export interface AuthCookieConfig {
	name: string;
	secure: boolean;
	sameSite: "lax" | "strict" | "none";
	domain?: string;
}

export interface AuthConfig {
	googleClientId: string;
	googleClientSecret: string;
	googleCallbackUrl: string;
	jwtAccessSecret: string;
	jwtRefreshSecret: string;
	jwtIssuer: string;
	jwtAudience: string;
	accessTokenTtlSeconds: number;
	refreshTokenTtlSeconds: number;
	cookie: AuthCookieConfig;
	cookieSecret: string;
	allowedRedirectUrls: string[];
	defaultRedirectUrl?: string;
	adminEmails: string[];
	trustProxy: boolean;
	corsAllowedOrigins: string[];
}

export interface PublicAuthUser {
	id: string;
	provider: AuthProvider;
	email: string | null;
	emailVerified: boolean;
	displayName: string;
	firstName?: string;
	lastName?: string;
	pictureUrl?: string;
	locale?: string;
	role: UserRole;
	status: AuthUserStatus;
	credits: CreditBalances;
	billing?: {
		stripeCustomerId?: string;
		stripeSubscriptionId?: string;
		subscriptionTier?: BillingSubscriptionTier;
		subscriptionStatus?: string;
		currentPeriodStart?: string;
		currentPeriodEnd?: string;
		cancelAtPeriodEnd?: boolean;
	};
	defaultPresentationTheme: PresentationTheme;
	launchGiftGrantedAt?: string;
	onboardingCompletedAt?: string;
	lastLoginAt?: string;
}

export interface UserStore {
	findByProviderAccount(
		provider: AuthProvider,
		providerUserId: string,
	): Promise<AuthUser | null>;
	findById(id: string): Promise<AuthUser | null>;
	findByStripeCustomerId(stripeCustomerId: string): Promise<AuthUser | null>;
	list(): Promise<AuthUser[]>;
	upsertFromGoogleProfile(
		profile: NormalizedGoogleProfile,
		role: UserRole,
	): Promise<AuthUser>;
	updateRole(id: string, role: UserRole): Promise<AuthUser | null>;
	updateCredits(
		id: string,
		credits: CreditBalances,
	): Promise<AuthUser | null>;
	grantLaunchCredits(
		id: string,
		credits: CreditBalances,
		grantedAt: Date,
	): Promise<AuthUser | null>;
	updateDefaultPresentationTheme(
		id: string,
		theme: PresentationTheme,
	): Promise<AuthUser | null>;
	updateBillingProfile(
		id: string,
		billing: UserBillingProfile,
	): Promise<AuthUser | null>;
	applyCreditDelta(input: {
		id: string;
		coinType: CreditCoinType;
		delta: number;
		requireSufficientBalance: boolean;
	}): Promise<AuthUser | null>;
	updateDisplayName(id: string, displayName: string): Promise<AuthUser | null>;
	completeOnboarding(id: string, at: Date): Promise<AuthUser | null>;
}

export interface SessionStore {
	createSession(input: {
		id: string;
		userId: string;
		refreshTokenHash: string;
		expiresAt: Date;
		ipAddress?: string;
		userAgent?: string;
	}): Promise<SessionRecord>;
	findByRefreshTokenHash(refreshTokenHash: string): Promise<SessionRecord | null>;
	rotateSession(
		sessionId: string,
		nextRefreshTokenHash: string,
		nextExpiresAt: Date,
	): Promise<SessionRecord | null>;
	revokeSession(sessionId: string): Promise<void>;
	revokeAllForUser(userId: string): Promise<void>;
}

export interface CreditTransactionStore {
	create(transaction: CreditTransaction): Promise<void>;
	listByUserId(userId: string): Promise<CreditTransaction[]>;
}
