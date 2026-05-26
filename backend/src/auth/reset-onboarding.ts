import type {Db} from "mongodb";

export interface ResetOnboardingResult {
	found: boolean;
	modified: boolean;
}

export async function resetUserOnboarding(
	database: Db,
	email: string,
): Promise<ResetOnboardingResult> {
	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail) {
		throw new Error("An email address is required.");
	}

	const result = await database.collection("users").updateOne(
		{email: normalizedEmail},
		{$unset: {onboardingCompletedAt: ""}},
	);

	return {
		found: result.matchedCount > 0,
		modified: result.modifiedCount > 0,
	};
}
