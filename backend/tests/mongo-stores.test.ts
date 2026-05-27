import {describe, expect, it, vi} from "vitest";
import {MongoCreditTransactionStore} from "../src/auth/mongo-credit-transaction-store.js";
import {MongoSessionStore} from "../src/auth/mongo-session-store.js";
import {MongoUserStore} from "../src/auth/mongo-user-store.js";
import {MongoDidacticUnitNoteStore} from "../src/didactic-unit/notes/mongo-note-store.js";
import {MongoFolderStore} from "../src/folders/mongo-folder-store.js";
import {MongoLearningActivityStore} from "../src/learning-activities/mongo-learning-activity-store.js";
import type {LearningActivity} from "../src/learning-activities/learning-activity.js";
import {SYSTEM_DEFAULT_THEME} from "../src/presentation-theme/types.js";

function query(documents: unknown[] = []) {
	return {
		sort: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		toArray: vi.fn().mockResolvedValue(documents),
		next: vi.fn().mockResolvedValue(documents[0] ?? null),
	};
}

function collection(documents: unknown[] = []) {
	return {
		createIndex: vi.fn().mockResolvedValue(undefined),
		insertOne: vi.fn().mockResolvedValue(undefined),
		updateOne: vi.fn().mockResolvedValue(undefined),
		updateMany: vi.fn().mockResolvedValue(undefined),
		deleteOne: vi.fn().mockResolvedValue({deletedCount: 1}),
		deleteMany: vi.fn().mockResolvedValue(undefined),
		findOne: vi.fn().mockResolvedValue(documents[0] ?? null),
		findOneAndUpdate: vi.fn().mockResolvedValue(documents[0] ?? null),
		find: vi.fn().mockImplementation(() => query(documents)),
	};
}

function database(stores: Record<string, ReturnType<typeof collection>>) {
	return {
		collection: vi.fn((name: string) => stores[name]),
	} as never;
}

const profile = {
	provider: "google" as const,
	providerUserId: "google-1",
	email: "user@example.com",
	emailVerified: true,
	displayName: "User",
	firstName: "Test",
	lastName: "User",
	pictureUrl: undefined,
	locale: "en",
};

function existingUser() {
	return {
		_id: "mongo",
		id: "user",
		...profile,
		role: "user" as const,
		status: "active" as const,
		credits: {bronze: 2, silver: 1, gold: 0, dark: 0},
		createdAt: new Date("2026-01-01T00:00:00Z"),
		updatedAt: new Date("2026-01-01T00:00:00Z"),
		lastLoginAt: new Date("2026-01-01T00:00:00Z"),
	};
}

describe("Mongo auth stores", () => {
	it("looks up, lists, creates, and updates users", async () => {
		const users = collection([existingUser()]);
		const store = new MongoUserStore(database({users}));
		expect(await store.findByProviderAccount("google", "google-1")).toMatchObject({id: "user"});
		expect(await store.findById("user")).toMatchObject({id: "user"});
		expect(await store.findByStripeCustomerId("cus")).toMatchObject({id: "user"});
		expect(await store.list()).toHaveLength(1);
		expect(await store.upsertFromGoogleProfile(profile, "admin")).toMatchObject({role: "admin", defaultPresentationTheme: SYSTEM_DEFAULT_THEME});

		users.findOne.mockResolvedValueOnce(null);
		expect(await store.upsertFromGoogleProfile({...profile, providerUserId: "new"}, "user")).toMatchObject({
			providerUserId: "new",
			credits: {bronze: 0, silver: 0, gold: 0, dark: 0},
		});
		await store.updateRole("user", "admin");
		await store.updateCredits("user", {bronze: 4, silver: 3, gold: 2, dark: 1});
		await store.grantLaunchCredits("user", {bronze: 1, silver: 1, gold: 1, dark: 1}, new Date());
		await store.updateDefaultPresentationTheme("user", SYSTEM_DEFAULT_THEME);
		await store.updateBillingProfile("user", {stripeCustomerId: "cus"});
		await store.updateDisplayName("user", "Changed");
		await store.completeOnboarding("user", new Date());
		await store.markDefaultDidacticUnitTemplateProvisioned("user", "template", new Date());
		await store.applyCreditDelta({id: "user", coinType: "silver", delta: -1, requireSufficientBalance: true});
		expect(users.findOneAndUpdate).toHaveBeenCalled();
		expect(users.updateOne).toHaveBeenCalled();
	});

	it("creates, rotates, revokes, and finds sessions and transactions", async () => {
		const sessionDoc = {
			_id: "mongo",
			id: "session",
			userId: "user",
			refreshTokenHash: "old",
			previousRefreshTokenHashes: [],
			expiresAt: new Date("2026-06-01T00:00:00Z"),
			createdAt: new Date(),
			updatedAt: new Date(),
		};
		const sessions = collection([sessionDoc]);
		const sessionStore = new MongoSessionStore(database({authSessions: sessions}));
		await sessionStore.createSession({id: "new", userId: "user", refreshTokenHash: "hash", expiresAt: new Date()});
		expect(await sessionStore.findByRefreshTokenHash("old")).toMatchObject({id: "session"});
		expect(await sessionStore.rotateSession("session", "new", new Date())).toMatchObject({id: "session"});
		await sessionStore.revokeSession("session");
		await sessionStore.revokeAllForUser("user");
		sessions.findOne.mockResolvedValueOnce({...sessionDoc, revokedAt: new Date()});
		expect(await sessionStore.rotateSession("session", "new", new Date())).toBeNull();

		const tx = {_id: "mongo", id: "tx", userId: "user", createdAt: new Date(), amount: 1};
		const transactions = collection([tx]);
		const txStore = new MongoCreditTransactionStore(database({creditTransactions: transactions}));
		await txStore.create(tx as never);
		expect(await txStore.listByUserId("user")).toEqual([{id: "tx", userId: "user", createdAt: tx.createdAt, amount: 1}]);
	});
});

describe("Mongo product stores", () => {
	it("persists and mutates folders and notes", async () => {
		const folder = {_id: "mongo", id: "folder", ownerId: "user", name: "Notes", slug: "notes", kind: "custom", icon: "book", color: "#123456", createdAt: "now", updatedAt: "now"};
		const folders = collection([folder]);
		const folderStore = new MongoFolderStore(database({folders}));
		expect(await folderStore.listByOwner("user")).toHaveLength(1);
		expect(await folderStore.getById("user", "folder")).toMatchObject({name: "Notes"});
		expect(await folderStore.getBySlug("user", "notes")).toMatchObject({id: "folder"});
		expect(await folderStore.create({ownerId: "user", name: "New", slug: "new", kind: "custom", icon: "book", color: "#123456"})).toMatchObject({slug: "new"});
		await folderStore.updateById("user", "folder", {name: "Changed", icon: "tag", color: "#abcdef"});
		expect(await folderStore.deleteById("user", "folder")).toBe(true);

		const note = {_id: "mongo", id: "note", ownerId: "user", didacticUnitId: "unit", chapterIndex: 0};
		const notes = collection([note]);
		const noteStore = new MongoDidacticUnitNoteStore(database({didacticUnitNotes: notes}));
		await noteStore.save(note as never);
		expect(await noteStore.getById("user", "note")).toMatchObject({id: "note"});
		expect(await noteStore.listByUnit("user", "unit")).toHaveLength(1);
		expect(await noteStore.deleteById("user", "note")).toBe(true);
		await noteStore.deleteByUnit("user", "unit");
	});

	it("persists learning activities, attempts, and progress", async () => {
		const base: LearningActivity = {
			id: "activity",
			ownerId: "user",
			didacticUnitId: "unit",
			chapterIndex: 0,
			scope: "current_module",
			type: "multiple_choice",
			quality: "silver",
			title: "Quiz",
			instructions: "Answer",
			content: {},
			dedupeSummary: "quiz",
			sourceModuleIndexes: [0],
			feedbackAttemptLimit: 3,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		};
		const activityDocuments = [{...base, _id: "mongo"}];
		const activities = collection(activityDocuments);
		const attempts = collection([{_id: "mongo", id: "attempt", ownerId: "user", activityId: "activity", completedAt: "now"}]);
		const progress = collection([{_id: "mongo", ownerId: "user", activityId: "activity", completed: true}]);
		const store = new MongoLearningActivityStore(database({learningActivities: activities, learningActivityAttempts: attempts, learningActivityProgress: progress}));
		await store.saveActivity(base);
		expect(await store.getActivity("user", "activity")).toMatchObject({id: "activity"});
		expect(await store.listByModule({ownerId: "user", didacticUnitId: "unit", chapterIndex: 0})).toHaveLength(1);
		expect(await store.listByUnit({ownerId: "user", didacticUnitId: "unit"})).toHaveLength(1);
		expect(await store.listByUnitRange({ownerId: "user", didacticUnitId: "unit", maxChapterIndex: 0})).toHaveLength(1);
		await store.saveAttempt({id: "attempt", ownerId: "user", activityId: "activity", answers: {}, feedback: "ok", completedAt: "now"});
		expect(await store.listAttempts("user", "activity")).toHaveLength(1);
		await store.saveProgress({ownerId: "user", activityId: "activity", confirmedAnswers: {}, completed: true, updatedAt: "now"});
		expect(await store.getProgress("user", "activity")).toMatchObject({completed: true});
		expect(await store.deleteActivity("user", "activity")).toBe(true);
		activities.deleteOne.mockResolvedValueOnce({deletedCount: 0});
		expect(await store.deleteActivity("user", "missing")).toBe(false);
	});
});
