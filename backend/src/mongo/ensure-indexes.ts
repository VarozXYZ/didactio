import type {Db, Document, CreateIndexesOptions} from "mongodb";

type IndexKeys = Record<string, 1 | -1>;

interface MongoIndexDefinition {
	collection: string;
	keys: IndexKeys;
	options?: CreateIndexesOptions;
}

/**
 * Indexes required by the application at runtime.
 *
 * Keeping this list at the connection boundary makes startup deterministic:
 * a deployment either has the indexes it needs or fails before serving HTTP.
 * The definitions are intentionally idempotent so they are safe to run on
 * every process start and preserve existing documents.
 */
export const MONGO_INDEXES: readonly MongoIndexDefinition[] = [
	{
		collection: "users",
		keys: {provider: 1, providerUserId: 1},
		options: {unique: true},
	},
	{collection: "users", keys: {email: 1}},
	{collection: "users", keys: {"billing.stripeCustomerId": 1}},
	{collection: "authSessions", keys: {userId: 1}},
	{collection: "authSessions", keys: {refreshTokenHash: 1}},
	{collection: "creditTransactions", keys: {userId: 1, createdAt: -1}},
	{collection: "billingEvents", keys: {id: 1}, options: {unique: true}},
	{collection: "didacticUnits", keys: {ownerId: 1, updatedAt: -1}},
	{collection: "folders", keys: {ownerId: 1, createdAt: 1}},
	{collection: "didacticUnitNotes", keys: {ownerId: 1, didacticUnitId: 1, chapterIndex: 1}},
	{
		collection: "generationRuns",
		keys: {ownerId: 1, createdAt: -1},
	},
	{
		collection: "generationRuns",
		keys: {
			ownerId: 1,
			didacticUnitId: 1,
			stage: 1,
			chapterIndex: 1,
			status: 1,
			createdAt: -1,
		},
	},
	{
		collection: "learningActivities",
		keys: {ownerId: 1, didacticUnitId: 1, chapterIndex: 1, createdAt: 1},
	},
	{
		collection: "learningActivities",
		keys: {
			ownerId: 1,
			didacticUnitId: 1,
			type: 1,
			"content.visibleModuleIndexes": 1,
		},
	},
	{collection: "learningActivityAttempts", keys: {ownerId: 1, activityId: 1, completedAt: 1}},
	{
		collection: "learningActivityProgress",
		keys: {ownerId: 1, activityId: 1},
		options: {unique: true},
	},
];

export async function ensureMongoIndexes(database: Db): Promise<void> {
	// Some entrypoint tests provide a minimal database double. A real Mongo Db
	// always exposes collection(), so this keeps those tests focused on booting.
	if (typeof (database as unknown as {collection?: unknown}).collection !== "function") {
		return;
	}

	await Promise.all(
		MONGO_INDEXES.map(({collection, keys, options}) =>
			database.collection<Document>(collection).createIndex(keys, options),
		),
	);
}
