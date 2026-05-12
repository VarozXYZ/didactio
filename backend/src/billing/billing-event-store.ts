import type {Db, Document} from "mongodb";

export interface BillingEventRecord {
	id: string;
	type: string;
	createdAt: Date;
}

export interface BillingEventStore {
	hasProcessed(id: string): Promise<boolean>;
	markProcessed(record: BillingEventRecord): Promise<void>;
}

export class InMemoryBillingEventStore implements BillingEventStore {
	private readonly events = new Map<string, BillingEventRecord>();

	async hasProcessed(id: string): Promise<boolean> {
		return this.events.has(id);
	}

	async markProcessed(record: BillingEventRecord): Promise<void> {
		this.events.set(record.id, record);
	}
}

type BillingEventDocument = BillingEventRecord & Document;

export class MongoBillingEventStore implements BillingEventStore {
	private readonly collection;

	constructor(database: Db) {
		this.collection = database.collection<BillingEventDocument>("billingEvents");
		void this.collection.createIndex({id: 1}, {unique: true});
	}

	async hasProcessed(id: string): Promise<boolean> {
		return (await this.collection.countDocuments({id}, {limit: 1})) > 0;
	}

	async markProcessed(record: BillingEventRecord): Promise<void> {
		try {
			await this.collection.insertOne(record);
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === 11000
			) {
				return;
			}
			throw error;
		}
	}
}
