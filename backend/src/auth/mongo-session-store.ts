import type {Db, Document} from "mongodb";
import type {SessionContext, SessionRecord, SessionStore} from "./core/types.js";

type SessionDocument = SessionRecord & Document;

function stripMongoId(document: SessionDocument | null): SessionRecord | null {
	if (!document) {
		return null;
	}

	const {_id: _ignored, ...session} = document;
	return session as SessionRecord;
}

export class MongoSessionStore implements SessionStore {
	private readonly collection;

	constructor(database: Db) {
		this.collection = database.collection<SessionDocument>("authSessions");
	}

	async createSession(input: {
		id: string;
		userId: string;
		refreshTokenHash: string;
		expiresAt: Date;
		ipAddress?: string;
		userAgent?: string;
	}): Promise<SessionRecord> {
		const now = new Date();
		const session: SessionRecord = {
			id: input.id,
			userId: input.userId,
			refreshTokenHash: input.refreshTokenHash,
			previousRefreshTokenHashes: [],
			expiresAt: input.expiresAt,
			createdAt: now,
			updatedAt: now,
			ipAddress: input.ipAddress,
			userAgent: input.userAgent,
		};

		await this.collection.insertOne(session);
		return session;
	}

	async findByRefreshTokenHash(
		refreshTokenHash: string,
	): Promise<SessionRecord | null> {
		return stripMongoId(
			await this.collection.findOne({
				$or: [
					{refreshTokenHash},
					{previousRefreshTokenHashes: refreshTokenHash},
				],
			}),
		);
	}

	async rotateSession(
		sessionId: string,
		nextRefreshTokenHash: string,
		nextExpiresAt: Date,
		context: SessionContext = {},
	): Promise<SessionRecord | null> {
		const session = await stripMongoId(
			await this.collection.findOne({id: sessionId}),
		);
		if (!session || session.revokedAt) {
			return null;
		}

		const previousRefreshTokenHashes = [
			session.refreshTokenHash,
			...session.previousRefreshTokenHashes,
		].slice(0, 5);

		const sessionContext = {
			...(context.ipAddress ? {ipAddress: context.ipAddress} : {}),
			...(context.userAgent ? {userAgent: context.userAgent} : {}),
		};
		const result = await this.collection.findOneAndUpdate(
			{id: sessionId, revokedAt: {$exists: false}},
			{
				$set: {
					refreshTokenHash: nextRefreshTokenHash,
					previousRefreshTokenHashes,
					expiresAt: nextExpiresAt,
					updatedAt: new Date(),
					...sessionContext,
				},
			},
			{returnDocument: "after"},
		);

		return stripMongoId(result);
	}

	async revokeSession(sessionId: string): Promise<void> {
		await this.collection.updateOne(
			{id: sessionId, revokedAt: {$exists: false}},
			{
				$set: {
					revokedAt: new Date(),
					updatedAt: new Date(),
				},
			},
		);
	}

	async revokeAllForUser(userId: string): Promise<void> {
		await this.collection.updateMany(
			{userId, revokedAt: {$exists: false}},
			{
				$set: {
					revokedAt: new Date(),
					updatedAt: new Date(),
				},
			},
		);
	}
}
