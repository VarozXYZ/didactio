import {describe, expect, it} from "vitest";
import {
	repairLearningActivityFeedbackJsonText,
	repairLearningActivityJsonText,
} from "../src/ai/service.js";

describe("learning activity JSON repair", () => {
	it("extracts the valid activity object after provider reasoning text", () => {
		const repaired = repairLearningActivityJsonText(`
{"kind": "text", "language": "plaintext"}. No need for other fields.

Remember to output only JSON.<｜end▁of▁thinking｜>{
  "title": "Comprension de opciones del tsconfig.json",
  "instructions": "Responde la siguiente pregunta.",
  "dedupeSummary": "Respuesta corta sobre noUnusedLocals.",
  "content": {
    "prompts": [
      {
        "id": 1,
        "prompt": "Describe noUnusedLocals.",
        "expectedAnswer": "Reporta variables locales no utilizadas.",
        "rubric": ["Menciona variables no usadas"],
        "responseFormat": {
          "kind": "text",
          "language": "plaintext"
        }
      }
    ]
  }
}.`);

		expect(repaired).not.toBeNull();
		expect(JSON.parse(repaired ?? "{}")).toMatchObject({
			title: "Comprension de opciones del tsconfig.json",
			content: {
				prompts: [
					{
						prompt: "Describe noUnusedLocals.",
					},
				],
			},
		});
	});

	it("extracts valid activity feedback after provider reasoning text", () => {
		const repaired = repairLearningActivityFeedbackJsonText(`
I will grade each answer briefly.<｜end▁of▁thinking｜>{
  "score": 70,
  "feedback": "Good overall attempt.",
  "strengths": ["Clear ideas"],
  "improvements": ["Add one concrete example"],
  "questionFeedback": [
    {
      "id": "p1",
      "simplifiedScore": "Almost there",
      "feedback": "The answer is partly correct.",
      "expectedAnswer": "<p><strong>Expected:</strong> explain the concept with one concrete example.</p>",
      "improvementReason": "<p>Add a specific example and connect it to the module.</p>",
      "strengths": ["Names the concept"],
      "improvements": ["Add an example"]
    }
  ]
}.`);

		expect(repaired).not.toBeNull();
		expect(JSON.parse(repaired ?? "{}")).toMatchObject({
			score: 70,
			questionFeedback: [
				{
					id: "p1",
					simplifiedScore: "Almost there",
				},
			],
		});
	});
});
