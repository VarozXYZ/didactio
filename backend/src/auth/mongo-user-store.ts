import crypto from "node:crypto";
import type {Db, Document} from "mongodb";
import type {
	AuthProvider,
	AuthUser,
	CreditBalances,
	NormalizedGoogleProfile,
	UserBillingProfile,
	UserRole,
	UserStore,
} from "./core/types.js";
import {
	SYSTEM_DEFAULT_THEME,
	type PresentationTheme,
} from "../presentation-theme/types.js";

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
		void this.collection.createIndex({"billing.stripeCustomerId": 1});
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

	async findByStripeCustomerId(stripeCustomerId: string): Promise<AuthUser | null> {
		return stripMongoId(
			await this.collection.findOne({"billing.stripeCustomerId": stripeCustomerId}),
		);
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
				defaultPresentationTheme:
					existing.defaultPresentationTheme ?? SYSTEM_DEFAULT_THEME,
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
			defaultPresentationTheme: SYSTEM_DEFAULT_THEME,
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

	async grantLaunchCredits(
		id: string,
		credits: CreditBalances,
		grantedAt: Date,
	): Promise<AuthUser | null> {
		const result = await this.collection.findOneAndUpdate(
			{id, launchGiftGrantedAt: {$exists: false}},
			{
				$inc: {
					"credits.bronze": credits.bronze,
					"credits.silver": credits.silver,
					"credits.gold": credits.gold,
				},
				$set: {
					launchGiftGrantedAt: grantedAt,
					updatedAt: grantedAt,
				},
			},
			{returnDocument: "after"},
		);

		return stripMongoId(result) ?? this.findById(id);
	}

	async updateDefaultPresentationTheme(
		id: string,
		theme: PresentationTheme,
	): Promise<AuthUser | null> {
		const result = await this.collection.findOneAndUpdate(
			{id},
			{
				$set: {
					defaultPresentationTheme: theme,
					updatedAt: new Date(),
				},
			},
			{returnDocument: "after"},
		);

		return stripMongoId(result);
	}

	async updateBillingProfile(
		id: string,
		billing: UserBillingProfile,
	): Promise<AuthUser | null> {
		const $set: Record<string, unknown> = {
			updatedAt: new Date(),
		};

		for (const [key, value] of Object.entries(billing)) {
			$set[`billing.${key}`] = value;
		}

		const result = await this.collection.findOneAndUpdate(
			{id},
			{$set},
			{returnDocument: "after"},
		);

		return stripMongoId(result);
	}

	async updateDisplayName(id: string, displayName: string): Promise<AuthUser | null> {
		const result = await this.collection.findOneAndUpdate(
			{id},
			{$set: {displayName, updatedAt: new Date()}},
			{returnDocument: "after"},
		);
		return stripMongoId(result);
	}

	async completeOnboarding(id: string, at: Date): Promise<AuthUser | null> {
		const result = await this.collection.findOneAndUpdate(
			{id},
			{$set: {onboardingCompletedAt: at, updatedAt: at}},
			{returnDocument: "after"},
		);
		return stripMongoId(result);
	}

	async applyCreditDelta(input: {
		id: string;
		coinType: keyof CreditBalances;
		delta: number;
		requireSufficientBalance: boolean;
	}): Promise<AuthUser | null> {
		const creditPath = `credits.${input.coinType}`;
		const filter: Record<string, unknown> = {id: input.id};

		if (input.requireSufficientBalance && input.delta < 0) {
			filter[creditPath] = {$gte: Math.abs(input.delta)};
		}

		const result = await this.collection.findOneAndUpdate(
			filter,
			{
				$inc: {
					[creditPath]: input.delta,
				},
				$set: {
					updatedAt: new Date(),
				},
			},
			{returnDocument: "after"},
		);

		return stripMongoId(result);
	}
}
