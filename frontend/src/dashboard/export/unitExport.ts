import type {
	BackendDidacticUnitChapterDetail,
	BackendDidacticUnitDetail,
	BackendLearningActivity,
} from "../api/dashboardApi";
import {dashboardApi} from "../api/dashboardApi";
import {normalizeStoredHtml} from "../utils/htmlContent";

export type ExportActivity = BackendLearningActivity;

export type ExportActivityAnswerKey = {
	activityId: string;
	title: string;
	html: string;
};

export type ExportModule = {
	chapterIndex: number;
	title: string;
	overview: string;
	html: string;
	state: BackendDidacticUnitChapterDetail["state"];
	activities: ExportActivity[];
};

export type UnitExportSnapshot = {
	unit: BackendDidacticUnitDetail;
	modules: ExportModule[];
	skippedModules: Array<{
		chapterIndex: number;
		title: string;
		state: BackendDidacticUnitChapterDetail["state"];
	}>;
	exportedAt: string;
};

function asArray(value: unknown): Record<string, unknown>[] {
	return Array.isArray(value) ?
			value.filter(
				(item): item is Record<string, unknown> =>
					!!item && typeof item === "object" && !Array.isArray(item),
			)
		:	[];
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ?
			value.filter((item): item is string => typeof item === "string")
		:	[];
}

function asText(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function escapeAttribute(value: unknown): string {
	return escapeHtml(value).replaceAll("`", "&#96;");
}

function slugify(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

export function sanitizeExportFilename(value: string): string {
	const slug = slugify(value) || "unidad";
	return `unidad-${slug}-actividades.html`;
}

export function downloadTextFile(filename: string, content: string): void {
	const blob = new Blob([content], {type: "text/html;charset=utf-8"});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

export async function buildUnitExportSnapshot(
	didacticUnitId: string,
): Promise<UnitExportSnapshot> {
	const [unit, chaptersResponse] = await Promise.all([
		dashboardApi.getDidacticUnit(didacticUnitId),
		dashboardApi.listDidacticUnitChapters(didacticUnitId),
	]);

	const chapterDetails = await Promise.all(
		chaptersResponse.chapters.map((chapter) =>
			dashboardApi.getDidacticUnitChapter(
				didacticUnitId,
				chapter.chapterIndex,
			),
		),
	);
	const generatedDetails = chapterDetails.filter(
		(detail) => detail.state === "ready" && normalizeStoredHtml(detail.html),
	);
	const activityEntries = await Promise.all(
		generatedDetails.map(async (detail) => {
			const {activities} = await dashboardApi.listLearningActivities(
				didacticUnitId,
				detail.chapterIndex,
			);
			return [detail.chapterIndex, activities] as const;
		}),
	);
	const activitiesByModule = new Map(activityEntries);

	return {
		unit,
		exportedAt: new Date().toISOString(),
		modules: generatedDetails.map((detail) => ({
			chapterIndex: detail.chapterIndex,
			title: detail.title,
			overview: detail.planningOverview,
			html: normalizeStoredHtml(detail.html),
			state: detail.state,
			activities: activitiesByModule.get(detail.chapterIndex) ?? [],
		})),
		skippedModules: chapterDetails
			.filter(
				(detail) =>
					detail.state !== "ready" || !normalizeStoredHtml(detail.html),
			)
			.map((detail) => ({
				chapterIndex: detail.chapterIndex,
				title: detail.title,
				state: detail.state,
			})),
	};
}

export function sanitizeStaticHtml(html: string): string {
	return html
		.replace(/<\s*(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
		.replace(/<\s*(script|style|iframe|object|embed|form)\b[^>]*\/?\s*>/gi, "")
		.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(/\s+(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi, "")
		.replace(/\s+(href|src)\s*=\s*javascript:[^\s>]+/gi, "");
}

function activityTypeLabel(type: ExportActivity["type"]): string {
	switch (type) {
		case "multiple_choice":
			return "Quick check";
		case "short_answer":
			return "Open response questions";
		case "coding_practice":
			return "Code practice";
		case "flashcards":
			return "Flashcards";
		case "matching":
			return "Matching";
		case "ordering":
			return "Ordering";
		case "case_study":
			return "Case study";
		case "debate_reflection":
			return "Debate reflection";
		case "cloze":
			return "Cloze";
		case "guided_project":
			return "Mini project";
		case "freeform_html":
			return "Interactive";
	}
}

const ACTIVITY_TYPE_ORDER: ExportActivity["type"][] = [
	"multiple_choice",
	"short_answer",
	"coding_practice",
	"flashcards",
	"matching",
	"ordering",
	"case_study",
	"debate_reflection",
	"cloze",
	"guided_project",
	"freeform_html",
];

function renderList(items: string[]): string {
	if (items.length === 0) return "";
	return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderTextarea(label = "Your answer"): string {
	return `<label class="answer-box"><span>${escapeHtml(label)}</span><textarea></textarea></label>`;
}

function renderMultipleChoice(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	const questions = asArray(activity.content.questions);
	return {
		body: questions
			.map((question, questionIndex) => {
				const id = asText(question.id) || `q${questionIndex + 1}`;
				const correct = asText(question.correctOptionId);
				const options = asArray(question.options);
				return `
					<section class="question" data-check-group="multiple-choice">
						<h4>${questionIndex + 1}. ${escapeHtml(question.prompt)}</h4>
						<div class="options">
							${options
								.map((option) => {
									const optionId = asText(option.id);
									return `
										<label class="option">
											<input name="${escapeAttribute(activity.id)}-${escapeAttribute(id)}" type="radio" data-correct="${escapeAttribute(correct)}" value="${escapeAttribute(optionId)}" />
											<span>${escapeHtml(option.text)}</span>
										</label>
									`;
								})
								.join("")}
						</div>
					</section>
				`;
			})
			.join(""),
		answer: questions
			.map((question, index) => {
				const correct = asText(question.correctOptionId);
				const options = asArray(question.options);
				const correctText =
					asText(
						options.find((option) => asText(option.id) === correct)?.text,
					) || correct;
				return `<p><strong>${index + 1}.</strong> ${escapeHtml(correctText)}${asText(question.explanation) ? ` - ${escapeHtml(question.explanation)}` : ""}</p>`;
			})
			.join(""),
	};
}

function renderFlashcards(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	const cards = asArray(activity.content.cards);
	return {
		body: `
			<div class="flashcards">
				${cards
					.map(
						(card) => `
							<button class="flashcard" type="button">
								<span class="flashcard-face flashcard-front">${escapeHtml(card.front)}</span>
								<span class="flashcard-face flashcard-back">${escapeHtml(card.back)}</span>
							</button>
						`,
					)
					.join("")}
			</div>
		`,
		answer: cards
			.map(
				(card, index) =>
					`<p><strong>${index + 1}. ${escapeHtml(card.front)}</strong><br />${escapeHtml(card.back)}</p>`,
			)
			.join(""),
	};
}

function renderMatching(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	const pairs = asArray(activity.content.pairs);
	return {
		body: pairs
			.map(
				(pair, index) => `
					<label class="inline-answer">
						<span>${index + 1}. ${escapeHtml(pair.left)}</span>
						<input type="text" data-answer="${escapeAttribute(pair.right)}" />
					</label>
				`,
			)
			.join(""),
		answer: pairs
			.map(
				(pair, index) =>
					`<p><strong>${index + 1}.</strong> ${escapeHtml(pair.left)} -> ${escapeHtml(pair.right)}</p>`,
			)
			.join(""),
	};
}

function renderOrdering(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	const items = asArray(activity.content.items);
	const ordered = [...items].sort(
		(left, right) =>
			Number(left.correctOrder ?? 0) - Number(right.correctOrder ?? 0),
	);
	return {
		body: items
			.map(
				(item) => `
					<label class="inline-answer">
						<input class="order-input" type="number" min="1" max="${items.length}" data-answer="${escapeAttribute(item.correctOrder)}" />
						<span>${escapeHtml(item.text)}</span>
					</label>
				`,
			)
			.join(""),
		answer: ordered
			.map(
				(item, index) =>
					`<p><strong>${index + 1}.</strong> ${escapeHtml(item.text)}</p>`,
			)
			.join(""),
	};
}

function renderCloze(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	const blanks = asArray(activity.content.blanks);
	return {
		body: `
			<p class="cloze-text">${escapeHtml(activity.content.textWithBlanks)}</p>
			<div class="inline-answer-grid">
				${blanks
					.map(
						(blank) => `
							<label class="inline-answer">
								<span>${escapeHtml(blank.id)}${asText(blank.hint) ? `: ${escapeHtml(blank.hint)}` : ""}</span>
								<input type="text" data-answer="${escapeAttribute(blank.answer)}" />
							</label>
						`,
					)
					.join("")}
			</div>
		`,
		answer: blanks
			.map(
				(blank) =>
					`<p><strong>${escapeHtml(blank.id)}:</strong> ${escapeHtml(blank.answer)}</p>`,
			)
			.join(""),
	};
}

function renderShortAnswer(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	const prompts = asArray(activity.content.prompts);
	return {
		body: prompts
			.map(
				(prompt, index) => `
					<section class="question">
						<h4>${index + 1}. ${escapeHtml(prompt.prompt)}</h4>
						${renderTextarea()}
					</section>
				`,
			)
			.join(""),
		answer: prompts
			.map(
				(prompt, index) => `
					<section class="answer-key-item">
						<h4>${index + 1}. ${escapeHtml(prompt.prompt)}</h4>
						<p>${escapeHtml(prompt.expectedAnswer)}</p>
						${renderList(asStringArray(prompt.rubric))}
					</section>
				`,
			)
			.join(""),
	};
}

function renderCodingPractice(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	const testCases = asArray(activity.content.testCases);
	return {
		body: `
			<p>${escapeHtml(activity.content.prompt)}</p>
			${asText(activity.content.starterCode) ? `<pre><code>${escapeHtml(activity.content.starterCode)}</code></pre>` : ""}
			${renderTextarea("Your code or explanation")}
		`,
		answer: `
			${asText(activity.content.expectedOutcome) ? `<p><strong>Expected outcome:</strong> ${escapeHtml(activity.content.expectedOutcome)}</p>` : ""}
			${testCases.length > 0 ? `<h4>Test cases</h4>${renderList(testCases.map((testCase) => `${JSON.stringify(testCase.input)} -> ${JSON.stringify(testCase.expected)}`))}` : ""}
			${renderList(asStringArray(activity.content.rubric))}
		`,
	};
}

function renderCaseStudy(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	return {
		body: `
			${asText(activity.content.scenario) ? `<p><strong>Scenario:</strong> ${escapeHtml(activity.content.scenario)}</p>` : ""}
			${asText(activity.content.problem) ? `<p><strong>Problem:</strong> ${escapeHtml(activity.content.problem)}</p>` : ""}
			${renderTextarea("Your analysis")}
		`,
		answer: renderList(asStringArray(activity.content.rubric)),
	};
}

function renderDebateReflection(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	return {
		body: `
			<p>${escapeHtml(activity.content.prompt)}</p>
			${renderList(asStringArray(activity.content.positions))}
			${renderList(asStringArray(activity.content.reflectionQuestions))}
			${renderTextarea("Your reflection")}
		`,
		answer: renderList(asStringArray(activity.content.reflectionQuestions)),
	};
}

function renderGuidedProject(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	return {
		body: `
			${asText(activity.content.goal) ? `<p><strong>Goal:</strong> ${escapeHtml(activity.content.goal)}</p>` : ""}
			${asText(activity.content.brief) ? `<p>${escapeHtml(activity.content.brief)}</p>` : ""}
			${renderList(asStringArray(activity.content.steps))}
			${asText(activity.content.deliverable) ? `<p><strong>Deliverable:</strong> ${escapeHtml(activity.content.deliverable)}</p>` : ""}
			${renderTextarea("Your project notes")}
		`,
		answer: renderList(asStringArray(activity.content.rubric)),
	};
}

function renderFreeform(activity: ExportActivity): {
	body: string;
	answer: string;
} {
	return {
		body: `<div class="freeform">${sanitizeStaticHtml(asText(activity.content.html))}</div>`,
		answer: "<p>This activity is exported as static HTML content.</p>",
	};
}

function renderActivity(activity: ExportActivity): {
	body: string;
	answer: ExportActivityAnswerKey;
} {
	const rendered =
		activity.type === "multiple_choice" ? renderMultipleChoice(activity)
		: activity.type === "flashcards" ? renderFlashcards(activity)
		: activity.type === "matching" ? renderMatching(activity)
		: activity.type === "ordering" ? renderOrdering(activity)
		: activity.type === "cloze" ? renderCloze(activity)
		: activity.type === "short_answer" ? renderShortAnswer(activity)
		: activity.type === "coding_practice" ? renderCodingPractice(activity)
		: activity.type === "case_study" ? renderCaseStudy(activity)
		: activity.type === "debate_reflection" ? renderDebateReflection(activity)
		: activity.type === "guided_project" ? renderGuidedProject(activity)
		: renderFreeform(activity);

	return {
		body: `
			<article class="activity" id="activity-${escapeAttribute(activity.id)}">
				<h3>${escapeHtml(activity.title)}</h3>
				<p class="activity-instructions">${escapeHtml(activity.instructions)}</p>
				${rendered.body}
				${
					["multiple_choice", "matching", "ordering", "cloze"].includes(
						activity.type,
					) ?
						'<button class="check-button" type="button">Check answers</button><p class="check-result" aria-live="polite"></p>'
					:	""
				}
				<details class="activity-explanation">
					<summary>Explanation / rubric</summary>
					<div class="activity-explanation-content">
						${rendered.answer || "<p>No answer key available.</p>"}
					</div>
				</details>
			</article>
		`,
		answer: {
			activityId: activity.id,
			title: activity.title,
			html: rendered.answer || "<p>No answer key available.</p>",
		},
	};
}

function buildActivitiesStyles(): string {
	return `
		:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1d1d1f; background: #f5f5f7; }
		* { box-sizing: border-box; }
		body { margin: 0; background: #f5f5f7; }
		main { max-width: 980px; margin: 0 auto; padding: 40px 20px 72px; }
		header { border-bottom: 1px solid #d7d7dc; padding-bottom: 24px; margin-bottom: 28px; }
		h1, h2, h3, h4 { font-family: Sora, Inter, sans-serif; letter-spacing: 0; }
		h1 { margin: 0 0 10px; font-size: 34px; line-height: 1.1; }
		h2 { margin: 36px 0 16px; font-size: 22px; }
		h3 { margin: 4px 0 8px; font-size: 18px; }
		h4 { margin: 12px 0 8px; font-size: 14px; }
		p, li { line-height: 1.65; }
		a { color: #15803d; }
		.tabs { display: flex; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #d7d7dc; margin-bottom: 22px; }
		.tab-button { border: 1px solid #d7d7dc; border-bottom: 0; border-radius: 8px 8px 0 0; background: #fff; color: #5f6368; padding: 11px 14px; font: inherit; font-weight: 750; cursor: pointer; }
		.tab-button.is-active { color: #15803d; border-color: #15803d; box-shadow: inset 0 -2px 0 #fff; }
		.tab-panel { display: none; }
		.tab-panel.is-active { display: block; }
		.module, .activity { background: #fff; border: 1px solid #e5e5e7; border-radius: 8px; padding: 22px; margin: 16px 0; }
		.module { border-left: 4px solid #15803d; }
		.module-title { color: #6e6e73; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
		.activity-kicker { color: #15803d; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
		.activity-instructions { color: #5f6368; margin-top: 0; }
		.options { display: grid; gap: 8px; }
		.option, .inline-answer, .answer-box { display: grid; gap: 7px; border: 1px solid #e5e5e7; border-radius: 8px; padding: 10px 12px; background: #fbfbfc; }
		.option { grid-template-columns: auto 1fr; align-items: start; }
		.inline-answer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
		input, textarea { width: 100%; border: 1px solid #d0d7de; border-radius: 6px; padding: 9px 10px; font: inherit; background: #fff; }
		textarea { min-height: 110px; resize: vertical; }
		.order-input { width: 74px; }
		pre { overflow-x: auto; border: 1px solid #d0d7de; border-radius: 8px; background: #f6f8fa; padding: 14px; }
		code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }
		.flashcards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
		.flashcard { min-height: 140px; border: 1px solid #d0d7de; border-radius: 8px; background: #fff; padding: 16px; text-align: left; cursor: pointer; }
		.flashcard-back { display: none; color: #15803d; font-weight: 650; }
		.flashcard.is-flipped .flashcard-front { display: none; }
		.flashcard.is-flipped .flashcard-back { display: block; }
		.check-button { margin-top: 14px; border: 0; border-radius: 999px; background: #1d1d1f; color: white; padding: 9px 15px; font-weight: 700; cursor: pointer; }
		.check-result { color: #15803d; font-weight: 700; }
		.activity-explanation { margin-top: 18px; border-top: 1px solid #ececf0; padding-top: 12px; }
		.activity-explanation summary { color: #15803d; cursor: pointer; font-weight: 800; }
		.activity-explanation-content { margin-top: 10px; color: #424245; }
		.answer-key-item { border-top: 1px solid #ececf0; padding-top: 12px; margin-top: 12px; }
		@media print { body { background: #fff; } main { max-width: none; padding: 0; } .tabs { display: none; } .tab-panel { display: block; } .module, .activity { break-inside: avoid; border-color: #ddd; } .check-button { display: none; } }
	`;
}

function buildActivitiesScript(): string {
	return `
		document.querySelectorAll(".tab-button").forEach(function(button) {
			button.addEventListener("click", function() {
				var target = button.getAttribute("data-tab-target");
				document.querySelectorAll(".tab-button").forEach(function(item) {
					item.classList.toggle("is-active", item === button);
					item.setAttribute("aria-selected", item === button ? "true" : "false");
				});
				document.querySelectorAll(".tab-panel").forEach(function(panel) {
					panel.classList.toggle("is-active", panel.id === target);
				});
			});
		});
		document.querySelectorAll(".flashcard").forEach(function(card) {
			card.addEventListener("click", function() { card.classList.toggle("is-flipped"); });
		});
		document.querySelectorAll(".activity").forEach(function(activity) {
			var button = activity.querySelector(".check-button");
			if (!button) return;
			button.addEventListener("click", function() {
				var total = 0;
				var correct = 0;
				var radioNames = [];
				var radios = Array.prototype.slice.call(activity.querySelectorAll('input[type="radio"][data-correct]'));
				radios.forEach(function(input) {
					if (radioNames.indexOf(input.name) === -1) radioNames.push(input.name);
				});
				radioNames.forEach(function(name) {
					var group = radios.filter(function(input) { return input.name === name; });
					var checked = group.filter(function(input) { return input.checked; })[0];
					var expected = String((group[0] && group[0].getAttribute("data-correct")) || "").trim().toLowerCase();
					total += 1;
					if (checked && String(checked.value || "").trim().toLowerCase() === expected) correct += 1;
				});
				Array.prototype.slice.call(activity.querySelectorAll("[data-answer]")).forEach(function(input) {
					var expected = String(input.getAttribute("data-answer") || "").trim().toLowerCase();
					var actual = "";
					actual = String(input.value || "").trim().toLowerCase();
					total += 1;
					if (actual === expected) correct += 1;
				});
				var result = activity.querySelector(".check-result");
				if (result) result.textContent = correct + " of " + total + " correct.";
			});
		});
	`;
}

export function buildActivitiesHtmlDocument(
	snapshot: UnitExportSnapshot,
): string {
	const renderedModules = snapshot.modules.map((module) => ({
		module,
		activities: module.activities.map((activity) => ({
			activity,
			rendered: renderActivity(activity),
		})),
	}));
	const activityTypes = ACTIVITY_TYPE_ORDER.filter((type) =>
		renderedModules.some(({activities}) =>
			activities.some(({activity}) => activity.type === type),
		),
	);
	const exportedDate = new Date(snapshot.exportedAt).toLocaleDateString();

	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${escapeHtml(snapshot.unit.title)} activities</title>
		<style>${buildActivitiesStyles()}</style>
	</head>
	<body>
		<main>
			<header>
				<h1>${escapeHtml(snapshot.unit.title)}</h1>
				<p>${escapeHtml(snapshot.unit.topic)} - Offline activities export - ${escapeHtml(exportedDate)}</p>
			</header>
			${
				activityTypes.length === 0 ?
					'<section class="module"><p>No activities were available for export.</p></section>'
				:	`
						<nav class="tabs" aria-label="Activity types">
							${activityTypes
								.map(
									(type, index) => `
										<button class="tab-button${index === 0 ? " is-active" : ""}" type="button" data-tab-target="tab-${escapeAttribute(type)}" aria-selected="${index === 0 ? "true" : "false"}">
											${escapeHtml(activityTypeLabel(type))}
										</button>
									`,
								)
								.join("")}
						</nav>
						${activityTypes
							.map(
								(type, index) => `
									<section class="tab-panel${index === 0 ? " is-active" : ""}" id="tab-${escapeAttribute(type)}">
										<h2>${escapeHtml(activityTypeLabel(type))}</h2>
										${renderedModules
											.map(({module, activities}) => ({
												module,
												activities: activities.filter(
													({activity}) => activity.type === type,
												),
											}))
											.filter(({activities}) => activities.length > 0)
											.map(
												({module, activities}) => `
													<section class="module">
														<div class="module-title">Module ${module.chapterIndex + 1}</div>
														<h3>${escapeHtml(module.title)}</h3>
														${activities
															.map(({rendered}) => rendered.body)
															.join("")}
													</section>
												`,
											)
											.join("")}
									</section>
								`,
							)
							.join("")}
					`
			}
		</main>
		<script>${buildActivitiesScript()}</script>
	</body>
</html>`;
}
