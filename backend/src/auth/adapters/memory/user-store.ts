import crypto from "node:crypto";
import type {
	AuthProvider,
	AuthUser,
	CreditBalances,
	NormalizedGoogleProfile,
	UserRole,
	UserStore,
} from "../../core/types.js";

function createEmptyCredits(): CreditBalances {
	return {
		bronze: 0,
		silver: 0,
		gold: 0,
	};
}

export class InMemoryUserStore implements UserStore {
	private readonly usersById = new Map<string, AuthUser>();
	private readonly userIdsByProviderAccount = new Map<string, string>();

	async findByProviderAccount(
		provider: AuthProvider,
		providerUserId: string,
	): Promise<AuthUser | null> {
		const id = this.userIdsByProviderAccount.get(
			this.providerKey(provider, providerUserId),
		);
		if (!id) {
			return null;
		}

		return this.usersById.get(id) ?? null;
	}

	async findById(id: string): Promise<AuthUser | null> {
		return this.usersById.get(id) ?? null;
	}

	async list(): Promise<AuthUser[]> {
		return [...this.usersById.values()].sort((left, right) =>
			left.createdAt.getTime() - right.createdAt.getTime(),
		);
	}

	async upsertFromGoogleProfile(
		profile: NormalizedGoogleProfile,
		role: UserRole,
	): Promise<AuthUser> {
		const existing = await this.findByProviderAccount(
			profile.provider,
			profile.providerUserId,
		);
		const now = new Date();

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
			this.usersById.set(updated.id, updated);
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

		this.usersById.set(created.id, created);
		this.userIdsByProviderAccount.set(
			this.providerKey("google", profile.providerUserId),
			created.id,
		);

		return created;
	}

	async updateRole(id: string, role: UserRole): Promise<AuthUser | null> {
		const user = this.usersById.get(id);
		if (!user) {
			return null;
		}

		const updated: AuthUser = {
			...user,
			role,
			updatedAt: new Date(),
		};
		this.usersById.set(id, updated);
		return updated;
	}

	async updateCredits(
		id: string,
		credits: CreditBalances,
	): Promise<AuthUser | null> {
		const user = this.usersById.get(id);
		if (!user) {
			return null;
		}

		const updated: AuthUser = {
			...user,
			credits: {...credits},
			updatedAt: new Date(),
		};
		this.usersById.set(id, updated);
		return updated;
	}

	private providerKey(provider: AuthProvider, providerUserId: string): string {
		return `${provider}:${providerUserId}`;
	}
}
