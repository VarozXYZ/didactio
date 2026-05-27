import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {buildChapterGenerationPrompt} from "../src/providers/chapter-generator.js";

const originalArgv = process.argv;

describe("chapter generation prompt", () => {
	it("builds prompts from syllabus and questionnaire context", () => {
		const prompt = buildChapterGenerationPrompt(
			{
				topic: "Quantum mechanics",
				provider: "test",
				level: "intermediate",
				questionnaireAnswers: [{questionId: "goal", value: "Understand spin"}],
				syllabus: {
					title: "Physics foundations",
					modules: [
						{
							title: "Spin systems",
							overview: "Introduce spin and measurement.",
							lessons: [{title: "Stern-Gerlach"}, {title: "Pauli matrices"}],
						},
					],
				},
			},
			0,
		);

		expect(prompt).toContain("Topic: Quantum mechanics");
		expect(prompt).toContain("Unit title: Physics foundations");
		expect(prompt).toContain("Module title: Spin systems");
		expect(prompt).toContain("- goal: Understand spin");
		expect(prompt).toContain("Return only HTML instructional content.");
	});

	it("uses defaults and rejects missing syllabus chapters", () => {
		expect(() =>
			buildChapterGenerationPrompt(
				{
					topic: "Algebra",
					provider: "test",
					level: "beginner",
					syllabus: {
						modules: [
							{
								title: "Variables",
								overview: "Symbols and values.",
								lessons: [{title: "Unknowns"}],
							},
						],
					},
				},
				1,
			),
		).toThrow("Chapter index is out of range");

		const prompt = buildChapterGenerationPrompt(
			{
				topic: "Algebra",
				provider: "test",
				level: "beginner",
				syllabus: {
					modules: [
						{
							title: "Variables",
							overview: "Symbols and values.",
							lessons: [{title: "Unknowns"}],
						},
					],
				},
			},
			0,
		);

		expect(prompt).toContain("Unit title: Algebra");
		expect(prompt).toContain("not provided");
	});
});

describe("backend entrypoints", () => {
	beforeEach(() => {
		vi.resetModules();
		process.argv = [...originalArgv];
	});

	afterEach(() => {
		process.argv = originalArgv;
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("boots the HTTP server with Mongo-backed stores", async () => {
		const listen = vi.fn((_port: number, callback: () => void) => callback());
		const info = vi.fn();

		vi.doMock("../src/config/env.js", () => ({
			loadEnv: vi.fn(),
			getAppEnv: vi.fn(() => ({
				port: 4321,
				logLevel: "silent",
				logFilePath: undefined,
				stripeSecretKey: "sk_test",
				stripeWebhookSecret: "whsec_test",
				appPublicUrl: "http://localhost:5173",
				stripePriceStarterPack: "price_start",
				stripePriceCreatorPack: "price_creator",
				stripePriceTeacherMonthly: "price_teacher",
				stripePriceTeacherProMonthly: "price_teacher_pro",
			})),
		}));
		vi.doMock("../src/auth/core/config.js", () => ({
			loadAuthConfigFromEnv: vi.fn(() => ({google: {clientId: "id"}})),
		}));
		vi.doMock("../src/logging/logger.js", () => ({
			createLogger: vi.fn(() => ({info})),
		}));
		vi.doMock("../src/mongo/mongo-connection.js", () => ({
			connectMongo: vi.fn(async () => ({database: {name: "didactio"}})),
			getMongoHealthStatus: vi.fn(() => ({status: "ok"})),
		}));
		vi.doMock("../src/app.js", () => ({
			createApp: vi.fn(() => ({listen})),
		}));

		for (const modulePath of [
			"../src/auth/mongo-credit-transaction-store.js",
			"../src/auth/mongo-session-store.js",
			"../src/auth/mongo-user-store.js",
			"../src/billing/billing-event-store.js",
			"../src/ai/config.js",
			"../src/didactic-unit/mongo-didactic-unit-store.js",
			"../src/didactic-unit/notes/mongo-note-store.js",
			"../src/folders/mongo-folder-store.js",
			"../src/generation-runs/mongo-generation-run-store.js",
			"../src/learning-activities/mongo-learning-activity-store.js",
		]) {
			vi.doMock(modulePath, () => ({
				MongoCreditTransactionStore: class {},
				MongoSessionStore: class {},
				MongoUserStore: class {},
				MongoBillingEventStore: class {},
				MongoAiConfigStore: class {},
				MongoDidacticUnitStore: class {},
				MongoDidacticUnitNoteStore: class {},
				MongoFolderStore: class {},
				MongoGenerationRunStore: class {},
				MongoLearningActivityStore: class {},
			}));
		}

		await import("../src/server.js");

		expect(listen).toHaveBeenCalledWith(4321, expect.any(Function));
		expect(info).toHaveBeenCalledWith("Backend server listening", {
			port: 4321,
			url: "http://localhost:4321",
		});
	});

	it("exports the default didactic unit template and closes Mongo", async () => {
		const close = vi.fn();
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		process.argv = ["node", "script", "unit-1"];

		vi.doMock("../src/config/env.js", () => ({
			loadEnv: vi.fn(),
			getAppEnv: vi.fn(() => ({mongoUri: "mongodb://example"})),
		}));
		vi.doMock("../src/mongo/mongo-connection.js", () => ({
			connectMongo: vi.fn(async () => ({database: {name: "db"}, client: {close}})),
		}));
		vi.doMock("../src/didactic-unit/export-default-template.js", () => ({
			exportDefaultDidacticUnitTemplate: vi.fn(async () => "template.json"),
		}));

		await import("../src/commands/export-default-didactic-unit-template.js");

		expect(log).toHaveBeenCalledWith("Exported default didactic unit template to template.json");
		expect(close).toHaveBeenCalled();
	});

	it("resets onboarding and reports the result", async () => {
		const close = vi.fn();
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
		process.argv = ["node", "script", "ada@example.com"];

		vi.doMock("../src/config/env.js", () => ({
			loadEnv: vi.fn(),
			getAppEnv: vi.fn(() => ({mongoUri: "mongodb://example"})),
		}));
		vi.doMock("../src/mongo/mongo-connection.js", () => ({
			connectMongo: vi.fn(async () => ({database: {name: "db"}, client: {close}})),
		}));
		vi.doMock("../src/auth/reset-onboarding.js", () => ({
			resetUserOnboarding: vi.fn(async () => ({found: true, modified: true})),
		}));

		await import("../src/commands/reset-onboarding.js");

		expect(log).toHaveBeenCalledWith("Onboarding reset for ada@example.com");
		expect(close).toHaveBeenCalled();
	});
});
