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

export interface LearningActivityStore {
	saveActivity(activity: LearningActivity): Promise<void>;
	getActivity(ownerId: string, activityId: string): Promise<LearningActivity | null>;
	deleteActivity(ownerId: string, activityId: string): Promise<boolean>;
	listByModule(input: {
		ownerId: string;
		didacticUnitId: string;
		chapterIndex: number;
	}): Promise<LearningActivity[]>;
	listByUnit(input: {
		ownerId: string;
		didacticUnitId: string;
	}): Promise<LearningActivity[]>;
	listByUnitRange(input: {
		ownerId: string;
		didacticUnitId: string;
		maxChapterIndex: number;
	}): Promise<LearningActivity[]>;
	saveAttempt(attempt: LearningActivityAttempt): Promise<void>;
	listAttempts(ownerId: string, activityId: string): Promise<LearningActivityAttempt[]>;
	saveProgress(progress: LearningActivityProgress): Promise<void>;
	getProgress(ownerId: string, activityId: string): Promise<LearningActivityProgress | null>;
}

export class InMemoryLearningActivityStore implements LearningActivityStore {
	private readonly activitiesById = new Map<string, LearningActivity>();
	private readonly attemptsById = new Map<string, LearningActivityAttempt>();
	private readonly progressByActivityId = new Map<string, LearningActivityProgress>();

	async saveActivity(activity: LearningActivity): Promise<void> {
		this.activitiesById.set(activity.id, activity);
	}

	async getActivity(
		ownerId: string,
		activityId: string,
	): Promise<LearningActivity | null> {
		const activity = this.activitiesById.get(activityId);
		return activity?.ownerId === ownerId ? activity : null;
	}

	async deleteActivity(ownerId: string, activityId: string): Promise<boolean> {
		const activity = this.activitiesById.get(activityId);
		if (activity?.ownerId !== ownerId) {
			return false;
		}
		this.activitiesById.delete(activityId);
		for (const [attemptId, attempt] of this.attemptsById) {
			if (attempt.ownerId === ownerId && attempt.activityId === activityId) {
				this.attemptsById.delete(attemptId);
			}
		}
		const progress = this.progressByActivityId.get(activityId);
		if (progress?.ownerId === ownerId) {
			this.progressByActivityId.delete(activityId);
		}
		return true;
	}

	async listByModule(input: {
		ownerId: string;
		didacticUnitId: string;
		chapterIndex: number;
	}): Promise<LearningActivity[]> {
		return sortLearningActivitiesForModule(
			[...this.activitiesById.values()].filter(
				(activity) =>
					activity.ownerId === input.ownerId &&
					activity.didacticUnitId === input.didacticUnitId &&
					isLearningActivityVisibleInModule(activity, input.chapterIndex),
			),
			input.chapterIndex,
		);
	}

	async listByUnit(input: {
		ownerId: string;
		didacticUnitId: string;
	}): Promise<LearningActivity[]> {
		return [...this.activitiesById.values()]
			.filter(
				(activity) =>
					activity.ownerId === input.ownerId &&
					activity.didacticUnitId === input.didacticUnitId &&
					!isLearningActivityArchived(activity),
			)
			.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
	}

	async listByUnitRange(input: {
		ownerId: string;
		didacticUnitId: string;
		maxChapterIndex: number;
	}): Promise<LearningActivity[]> {
		return [...this.activitiesById.values()]
			.filter(
				(activity) =>
					activity.ownerId === input.ownerId &&
					activity.didacticUnitId === input.didacticUnitId &&
					activity.chapterIndex <= input.maxChapterIndex &&
					!isLearningActivityArchived(activity),
			)
			.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
	}

	async saveAttempt(attempt: LearningActivityAttempt): Promise<void> {
		this.attemptsById.set(attempt.id, attempt);
	}

	async listAttempts(
		ownerId: string,
		activityId: string,
	): Promise<LearningActivityAttempt[]> {
		return [...this.attemptsById.values()]
			.filter(
				(attempt) =>
					attempt.ownerId === ownerId && attempt.activityId === activityId,
			)
			.sort((left, right) => left.completedAt.localeCompare(right.completedAt));
	}

	async saveProgress(progress: LearningActivityProgress): Promise<void> {
		this.progressByActivityId.set(progress.activityId, progress);
	}

	async getProgress(
		ownerId: string,
		activityId: string,
	): Promise<LearningActivityProgress | null> {
		const progress = this.progressByActivityId.get(activityId);
		return progress?.ownerId === ownerId ? progress : null;
	}
}
