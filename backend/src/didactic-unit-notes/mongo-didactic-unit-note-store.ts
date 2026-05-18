import type {Db, Document} from "mongodb";
import type {DidacticUnitNote} from "./didactic-unit-note.js";
import type {DidacticUnitNoteStore} from "./didactic-unit-note-store.js";

type DidacticUnitNoteDocument = DidacticUnitNote & Document;

function stripMongoId(document: DidacticUnitNoteDocument | null): DidacticUnitNote | null {
	if (!document) {
		return null;
	}
	const {_id: _ignored, ...note} = document;
	return note as DidacticUnitNote;
}

export class MongoDidacticUnitNoteStore implements DidacticUnitNoteStore {
	private readonly collection;

	constructor(database: Db) {
		this.collection = database.collection<DidacticUnitNoteDocument>("didacticUnitNotes");
		void this.collection.createIndex({ownerId: 1, didacticUnitId: 1, chapterIndex: 1});
	}

	async save(note: DidacticUnitNote): Promise<void> {
		await this.collection.updateOne({id: note.id}, {$set: note}, {upsert: true});
	}

	async getById(ownerId: string, noteId: string): Promise<DidacticUnitNote | null> {
		return stripMongoId(await this.collection.findOne({id: noteId, ownerId}));
	}

	async listByUnit(ownerId: string, didacticUnitId: string): Promise<DidacticUnitNote[]> {
		const documents = await this.collection
			.find({ownerId, didacticUnitId})
			.sort({createdAt: 1})
			.toArray();
		return documents
			.map((document) => stripMongoId(document))
			.filter((document): document is DidacticUnitNote => document !== null);
	}

	async deleteById(ownerId: string, noteId: string): Promise<boolean> {
		const result = await this.collection.deleteOne({id: noteId, ownerId});
		return result.deletedCount === 1;
	}

	async deleteByUnit(ownerId: string, didacticUnitId: string): Promise<void> {
		await this.collection.deleteMany({ownerId, didacticUnitId});
	}
}
