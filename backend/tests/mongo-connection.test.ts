import {describe, expect, it, vi} from "vitest";
import {connectMongo, getMongoHealthStatus} from "../src/mongo/mongo-connection.js";
import {MONGO_INDEXES} from "../src/mongo/ensure-indexes.js";

const mongodb = vi.hoisted(() => ({
	connect: vi.fn().mockResolvedValue(undefined),
	command: vi.fn().mockResolvedValue({ok: 1}),
	db: vi.fn(),
	MongoClient: vi.fn(),
}));

vi.mock("mongodb", () => ({
	MongoClient: mongodb.MongoClient,
}));

describe("Mongo connection", () => {
	it("rejects missing configuration and reports a connected database", async () => {
		await expect(connectMongo({mongoDbUri: null} as never)).rejects.toThrow("MONGODB_URI");

		const createIndex = vi.fn().mockResolvedValue("index");
		const database = {
			command: mongodb.command,
			collection: vi.fn(() => ({createIndex})),
		};
		mongodb.db.mockReturnValue(database);
		mongodb.MongoClient.mockImplementation(function () {
			return {connect: mongodb.connect, db: mongodb.db};
		});
		const connection = await connectMongo({
			mongoDbUri: "mongodb://localhost:27017",
			mongoDbName: "didactio-test",
		} as never);

		expect(mongodb.connect).toHaveBeenCalled();
		expect(mongodb.db).toHaveBeenCalledWith("didactio-test");
		expect(mongodb.command).toHaveBeenCalledWith({ping: 1});
		expect(createIndex).toHaveBeenCalledTimes(MONGO_INDEXES.length);
		expect(getMongoHealthStatus(connection)).toEqual({
			configured: true,
			connected: true,
			databaseName: "didactio-test",
		});
	});
});
