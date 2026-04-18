import type {
	CreditTransaction,
	CreditTransactionStore,
} from "../../core/types.js";

export class InMemoryCreditTransactionStore implements CreditTransactionStore {
	private readonly transactions = new Map<string, CreditTransaction[]>();

	async create(transaction: CreditTransaction): Promise<void> {
		const transactions = this.transactions.get(transaction.userId) ?? [];
		transactions.unshift(transaction);
		this.transactions.set(transaction.userId, transactions);
	}

	async listByUserId(userId: string): Promise<CreditTransaction[]> {
		return [...(this.transactions.get(userId) ?? [])];
	}
}
