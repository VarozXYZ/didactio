import crypto from "node:crypto";
import type {Db, Document} from "mongodb";
import type {
	AuthProvider,
	AuthUser,
	CreditBalances,
	NormalizedGoogleProfile,
	UserRole,
	UserStore,
} from "./core/types.js";

type AuthUserDocument = AuthUser & Document;

function createEmptyCredits(): CreditBalances {
	return {
		bronze: 0,
		silver: 0,
		gold: 0,
	};
}

function stripMongoId(document: AuthUserDocument | null): AuthUser | null {
	if (!document) {
		return null;
	}

	const {_id: _ignored, ...user} = document;
	return user as AuthUser;
}

export class MongoUserStore implements UserStore {
	private readonly collection;

	constructor(database: Db) {
		this.collection = database.collection<AuthUserDocument>("users");
		void this.collection.createIndex(
			{provider: 1, providerUserId: 1},
			{unique: true},
		);
		void this.collection.createIndex({email: 1});
	}

	async findByProviderAccount(
		provider: AuthProvider,
		providerUserId: string,
	): Promise<AuthUser | null> {
		return stripMongoId(
			await this.collection.findOne({
				provider,
				providerUserId,
			}),
		);
	}

	async findById(id: string): Promise<AuthUser | null> {
		return stripMongoId(await this.collection.findOne({id}));
	}

	async list(): Promise<AuthUser[]> {
		const documents = await this.collection.find({}).sort({createdAt: 1}).toArray();
		return documents
			.map((document) => stripMongoId(document))
			.filter((document): document is AuthUser => document !== null);
	}

	async upsertFromGoogleProfile(
		profile: NormalizedGoogleProfile,
		role: UserRole,
	): Promise<AuthUser> {
		const now = new Date();
		const existing = await this.findByProviderAccount(
			profile.provider,
			profile.providerUserId,
		);

		if (existing) {
			const updated: AuthUser = {
				...existing,
				email: profile.email,
				emailVerified: profile.emailVerified,
				displayName: profile.displayName,
				firstName: profile.firstName,
				lastName: profile.lastName,
				pictureUrl: profile.pictureUrl,
				locale: profile.locale,
				role,
				updatedAt: now,
				lastLoginAt: now,
			};

			await this.collection.updateOne({id: updated.id}, {$set: updated});
			return updated;
		}

		const created: AuthUser = {
			id: crypto.randomUUID(),
			provider: "google",
			providerUserId: profile.providerUserId,
			email: profile.email,
			emailVerified: profile.emailVerified,
			displayName: profile.displayName,
			firstName: profile.firstName,
			lastName: profile.lastName,
			pictureUrl: profile.pictureUrl,
			locale: profile.locale,
			role,
			status: "active",
			credits: createEmptyCredits(),
			createdAt: now,
			updatedAt: now,
			lastLoginAt: now,
		};

		await this.collection.insertOne(created);
		return created;
	}

	async updateRole(id: string, role: UserRole): Promise<AuthUser | null> {
		const result = await this.collection.findOneAndUpdate(
			{id},
			{
				$set: {
					role,
					updatedAt: new Date(),
				},
			},
			{returnDocument: "after"},
		);

		return stripMongoId(result);
	}

	async updateCredits(
		id: string,
		credits: CreditBalances,
	): Promise<AuthUser | null> {
		const result = await this.collection.findOneAndUpdate(
			{id},
			{
				$set: {
					credits,
					updatedAt: new Date(),
				},
			},
			{returnDocument: "after"},
		);

		return stripMongoId(result);
	}
}
