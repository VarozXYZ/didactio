import type {DidacticUnitNote} from "./didactic-unit-note.js";

export interface DidacticUnitNoteStore {
	save(note: DidacticUnitNote): Promise<void>;
	getById(ownerId: string, noteId: string): Promise<DidacticUnitNote | null>;
	listByUnit(ownerId: string, didacticUnitId: string): Promise<DidacticUnitNote[]>;
	deleteById(ownerId: string, noteId: string): Promise<boolean>;
	deleteByUnit(ownerId: string, didacticUnitId: string): Promise<void>;
}

export class InMemoryDidacticUnitNoteStore implements DidacticUnitNoteStore {
	private readonly notes = new Map<string, DidacticUnitNote>();

	async save(note: DidacticUnitNote): Promise<void> {
		this.notes.set(note.id, note);
	}

	async getById(ownerId: string, noteId: string): Promise<DidacticUnitNote | null> {
		const note = this.notes.get(noteId);
		return note && note.ownerId === ownerId ? note : null;
	}

	async listByUnit(ownerId: string, didacticUnitId: string): Promise<DidacticUnitNote[]> {
		return [...this.notes.values()]
			.filter((note) => note.ownerId === ownerId && note.didacticUnitId === didacticUnitId)
			.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
	}

	async deleteById(ownerId: string, noteId: string): Promise<boolean> {
		const note = this.notes.get(noteId);
		if (!note || note.ownerId !== ownerId) {
			return false;
		}
		return this.notes.delete(noteId);
	}

	async deleteByUnit(ownerId: string, didacticUnitId: string): Promise<void> {
		for (const note of this.notes.values()) {
			if (note.ownerId === ownerId && note.didacticUnitId === didacticUnitId) {
				this.notes.delete(note.id);
			}
		}
	}
}
