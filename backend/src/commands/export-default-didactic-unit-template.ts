import path from "node:path";
import {getAppEnv, loadEnv} from "../config/env.js";
import {connectMongo} from "../mongo/mongo-connection.js";
import {exportDefaultDidacticUnitTemplate} from "../didactic-unit/export-default-didactic-unit-template.js";

const sourceUnitId = process.argv[2];
if (!sourceUnitId) {
	throw new Error("Usage: npm run export:default-unit -- <source-unit-id>");
}

loadEnv();
const connection = await connectMongo(getAppEnv());

try {
	const outputDirectory = path.resolve(
		process.cwd(),
		"src/didactic-unit/default-templates",
	);
	const outputPath = await exportDefaultDidacticUnitTemplate({
		database: connection.database,
		sourceUnitId,
		outputDirectory,
	});
	console.log(`Exported default didactic unit template to ${outputPath}`);
} finally {
	await connection.client.close();
}
