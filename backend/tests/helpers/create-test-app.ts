import {InMemoryCreditTransactionStore} from "../../src/auth/adapters/memory/credit-transaction-store.js";
import {InMemorySessionStore} from "../../src/auth/adapters/memory/session-store.js";
import {InMemoryUserStore} from "../../src/auth/adapters/memory/user-store.js";
import type {AuthConfig} from "../../src/auth/core/types.js";
import {
	InMemoryBillingEventStore,
	type BillingEventStore,
} from "../../src/billing/billing-event-store.js";
import type {
	BillingConfig,
	StripeClientLike,
} from "../../src/billing/service.js";
import {
	InMemoryDidacticUnitStore,
	type DidacticUnitStore,
} from "../../src/didactic-unit/didactic-unit-store.js";
import {
	InMemoryGenerationRunStore,
	type GenerationRunStore,
} from "../../src/generation-runs/generation-run-store.js";
import {
	InMemoryLearningActivityStore,
	type LearningActivityStore,
} from "../../src/activities/learning-activity-store.js";
import {createApp, type CreateAppOptions} from "../../src/app.js";
import {
	InMemoryAiConfigStore,
	type AiConfigStore,
} from "../../src/ai/config.js";
import type {AiService} from "../../src/ai/service.js";
import {
	InMemoryFolderStore,
	type FolderStore,
} from "../../src/folders/folder-store.js";
import type {MongoHealthStatus} from "../../src/mongo/mongo-connection.js";
import {createMockAiService} from "./mock-ai-service.js";

export function buildTestAuthConfig(): AuthConfig {
	return {
		googleClientId: "google-client-id",
		googleClientSecret: "google-client-secret",
		googleCallbackUrl: "http://localhost:3000/auth/google/callback",
		jwtAccessSecret: "test-access-secret-should-be-at-least-32-chars",
		jwtRefreshSecret: "test-refresh-secret-should-be-at-least-32chars",
		jwtIssuer: "didactio-test",
		jwtAudience: "web",
		accessTokenTtlSeconds: 900,
		refreshTokenTtlSeconds: 1209600,
		cookie: {
			name: "refresh_token",
			secure: false,
			sameSite: "lax",
		},
		cookieSecret: "test-cookie-secret-should-be-at-least-32chars",
		allowedRedirectUrls: ["http://localhost:5173/auth/callback"],
		defaultRedirectUrl: "http://localhost:5173/auth/callback",
		adminEmails: ["admin@example.com"],
		trustProxy: false,
		corsAllowedOrigins: ["http://localhost:5173"],
	};
}

interface CreateTestAppOptions {
	didacticUnitStore?: DidacticUnitStore;
	generationRunStore?: GenerationRunStore;
	learningActivityStore?: LearningActivityStore;
	folderStore?: FolderStore;
	aiConfigStore?: AiConfigStore;
	aiService?: AiService;
	mongoHealth?: MongoHealthStatus;
	authConfig?: AuthConfig;
	billingConfig?: BillingConfig;
	billingEventStore?: BillingEventStore;
	stripeClient?: StripeClientLike | null;
	disableAuthBypass?: boolean;
}

export function createTestApp(options: CreateTestAppOptions = {}) {
	const userStore = new InMemoryUserStore(
		options.disableAuthBypass ?
			[]
		:	[
				{
					id: "mock-user",
					provider: "google",
					providerUserId: "mock-google-user",
					email: "user@example.com",
					emailVerified: true,
					displayName: "Mock User",
					role: "user",
					status: "active",
					credits: {bronze: 0, silver: 0, gold: 0},
					createdAt: new Date("2026-01-01T00:00:00.000Z"),
					updatedAt: new Date("2026-01-01T00:00:00.000Z"),
				},
			],
	);
	const appOptions: CreateAppOptions = {
		didacticUnitStore:
			options.didacticUnitStore ?? new InMemoryDidacticUnitStore(),
		generationRunStore:
			options.generationRunStore ?? new InMemoryGenerationRunStore(),
		learningActivityStore:
			options.learningActivityStore ?? new InMemoryLearningActivityStore(),
		folderStore: options.folderStore ?? new InMemoryFolderStore(),
		aiConfigStore: options.aiConfigStore ?? new InMemoryAiConfigStore(),
		aiService: options.aiService ?? createMockAiService(),
		mongoHealth: options.mongoHealth,
		authConfig: options.authConfig ?? buildTestAuthConfig(),
		billingConfig: options.billingConfig,
		billingEventStore:
			options.billingEventStore ?? new InMemoryBillingEventStore(),
		stripeClient: options.stripeClient,
		userStore,
		sessionStore: new InMemorySessionStore(),
		creditTransactionStore: new InMemoryCreditTransactionStore(),
		testPrincipal:
			options.disableAuthBypass ?
				undefined
			:	{
					sub: "mock-user",
					sid: "test-session",
					provider: "google",
					email: "user@example.com",
					role: "user",
				},
	};

	return createApp(appOptions);
}
