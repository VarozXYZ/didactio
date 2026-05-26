import path from "node:path";
import {mkdir, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import dotenv from "dotenv";
import {MongoClient} from "mongodb";

dotenv.config();

const sourceUnitId = process.argv[2];
if (!sourceUnitId) {
	throw new Error(
		"Usage: node scripts/export-default-didactic-unit-template.mjs <source-unit-id>",
	);
}

const mongoUri = process.env.MONGODB_URI?.trim();
const mongoDatabaseName = process.env.MONGODB_DB_NAME?.trim() || "didactio";
if (!mongoUri) {
	throw new Error("MONGODB_URI is required to export a default didactic unit.");
}

const client = new MongoClient(mongoUri);
await client.connect();

try {
	const source = await client
		.db(mongoDatabaseName)
		.collection("didacticUnits")
		.findOne({id: sourceUnitId});
	if (!source) {
		throw new Error(`Didactic unit "${sourceUnitId}" was not found.`);
	}

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
	} = source;

	const directory = fileURLToPath(
		new URL("../src/didactic-unit/default-templates/", import.meta.url),
	);
	const outputPath = path.join(directory, `${sourceUnitId}.json`);
	await mkdir(directory, {recursive: true});
	await writeFile(outputPath, `${JSON.stringify(template, null, "\t")}\n`, "utf8");
	console.log(`Exported default didactic unit template to ${outputPath}`);
} finally {
	await client.close();
}
