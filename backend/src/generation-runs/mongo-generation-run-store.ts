import type {Db, Document} from "mongodb";
import type {
	ChapterGenerationRunRecord,
	GenerationRun,
	GenerationRunStore,
} from "./generation-run-store.js";

type GenerationRunDocument = GenerationRun & Document;

function stripMongoId(
	document: GenerationRunDocument | null,
): GenerationRun | null {
	if (!document) {
		return null;
	}

	const {_id: _ignored, ...run} = document;
	return run as GenerationRun;
}

export class MongoGenerationRunStore implements GenerationRunStore {
	private readonly collection;

	constructor(database: Db) {
		this.collection =
			database.collection<GenerationRunDocument>("generationRuns");
	}

	async save(run: GenerationRun): Promise<void> {
		await this.collection.updateOne(
			{id: run.id},
			{
				$set: run,
			},
			{upsert: true},
		);
	}

	async getById(ownerId: string, id: string): Promise<GenerationRun | null> {
		return stripMongoId(await this.collection.findOne({id, ownerId}));
	}

	async listByOwner(ownerId: string): Promise<GenerationRun[]> {
		const documents = await this.collection
			.find({ownerId})
			.sort({createdAt: -1})
			.toArray();

		return documents
			.map((document) => stripMongoId(document))
			.filter((document): document is GenerationRun => document !== null);
	}

	async findActiveChapterRun(
		ownerId: string,
		didacticUnitId: string,
		chapterIndex: number,
	): Promise<ChapterGenerationRunRecord | null> {
		const document = await this.collection
			.find({
				ownerId,
				didacticUnitId,
				stage: "chapter",
				chapterIndex,
				status: {
					$in: ["payment_pending", "queued", "running", "retrying"],
				},
			})
			.sort({createdAt: -1})
			.limit(1)
			.next();
		const run = stripMongoId(document);
		return run?.stage === "chapter" ? run : null;
	}

	async listByDidacticUnit(
		ownerId: string,
		didacticUnitId: string,
	): Promise<GenerationRun[]> {
		const documents = await this.collection
			.find({
				ownerId,
				didacticUnitId,
			})
			.sort({createdAt: -1})
			.toArray();

		return documents
			.map((document) => stripMongoId(document))
			.filter((document): document is GenerationRun => document !== null);
	}
}
