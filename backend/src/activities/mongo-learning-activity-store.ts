import type {Db, Document} from "mongodb";
import type {
	LearningActivity,
	LearningActivityAttempt,
	LearningActivityProgress,
} from "./learning-activity.js";
import {
	isLearningActivityArchived,
	isLearningActivityVisibleInModule,
	sortLearningActivitiesForModule,
} from "./learning-activity.js";
import type {LearningActivityStore} from "./learning-activity-store.js";

type LearningActivityDocument = LearningActivity & Document;
type LearningActivityAttemptDocument = LearningActivityAttempt & Document;
type LearningActivityProgressDocument = LearningActivityProgress & Document;

function stripMongoId<T extends Document>(document: (T & Document) | null): T | null {
	if (!document) {
		return null;
	}

	const {_id: _ignored, ...value} = document;
	return value as T;
}

export class MongoLearningActivityStore implements LearningActivityStore {
	private readonly activities;
	private readonly attempts;
	private readonly progress;

	constructor(database: Db) {
		this.activities =
			database.collection<LearningActivityDocument>("learningActivities");
		this.attempts =
			database.collection<LearningActivityAttemptDocument>(
				"learningActivityAttempts",
			);
		this.progress =
			database.collection<LearningActivityProgressDocument>(
				"learningActivityProgress",
			);

		void this.activities.createIndex({
			ownerId: 1,
			didacticUnitId: 1,
			chapterIndex: 1,
			createdAt: 1,
		});
		void this.activities.createIndex({
			ownerId: 1,
			didacticUnitId: 1,
			type: 1,
			"content.visibleModuleIndexes": 1,
		});
		void this.attempts.createIndex({
			ownerId: 1,
			activityId: 1,
			completedAt: 1,
		});
		void this.progress.createIndex({ownerId: 1, activityId: 1}, {unique: true});
	}

	async saveActivity(activity: LearningActivity): Promise<void> {
		await this.activities.updateOne(
			{id: activity.id},
			{$set: activity},
			{upsert: true},
		);
	}

	async getActivity(
		ownerId: string,
		activityId: string,
	): Promise<LearningActivity | null> {
		return stripMongoId<LearningActivity>(
			await this.activities.findOne({id: activityId, ownerId}),
		);
	}

	async listByModule(input: {
		ownerId: string;
		didacticUnitId: string;
		chapterIndex: number;
	}): Promise<LearningActivity[]> {
		const documents = await this.activities
			.find({
				ownerId: input.ownerId,
				didacticUnitId: input.didacticUnitId,
			})
			.sort({createdAt: 1})
			.toArray();
		return sortLearningActivitiesForModule(documents
			.map((document) => stripMongoId<LearningActivity>(document))
			.filter(
				(activity): activity is LearningActivity =>
					activity !== null &&
					isLearningActivityVisibleInModule(activity, input.chapterIndex),
			));
	}

	async listByUnit(input: {
		ownerId: string;
		didacticUnitId: string;
	}): Promise<LearningActivity[]> {
		const documents = await this.activities
			.find({
				ownerId: input.ownerId,
				didacticUnitId: input.didacticUnitId,
			})
			.sort({createdAt: 1})
			.toArray();
		return documents
			.map((document) => stripMongoId<LearningActivity>(document))
			.filter(
				(activity): activity is LearningActivity =>
					activity !== null && !isLearningActivityArchived(activity),
			);
	}

	async listByUnitRange(input: {
		ownerId: string;
		didacticUnitId: string;
		maxChapterIndex: number;
	}): Promise<LearningActivity[]> {
		const documents = await this.activities
			.find({
				ownerId: input.ownerId,
				didacticUnitId: input.didacticUnitId,
				chapterIndex: {$lte: input.maxChapterIndex},
			})
			.sort({createdAt: -1})
			.toArray();
		return documents
			.map((document) => stripMongoId<LearningActivity>(document))
			.filter(
				(activity): activity is LearningActivity =>
					activity !== null && !isLearningActivityArchived(activity),
			);
	}

	async saveAttempt(attempt: LearningActivityAttempt): Promise<void> {
		await this.attempts.updateOne(
			{id: attempt.id},
			{$set: attempt},
			{upsert: true},
		);
	}

	async listAttempts(
		ownerId: string,
		activityId: string,
	): Promise<LearningActivityAttempt[]> {
		const documents = await this.attempts
			.find({ownerId, activityId})
			.sort({completedAt: 1})
			.toArray();
		return documents
			.map((document) => stripMongoId<LearningActivityAttempt>(document))
			.filter((attempt): attempt is LearningActivityAttempt => attempt !== null);
	}

	async saveProgress(progress: LearningActivityProgress): Promise<void> {
		await this.progress.updateOne(
			{ownerId: progress.ownerId, activityId: progress.activityId},
			{$set: progress},
			{upsert: true},
		);
	}

	async getProgress(
		ownerId: string,
		activityId: string,
	): Promise<LearningActivityProgress | null> {
		return stripMongoId<LearningActivityProgress>(
			await this.progress.findOne({ownerId, activityId}),
		);
	}
}
