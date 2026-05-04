import {getAppEnv, loadEnv} from "./config/env.js";
import {loadAuthConfigFromEnv} from "./auth/core/config.js";
import {MongoCreditTransactionStore} from "./auth/mongo-credit-transaction-store.js";
import {MongoSessionStore} from "./auth/mongo-session-store.js";
import {MongoUserStore} from "./auth/mongo-user-store.js";
import {createApp} from "./app.js";
import {MongoAiConfigStore} from "./ai/config.js";
import {MongoDidacticUnitStore} from "./didactic-unit/mongo-didactic-unit-store.js";
import {MongoFolderStore} from "./folders/mongo-folder-store.js";
import {MongoGenerationRunStore} from "./generation-runs/mongo-generation-run-store.js";
import {createLogger} from "./logging/logger.js";
import {connectMongo, getMongoHealthStatus} from "./mongo/mongo-connection.js";

loadEnv();

const env = getAppEnv();
const logger = createLogger({
	name: "didactio-backend",
	level: env.logLevel,
	logFilePath: env.logFilePath,
});
const authConfig = loadAuthConfigFromEnv();
const mongoConnection = await connectMongo(env);

const didacticUnitStore = new MongoDidacticUnitStore(mongoConnection.database);
const generationRunStore = new MongoGenerationRunStore(
	mongoConnection.database,
);
const folderStore = new MongoFolderStore(mongoConnection.database);
const userStore = new MongoUserStore(mongoConnection.database);
const sessionStore = new MongoSessionStore(mongoConnection.database);
const creditTransactionStore = new MongoCreditTransactionStore(
	mongoConnection.database,
);
const aiConfigStore = new MongoAiConfigStore(mongoConnection.database);
const app = createApp({
	didacticUnitStore,
	generationRunStore,
	folderStore,
	aiConfigStore,
	authConfig,
	userStore,
	sessionStore,
	creditTransactionStore,
	mongoHealth: getMongoHealthStatus(mongoConnection),
	logger,
});

app.listen(env.port, () => {
	logger.info("Backend server listening", {
		port: env.port,
		url: `http://localhost:${env.port}`,
	});
});
