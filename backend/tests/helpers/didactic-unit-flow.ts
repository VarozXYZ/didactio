import request from "supertest";
import {expect} from "vitest";
import type {DidacticUnitProvider} from "../../src/didactic-unit/planning.js";
import {createTestApp} from "./create-test-app.js";

type TestApp = ReturnType<typeof createTestApp>;

function parseStreamComplete<T>(body: string): T {
	const completeLine = body
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => JSON.parse(line) as {type: string; data?: unknown})
		.find((event) => event.type === "complete");

	if (!completeLine) {
		throw new Error("Stream did not include a complete event.");
	}

	return completeLine.data as T;
}

export async function createDidacticUnit(
	app: TestApp,
	input: {
		topic?: string;
		provider?: DidacticUnitProvider;
	} = {},
) {
	const response = await request(app)
		.post("/api/didactic-unit")
		.send({
			topic: input.topic ?? "next.js framework",
			provider: input.provider,
		});

	expect(response.status).toBe(201);
	return response.body as {
		id: string;
		topic: string;
		provider: DidacticUnitProvider;
	};
}

export async function advanceToQuestionnaireAnswered(
	app: TestApp,
	didacticUnitId: string,
) {
	const moderationResponse = await request(app)
		.post(`/api/didactic-unit/${didacticUnitId}/moderate`)
		.send({tier: "cheap"});

	expect(moderationResponse.status).toBe(200);

	const questionnaireResponse = await request(app)
		.post(`/api/didactic-unit/${didacticUnitId}/questionnaire/generate`)
		.send({tier: "cheap"});

	expect(questionnaireResponse.status).toBe(200);

	const answers = questionnaireResponse.body.questionnaire.questions.map(
		(question: {id: string}) => ({
			questionId: question.id,
			value: `answer-for-${question.id}`,
		}),
	);

	const answeredResponse = await request(app)
		.patch(`/api/didactic-unit/${didacticUnitId}/questionnaire/answers`)
		.send({answers});

	expect(answeredResponse.status).toBe(200);
	return answeredResponse.body as {id: string};
}

export async function createSyllabusReadyDidacticUnit(app: TestApp) {
	const created = await createDidacticUnit(app);

	await advanceToQuestionnaireAnswered(app, created.id);

	const syllabusResponse = await request(app)
		.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
		.send({quality: "silver"});

	expect(syllabusResponse.status).toBe(200);

	return parseStreamComplete<{
		id: string;
		syllabus: {chapters: unknown[]};
	}>(syllabusResponse.text);
}

export async function createSyllabusReadyDidacticUnitWithProvider(
	app: TestApp,
	input: {
		topic?: string;
		provider?: DidacticUnitProvider;
	} = {},
) {
	const created = await createDidacticUnit(app, input);

	await advanceToQuestionnaireAnswered(app, created.id);

	const syllabusResponse = await request(app)
		.post(`/api/didactic-unit/${created.id}/syllabus/generate/stream`)
		.send({quality: "silver"});

	expect(syllabusResponse.status).toBe(200);

	return parseStreamComplete<{
		id: string;
		provider: DidacticUnitProvider;
		syllabus: {chapters: unknown[]};
	}>(syllabusResponse.text);
}

export async function createApprovedDidacticUnit(
	app: TestApp,
	input: {
		topic?: string;
		provider?: DidacticUnitProvider;
	} = {},
) {
	const syllabusReady = await createSyllabusReadyDidacticUnitWithProvider(
		app,
		input,
	);

	const approvedResponse = await request(app)
		.post(`/api/didactic-unit/${syllabusReady.id}/approve-syllabus`)
		.send({quality: "silver"});

	expect(approvedResponse.status).toBe(200);

	return approvedResponse.body as {id: string};
}

export async function generateDidacticUnitChapter(
	app: TestApp,
	didacticUnitId: string,
	chapterIndex = 0,
) {
	const response = await request(app)
		.post(
			`/api/didactic-unit/${didacticUnitId}/chapters/${chapterIndex}/generate`,
		)
		.send({});

	expect(response.status).toBe(200);

	return response.body as {
		id: string;
		generatedChapters?: Array<{chapterIndex: number; content: string}>;
	};
}
