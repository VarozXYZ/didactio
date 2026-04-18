import {
	InMemoryDidacticUnitStore,
	type DidacticUnitStore,
} from "../../src/didactic-unit/didactic-unit-store.js";
import {
	InMemoryGenerationRunStore,
	type GenerationRunStore,
} from "../../src/generation-runs/generation-run-store.js";
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

interface CreateTestAppOptions {
	didacticUnitStore?: DidacticUnitStore;
	generationRunStore?: GenerationRunStore;
	folderStore?: FolderStore;
	aiConfigStore?: AiConfigStore;
	aiService?: AiService;
	mongoHealth?: MongoHealthStatus;
}

export function createTestApp(options: CreateTestAppOptions = {}) {
	const appOptions: CreateAppOptions = {
		didacticUnitStore:
			options.didacticUnitStore ?? new InMemoryDidacticUnitStore(),
		generationRunStore:
			options.generationRunStore ?? new InMemoryGenerationRunStore(),
		folderStore: options.folderStore ?? new InMemoryFolderStore(),
		aiConfigStore: options.aiConfigStore ?? new InMemoryAiConfigStore(),
		aiService: options.aiService ?? createMockAiService(),
		mongoHealth: options.mongoHealth,
	};

	return createApp(appOptions);
}
