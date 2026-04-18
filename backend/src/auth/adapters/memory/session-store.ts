import type {SessionRecord, SessionStore} from "../../core/types.js";

export class InMemorySessionStore implements SessionStore {
	private readonly sessions = new Map<string, SessionRecord>();

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

		this.sessions.set(session.id, session);
		return session;
	}

	async findByRefreshTokenHash(
		refreshTokenHash: string,
	): Promise<SessionRecord | null> {
		for (const session of this.sessions.values()) {
			if (
				session.refreshTokenHash === refreshTokenHash ||
				session.previousRefreshTokenHashes.includes(refreshTokenHash)
			) {
				return session;
			}
		}

		return null;
	}

	async rotateSession(
		sessionId: string,
		nextRefreshTokenHash: string,
		nextExpiresAt: Date,
	): Promise<SessionRecord | null> {
		const session = this.sessions.get(sessionId);
		if (!session || session.revokedAt) {
			return null;
		}

		session.previousRefreshTokenHashes = [
			session.refreshTokenHash,
			...session.previousRefreshTokenHashes,
		].slice(0, 5);
		session.refreshTokenHash = nextRefreshTokenHash;
		session.expiresAt = nextExpiresAt;
		session.updatedAt = new Date();
		this.sessions.set(session.id, session);

		return session;
	}

	async revokeSession(sessionId: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session || session.revokedAt) {
			return;
		}

		session.revokedAt = new Date();
		session.updatedAt = new Date();
		this.sessions.set(session.id, session);
	}

	async revokeAllForUser(userId: string): Promise<void> {
		for (const session of this.sessions.values()) {
			if (session.userId !== userId || session.revokedAt) {
				continue;
			}

			session.revokedAt = new Date();
			session.updatedAt = new Date();
			this.sessions.set(session.id, session);
		}
	}
}
