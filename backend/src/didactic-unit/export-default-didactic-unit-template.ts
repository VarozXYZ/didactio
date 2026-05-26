import path from "node:path";
import {mkdir, writeFile} from "node:fs/promises";
import type {Db} from "mongodb";
import type {DidacticUnit} from "./create-didactic-unit.js";
import type {GenerationRun} from "../generation-runs/generation-run-store.js";

export type DefaultDidacticUnitTemplate = Omit<
	DidacticUnit,
	| "ownerId"
	| "folderId"
	| "createdAt"
	| "updatedAt"
	| "moduleReadProgress"
	| "completedChapters"
	| "unitGenerationPaidAt"
	| "unitGenerationCreditTransactionId"
>;

export function resolveTemplateModelAttribution(
	runs: GenerationRun[],
): DidacticUnit["modelAttribution"] {
	const completedRuns = runs
		.filter(
			(run) =>
				run.status === "completed" &&
				(run.stage === "chapter" || run.stage === "syllabus"),
		)
		.sort((left, right) => {
			const leftTime = left.updatedAt ?? left.createdAt;
			const rightTime = right.updatedAt ?? right.createdAt;
			return rightTime.localeCompare(leftTime);
		});
	const selected =
		completedRuns.find((run) => run.stage === "chapter") ??
		completedRuns[0];

	return selected ?
			{provider: selected.provider, model: selected.model}
		:	undefined;
}

export function createDefaultDidacticUnitTemplate(
	source: DidacticUnit,
	runs: GenerationRun[],
): DefaultDidacticUnitTemplate {
	const {
		_id: _mongoId,
		ownerId: _ownerId,
		folderId: _folderId,
		defaultTemplateId: _defaultTemplateId,
		defaultTemplateSourceId: _defaultTemplateSourceId,
		moduleReadProgress: _moduleReadProgress,
		completedChapters: _completedChapters,
		unitGenerationPaidAt: _unitGenerationPaidAt,
		unitGenerationCreditTransactionId: _unitGenerationCreditTransactionId,
		createdAt: _createdAt,
		updatedAt: _updatedAt,
		...template
	} = structuredClone(source) as DidacticUnit & {_id?: unknown};
	const modelAttribution = resolveTemplateModelAttribution(runs);

	return {
		...template,
		...(modelAttribution ? {modelAttribution} : {}),
	};
}

export async function exportDefaultDidacticUnitTemplate(input: {
	database: Db;
	sourceUnitId: string;
	outputDirectory: string;
}): Promise<string> {
	const source = await input.database
		.collection<DidacticUnit>("didacticUnits")
		.findOne({id: input.sourceUnitId});
	if (!source) {
		throw new Error(`Didactic unit "${input.sourceUnitId}" was not found.`);
	}

	const runs = await input.database
		.collection<GenerationRun>("generationRuns")
		.find({didacticUnitId: input.sourceUnitId})
		.toArray();
	const template = createDefaultDidacticUnitTemplate(source, runs);
	const outputPath = path.join(input.outputDirectory, `${input.sourceUnitId}.json`);

	await mkdir(input.outputDirectory, {recursive: true});
	await writeFile(outputPath, `${JSON.stringify(template, null, "\t")}\n`, "utf8");
	return outputPath;
}
