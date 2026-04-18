import type {Db, Document} from "mongodb";
import type {DidacticUnit} from "./create-didactic-unit.js";
import type {DidacticUnitStore} from "./didactic-unit-store.js";

type DidacticUnitDocument = DidacticUnit & Document;

function stripMongoId(
	document: DidacticUnitDocument | null,
): DidacticUnit | null {
	if (!document) {
		return null;
	}

	const {_id: _ignored, ...didacticUnit} = document;
	return didacticUnit as DidacticUnit;
}

export class MongoDidacticUnitStore implements DidacticUnitStore {
	private readonly collection;

	constructor(database: Db) {
		this.collection =
			database.collection<DidacticUnitDocument>("didacticUnits");
	}

	async save(didacticUnit: DidacticUnit): Promise<void> {
		await this.collection.updateOne(
			{id: didacticUnit.id},
			{
				$set: didacticUnit,
			},
			{upsert: true},
		);
	}

	async getById(
		ownerId: string,
		didacticUnitId: string,
	): Promise<DidacticUnit | null> {
		return stripMongoId(
			await this.collection.findOne({
				id: didacticUnitId,
				ownerId,
			}),
		);
	}

	async listByOwner(ownerId: string): Promise<DidacticUnit[]> {
		const documents = await this.collection
			.find({ownerId})
			.sort({updatedAt: -1})
			.toArray();

		return documents
			.map((document) => stripMongoId(document))
			.filter((document): document is DidacticUnit => document !== null);
	}

	async deleteById(
		ownerId: string,
		didacticUnitId: string,
	): Promise<boolean> {
		const result = await this.collection.deleteOne({
			id: didacticUnitId,
			ownerId,
		});
		return result.deletedCount === 1;
	}
}
