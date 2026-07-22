import {getAppEnv, loadEnv} from "./config/env.js";
import {loadAuthConfigFromEnv} from "./auth/core/config.js";
import {MongoCreditTransactionStore} from "./auth/mongo-credit-transaction-store.js";
import {MongoSessionStore} from "./auth/mongo-session-store.js";
import {MongoUserStore} from "./auth/mongo-user-store.js";
import {MongoBillingEventStore} from "./billing/billing-event-store.js";
import {createApp} from "./app.js";
import {MongoAiConfigStore} from "./ai/config.js";
import {MongoDidacticUnitStore} from "./didactic-unit/mongo-didactic-unit-store.js";
import {MongoDidacticUnitNoteStore} from "./didactic-unit/notes/mongo-note-store.js";
import {MongoFolderStore} from "./folders/mongo-folder-store.js";
import {MongoGenerationRunStore} from "./generation-runs/mongo-generation-run-store.js";
import {MongoLearningActivityStore} from "./learning-activities/mongo-learning-activity-store.js";
import {createLogger} from "./logging/logger.js";
import {connectMongo, getMongoHealthStatus} from "./mongo/mongo-connection.js";
import {connectRedisRateLimiter} from "./http/rate-limit.js";
import {createLangSmithTelemetryService} from "./observability/langsmith-telemetry.js";

loadEnv();

const env = getAppEnv();
const logger = createLogger({
	name: "didactio-backend",
	level: env.logLevel,
	logFilePath: env.logFilePath,
});
const authConfig = loadAuthConfigFromEnv();
const mongoConnection = await connectMongo(env);
const redisConnection = await connectRedisRateLimiter(env, logger);
const langSmithTelemetry = createLangSmithTelemetryService({
	apiKey: env.langSmithApiKey,
	project: env.langSmithProject,
	endpoint: env.langSmithEndpoint,
	tracing: env.langSmithTracing,
});

if (process.env.NODE_ENV === "production" && !redisConnection) {
	throw new Error("REDIS_URL must be configured in production.");
}

const didacticUnitStore = new MongoDidacticUnitStore(mongoConnection.database);
const generationRunStore = new MongoGenerationRunStore(
	mongoConnection.database,
);
const learningActivityStore = new MongoLearningActivityStore(
	mongoConnection.database,
);
const didacticUnitNoteStore = new MongoDidacticUnitNoteStore(
	mongoConnection.database,
);
const folderStore = new MongoFolderStore(mongoConnection.database);
const userStore = new MongoUserStore(mongoConnection.database);
const sessionStore = new MongoSessionStore(mongoConnection.database);
const creditTransactionStore = new MongoCreditTransactionStore(
	mongoConnection.database,
);
const billingEventStore = new MongoBillingEventStore(mongoConnection.database);
const aiConfigStore = new MongoAiConfigStore(mongoConnection.database);
const app = createApp({
	didacticUnitStore,
	generationRunStore,
	learningActivityStore,
	didacticUnitNoteStore,
	folderStore,
	aiConfigStore,
	authConfig,
	userStore,
	sessionStore,
	creditTransactionStore,
	billingEventStore,
	billingConfig: {
		stripeSecretKey: env.stripeSecretKey,
		stripeWebhookSecret: env.stripeWebhookSecret,
		appPublicUrl: env.appPublicUrl,
		stripePriceIds: {
			STRIPE_PRICE_STARTER_PACK: env.stripePriceStarterPack,
			STRIPE_PRICE_CREATOR_PACK: env.stripePriceCreatorPack,
			STRIPE_PRICE_TEACHER_MONTHLY: env.stripePriceTeacherMonthly,
			STRIPE_PRICE_TEACHER_PRO_MONTHLY: env.stripePriceTeacherProMonthly,
		},
	},
	mongoHealth: getMongoHealthStatus(mongoConnection),
	apiRateLimiter: redisConnection?.limiter,
	apiRateLimitPerMinute: env.apiRateLimitPerMinute,
	langSmithTelemetry,
	logger,
});

const httpServer = app.listen(env.port, () => {
	logger.info("Backend server listening", {
		port: env.port,
		url: `http://localhost:${env.port}`,
	});
});

if (httpServer && typeof httpServer.close === "function") {
	httpServer.requestTimeout = 120_000;
	httpServer.headersTimeout = 125_000;
	httpServer.keepAliveTimeout = 65_000;

	let isShuttingDown = false;
	const shutdown = (signal: string) => {
		if (isShuttingDown) {
			return;
		}
		isShuttingDown = true;
		logger.info("Backend shutdown requested", {signal});

			httpServer.close(async (error) => {
			if (error) {
				logger.error("Backend shutdown failed", {error});
				process.exitCode = 1;
			}
			await redisConnection?.close();
			await mongoConnection.client.close();
		});
	};

	process.once("SIGTERM", () => shutdown("SIGTERM"));
	process.once("SIGINT", () => shutdown("SIGINT"));
}
