import {MongoClient} from "mongodb";

const email = process.argv[2];
if (!email) {
	console.error("Usage: node scripts/reset-onboarding.mjs <email>");
	process.exit(1);
}

const client = await MongoClient.connect("mongodb://127.0.0.1:27017");
const result = await client
	.db("didactio")
	.collection("users")
	.updateOne({email}, {$unset: {onboardingCompletedAt: ""}});

if (result.modifiedCount > 0) {
	console.log(`✓ Onboarding reset for ${email}`);
} else {
	console.log(`No user found with email ${email}`);
}

await client.close();
