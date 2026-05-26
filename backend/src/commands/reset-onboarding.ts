import {getAppEnv, loadEnv} from "../config/env.js";
import {connectMongo} from "../mongo/mongo-connection.js";
import {resetUserOnboarding} from "../auth/reset-onboarding.js";

const email = process.argv[2];
if (!email) {
	throw new Error("Usage: npm run reset:onboarding -- <email>");
}

loadEnv();
const connection = await connectMongo(getAppEnv());

try {
	const result = await resetUserOnboarding(connection.database, email);
	if (result.modified) {
		console.log(`Onboarding reset for ${email}`);
	} else if (result.found) {
		console.log(`Onboarding was already reset for ${email}`);
	} else {
		console.log(`No user found with email ${email}`);
	}
} finally {
	await connection.client.close();
}
