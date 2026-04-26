import request from "supertest";
import {describe, expect, it} from "vitest";
import {createTestApp} from "./helpers/create-test-app.js";
import {
	advanceToQuestionnaireAnswered,
	createDidacticUnit,
} from "./helpers/didactic-unit-flow.js";

describe("streaming generation routes", () => {
	it("streams syllabus generation as ndjson and ends with a complete didactic-unit payload", async () => {
		const app = createTestApp();
		const created = await createDidacticUnit(app);
		await advanceToQuestionnaireAnswered(app, created.id);

		const response = await request(app)
			.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
			.send({quality: "silver"});

		expect(response.status).toBe(200);
		expect(response.headers["content-type"]).toContain(
			"application/x-ndjson",
		);

		const lines = response.text
			.trim()
			.split("\n")
			.map(
				(line) =>
					JSON.parse(line) as {
						type: string;
						data?: {status?: string};
					},
			);

		expect(lines[0].type).toBe("start");
		expect(lines.some((line) => line.type === "partial_structured")).toBe(
			true,
		);
		expect(lines.at(-1)).toMatchObject({
			type: "complete",
			data: {
				status: "syllabus_ready",
			},
		});
	});
});
