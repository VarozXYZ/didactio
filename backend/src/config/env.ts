import dotenv from "dotenv";

let envLoaded = false;

export interface AppEnv {
	port: number;
	logLevel: "debug" | "info" | "warn" | "error";
	logFilePath: string | null;
	aiGatewayApiKey: string | null;
	aiGatewayBaseUrl: string;
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

function parseOptionalString(value: string | undefined): string | null {
	const parsedValue = value?.trim();
	return parsedValue ? parsedValue : null;
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
			"https://ai-gateway.vercel.sh/v1/ai",
		aiCheapProvider:
			parseOptionalString(process.env.AI_CHEAP_PROVIDER) ?? "deepseek",
		aiCheapModel:
			parseOptionalString(process.env.AI_CHEAP_MODEL) ?? "deepseek-chat",
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
