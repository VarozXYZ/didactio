import type {Db, Document} from "mongodb";
import type {
	CreditTransaction,
	CreditTransactionStore,
} from "./core/types.js";

type CreditTransactionDocument = CreditTransaction & Document;

function stripMongoId(
	document: CreditTransactionDocument | null,
): CreditTransaction | null {
	if (!document) {
		return null;
	}

	const {_id: _ignored, ...transaction} = document;
	return transaction as CreditTransaction;
}

export class MongoCreditTransactionStore implements CreditTransactionStore {
	private readonly collection;

	constructor(database: Db) {
		this.collection =
			database.collection<CreditTransactionDocument>("creditTransactions");
		void this.collection.createIndex({userId: 1, createdAt: -1});
	}

	async create(transaction: CreditTransaction): Promise<void> {
		await this.collection.insertOne(transaction);
	}

	async listByUserId(userId: string): Promise<CreditTransaction[]> {
		const documents = await this.collection
			.find({userId})
			.sort({createdAt: -1})
			.toArray();
		return documents
			.map((document) => stripMongoId(document))
			.filter(
				(document): document is CreditTransaction => document !== null,
			);
	}
}
