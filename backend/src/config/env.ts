import dotenv from "dotenv";

let envLoaded = false;

export interface AppEnv {
	port: number;
	logLevel: "debug" | "info" | "warn" | "error";
	logFilePath: string | null;
	aiGatewayApiKey: string | null;
	aiGatewayBaseUrl: string;
	langSmithApiKey: string | null;
	langSmithProject: string;
	langSmithEndpoint: string;
	langSmithTracing: boolean;
	redisUrl: string | null;
	redisKeyPrefix: string;
	apiRateLimitPerMinute: number;
	aiCheapProvider: string;
	aiCheapModel: string;
	aiPremiumProvider: string;
	aiPremiumModel: string;
	aiAuthoringLanguage: string;
	aiAuthoringTone: string;
	aiAuthoringLearnerLevel: string;
	aiExtraInstructions: string | null;
	mongoDbUri: string | null;
	mongoDbName: string;
	stripeSecretKey: string | null;
	stripeWebhookSecret: string | null;
	stripePriceStarterPack: string | null;
	stripePriceCreatorPack: string | null;
	stripePriceTeacherMonthly: string | null;
	stripePriceTeacherProMonthly: string | null;
	appPublicUrl: string;
}

function parsePort(value: string | undefined): number {
	if (!value) {
		return 3000;
	}

	const parsedPort = Number.parseInt(value, 10);

	if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
		throw new Error("PORT must be a positive integer.");
	}

	return parsedPort;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
	if (!value) return fallback;
	const parsed = Number.parseInt(value, 10);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalString(value: string | undefined): string | null {
	const parsedValue = value?.trim();
	return parsedValue ? parsedValue : null;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
	if (value === undefined) {
		return fallback;
	}

	const normalized = value.trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes") {
		return true;
	}
	if (normalized === "false" || normalized === "0" || normalized === "no") {
		return false;
	}

	return fallback;
}

function parseLogLevel(
	value: string | undefined,
): "debug" | "info" | "warn" | "error" {
	const parsedValue = value?.trim().toLowerCase();

	if (
		parsedValue === "debug" ||
		parsedValue === "info" ||
		parsedValue === "warn" ||
		parsedValue === "error"
	) {
		return parsedValue;
	}

	return process.env.NODE_ENV === "test" ? "error" : "info";
}

export function loadEnv(): void {
	if (envLoaded) {
		return;
	}

	dotenv.config();
	envLoaded = true;
}

export function getAppEnv(): AppEnv {
	return {
		port: parsePort(process.env.PORT),
		logLevel: parseLogLevel(process.env.LOG_LEVEL),
		logFilePath: parseOptionalString(process.env.LOG_FILE_PATH),
		aiGatewayApiKey: parseOptionalString(process.env.AI_GATEWAY_API_KEY),
		aiGatewayBaseUrl:
			parseOptionalString(process.env.AI_GATEWAY_BASE_URL) ??
			"https://ai-gateway.vercel.sh/v1",
		langSmithApiKey: parseOptionalString(process.env.LANGSMITH_API_KEY),
		langSmithProject:
			parseOptionalString(process.env.LANGSMITH_PROJECT) ?? "didactio",
		langSmithEndpoint:
			parseOptionalString(process.env.LANGSMITH_ENDPOINT) ??
			"https://api.smith.langchain.com",
		langSmithTracing: parseBoolean(
			process.env.LANGSMITH_TRACING ?? process.env.LANGCHAIN_TRACING_V2,
			false,
		),
		redisUrl: parseOptionalString(process.env.REDIS_URL),
		redisKeyPrefix:
			parseOptionalString(process.env.REDIS_KEY_PREFIX) ?? "didactio:ratelimit",
		apiRateLimitPerMinute: parsePositiveInteger(
			process.env.API_RATE_LIMIT_PER_MINUTE,
			120,
		),
		aiCheapProvider:
			parseOptionalString(process.env.AI_CHEAP_PROVIDER) ?? "deepseek",
		aiCheapModel:
			parseOptionalString(process.env.AI_CHEAP_MODEL) ?? "deepseek-v4-flash",
		aiPremiumProvider:
			parseOptionalString(process.env.AI_PREMIUM_PROVIDER) ?? "deepseek",
		aiPremiumModel:
			parseOptionalString(process.env.AI_PREMIUM_MODEL) ??
			"deepseek-reasoner",
		aiAuthoringLanguage:
			parseOptionalString(process.env.AI_AUTHORING_LANGUAGE) ?? "English",
		aiAuthoringTone:
			parseOptionalString(process.env.AI_AUTHORING_TONE) ?? "neutral",
		aiAuthoringLearnerLevel:
			parseOptionalString(process.env.AI_AUTHORING_LEARNER_LEVEL) ??
			"beginner",
		aiExtraInstructions: parseOptionalString(
			process.env.AI_EXTRA_INSTRUCTIONS,
		),
		mongoDbUri: parseOptionalString(process.env.MONGODB_URI),
		mongoDbName:
			parseOptionalString(process.env.MONGODB_DB_NAME) ?? "didactio",
		stripeSecretKey: parseOptionalString(process.env.STRIPE_SECRET_KEY),
		stripeWebhookSecret: parseOptionalString(process.env.STRIPE_WEBHOOK_SECRET),
		stripePriceStarterPack: parseOptionalString(
			process.env.STRIPE_PRICE_STARTER_PACK,
		),
		stripePriceCreatorPack: parseOptionalString(
			process.env.STRIPE_PRICE_CREATOR_PACK,
		),
		stripePriceTeacherMonthly: parseOptionalString(
			process.env.STRIPE_PRICE_TEACHER_MONTHLY,
		),
		stripePriceTeacherProMonthly: parseOptionalString(
			process.env.STRIPE_PRICE_TEACHER_PRO_MONTHLY,
		),
		appPublicUrl:
			parseOptionalString(process.env.APP_PUBLIC_URL) ??
			"http://localhost:5173",
	};
}
