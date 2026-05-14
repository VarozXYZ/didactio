import type {
	AuthoringConfig,
	AuthoringLearnerLevel,
	AuthoringTone,
} from "./config.js";
import type {
	DidacticUnitDepth,
	DidacticUnitLength,
	DidacticUnitLevel,
	DidacticUnitQuestionAnswer,
	DidacticUnitReferenceSyllabus,
	DidacticUnitModule,
} from "../didactic-unit/planning.js";
import type {
	LearningActivityScope,
	LearningActivityType,
} from "../activities/learning-activity.js";

export const TARGET_CHAPTER_COUNT_BY_LENGTH: Record<
	DidacticUnitLength,
	number
> = {
	intro: 3,
	short: 6,
	long: 9,
	textbook: 12,
};

export function resolveTargetChapterCount(length: DidacticUnitLength): number {
	return TARGET_CHAPTER_COUNT_BY_LENGTH[length];
}

function formatQuestionnaireContext(
	answers: DidacticUnitQuestionAnswer[] | undefined,
): string {
	if (!answers || answers.length === 0) {
		return "not provided";
	}

	return answers
		.map((answer) => `- ${answer.questionId}: ${answer.value}`)
		.join("\n");
}

function toneInstruction(tone: AuthoringTone): string {
	switch (tone) {
		case "friendly":
			return "Use a warm, conversational tone with approachable language and concrete examples.";
		case "professional":
			return "Use formal academic language that is precise, authoritative, and polished.";
		case "neutral":
		default:
			return "Use standard educational language that is clear, balanced, and effective.";
	}
}

function learnerLevelInstruction(level: AuthoringLearnerLevel): string {
	switch (level) {
		case "advanced":
			return "Assume the user is comfortable with abstraction, independent synthesis, and dense technical explanations.";
		case "intermediate":
			return "Assume the user is comfortable with guided technical explanations but still benefits from scaffolding and worked examples.";
		case "beginner":
		default:
			return "Assume the user benefits from explicit scaffolding, gentle pacing, and concrete examples before abstraction.";
	}
}

function depthInstruction(depth: DidacticUnitDepth): string {
	switch (depth) {
		case "basic":
			return "Avoid technical jargon when possible, explain unavoidable terminology immediately, and break complex concepts into simple parts.";
		case "technical":
			return "Use full technical vocabulary and deeper explanations, prioritizing precision and completeness.";
		case "intermediate":
		default:
			return "Use technical terms when useful, but keep explanations accessible and grounded in examples.";
	}
}

function contentLengthInstruction(length: DidacticUnitLength): string {
	switch (length) {
		case "intro":
			return "Keep the scope compact and introductory.";
		case "long":
			return "Provide substantial coverage with room for explanation, examples, and guided practice.";
		case "textbook":
			return "Aim for comprehensive, textbook-like coverage with robust progression and substantial examples.";
		case "short":
		default:
			return "Keep the material focused but genuinely useful.";
	}
}

function buildAuthoringContext(authoring: AuthoringConfig): string[] {
	return [
		`Language: ${authoring.language}`,
		`Tone: ${authoring.tone}`,
		`Profile learner level: ${authoring.learnerLevel}`,
		toneInstruction(authoring.tone),
		learnerLevelInstruction(authoring.learnerLevel),
	];
}

function formatModuleOutline(
	module: DidacticUnitModule,
	index: number,
	moduleStatus?: "current" | "completed" | "upcoming",
): string {
	const status =
		moduleStatus === "current" ? " (CURRENT MODULE)"
		: moduleStatus === "completed" ? " (COMPLETED)"
		: moduleStatus === "upcoming" ? " (UPCOMING)"
		: "";

	return [
		`${index + 1}. ${module.title}${status}`,
		`- Overview: ${module.overview}`,
		`- Lessons: ${module.lessons.map((lesson) => lesson.title).join(", ")}`,
	].join("\n");
}

function formatFullCourseContext(
	syllabus: DidacticUnitReferenceSyllabus,
	currentModuleIndex?: number,
): string {
	return syllabus.modules
		.map((module, index) =>
			formatModuleOutline(
				module,
				index,
				currentModuleIndex === undefined ? undefined
				: index === currentModuleIndex ? "current"
				: index < currentModuleIndex ? "completed"
				: "upcoming",
			),
		)
		.join("\n\n");
}

function formatContinuityContext(
	syllabus: DidacticUnitReferenceSyllabus,
	continuitySummaries: string[] | undefined,
	moduleIndex: number,
): string {
	const previousModules = syllabus.modules.slice(0, moduleIndex);
	const previousSummaries = (continuitySummaries ?? []).slice(0, moduleIndex);

	if (previousModules.length === 0) {
		return [
			"**Prerequisites:**",
			"This is the first module, so assume students are starting fresh with the topic.",
		].join("\n");
	}

	const prerequisites = previousModules
		.map(
			(module, index) =>
				`${index + 1}. ${module.title}: ${module.overview}`,
		)
		.join("\n");

	const summaryContext = previousModules
		.map((module, index) => {
			const summary = previousSummaries[index];
			const content =
				summary ??
				[module.overview, module.lessons.map((l) => l.title).join(", ")]
					.filter(Boolean)
					.join(" — ");
			return `### Module ${index + 1} Concepts:\n${content}`;
		})
		.join("\n\n");

	return [
		"**Prerequisites (from previous modules):**",
		prerequisites,
		"",
		"**Key concepts ALREADY covered (DO NOT RE-EXPLAIN THESE):**",
		summaryContext,
		"",
		"Instructions:",
		"- Assume the student has mastered the concepts listed above.",
		"- Do not define terms that were already defined in previous modules.",
		"- Build upon this existing knowledge foundation.",
	].join("\n");
}

function formatForwardContext(
	syllabus: DidacticUnitReferenceSyllabus,
	moduleIndex: number,
): string {
	const upcomingModules = syllabus.modules.slice(moduleIndex + 1);

	if (upcomingModules.length === 0) {
		return [
			"**Course completion:**",
			"This is the final module. Focus on synthesis, application, and mastery of the entire topic.",
		].join("\n");
	}

	return [
		"**Upcoming modules (to prepare students for):**",
		upcomingModules
			.map(
				(module, index) =>
					`${moduleIndex + index + 2}. ${module.title}: ${module.overview}`,
			)
			.join("\n"),
		"",
		"Introduce concepts that will be expanded in later modules. Avoid covering topics that will be deeply explored in upcoming modules.",
	].join("\n");
}

function buildSection(title: string, lines: string[]): string {
	return [`[${title}]`, ...lines.filter(Boolean)].join("\n");
}

export function buildGatewaySystemPrompt(
	stage:
		| "folder_classification"
		| "moderation"
		| "syllabus"
		| "summary"
		| "chapter"
		| "activity"
		| "activity_feedback",
): string {
	switch (stage) {
		case "folder_classification":
			return "You classify educational units into an existing folder. Return only the requested structured object.";
		case "moderation":
			return "You are a prompt filter and improver for an educational course creation platform. Return only the requested structured object.";
		case "syllabus":
			return "You are a curriculum designer. Return only a single valid structured syllabus object that exactly matches the requested schema.";
		case "summary":
			return "You write concise internal continuity summaries or learner-facing recaps depending on the prompt.";
		case "chapter":
			return "You are an expert curriculum designer and instructional design specialist. Return only sanitized-HTML-compatible educational content.";
		case "activity":
			return "You design structured learning activities. Return only the requested JSON object; never generate UI HTML except for the explicitly allowed freeform_html type.";
		case "activity_feedback":
			return "You assess a learner's activity attempt against a rubric. Return only concise structured feedback.";
	}
}

function activityTypeContract(type: LearningActivityType): string {
	switch (type) {
		case "multiple_choice":
			return 'content.questions: array of EXACTLY 10 items, each with {id, prompt, options:[{id,text}] (exactly 4 options per question), correctOptionId, explanation}. Cover a wide range of concepts from the module — do not cluster all questions around a single idea.';
		case "short_answer":
			return "content.prompts: array of EXACTLY 3 items, each with {id, prompt, expectedAnswer, rubric:string[]}. Each prompt must be a medium-length open-ended free-response question that asks the learner to explain, justify, compare, or apply an idea in natural language over several sentences. Do NOT ask the learner to write, generate, complete, debug, refactor, or output code, markup, commands, config files, interfaces, types, components, functions, or snippets; those belong to coding_practice. Do NOT create quiz-style, multiple-choice, yes/no, fill-in-the-blank, or very short recall questions. Keep top-level instructions generic and do not repeat any prompt there.";
		case "coding_practice":
			return "content.language, content.prompt, content.starterCode, content.expectedOutcome, content.testCases:[{input, expected}], content.rubric:string[].";
		case "flashcards":
			return "content.cards: array of {id, front, back}.";
		case "matching":
			return "content.pairs: array of {id, left, right}.";
		case "ordering":
			return "content.items: array of {id, text, correctOrder:number}.";
		case "case_study":
			return "content.scenario and content.questions:[{id, prompt, rubric:string[]}].";
		case "debate_reflection":
			return "content.prompt, content.positions:string[], content.reflectionQuestions:string[].";
		case "cloze":
			return "content.textWithBlanks using {{blank_id}} markers and content.blanks:[{id, answer, hint}].";
		case "guided_project":
			return "content.brief, content.steps:string[], content.deliverable, content.rubric:string[].";
		case "freeform_html":
			return "content.html with sanitized compact HTML only: no scripts, event handlers, forms, iframes, inline styles, or external assets.";
	}
}

export function buildLearningActivityPrompt(input: {
	topic: string;
	moduleTitle: string;
	scope: LearningActivityScope;
	type: LearningActivityType;
	contextModules: Array<{
		index: number;
		title: string;
		overview: string;
		html?: string;
		continuitySummary?: string;
	}>;
	previousActivities: Array<{
		chapterIndex: number;
		type: string;
		title: string;
		instructions: string;
		dedupeSummary: string;
	}>;
	authoring: AuthoringConfig;
}): string {
	const previous =
		input.previousActivities.length === 0 ?
			"No previous activities in this context."
		:	input.previousActivities
				.slice(0, 12)
				.map(
					(activity) =>
						`- Module ${activity.chapterIndex + 1}, ${activity.type}: ${activity.title}. ${activity.instructions}. Anti-repeat: ${activity.dedupeSummary}`,
				)
				.join("\n");

	return [
		buildSection("Activity Contract", [
			`Create one ${input.type} activity for "${input.moduleTitle}" in ${input.topic}.`,
			`Scope: ${input.scope}.`,
			"Return JSON with exactly: title, instructions, dedupeSummary, content.",
			activityTypeContract(input.type),
			"Keep the activity compact enough to fit in one reading page when possible.",
		]),
		buildSection("Authoring Profile", buildAuthoringContext(input.authoring)),
		buildSection("Learning Context", [
			input.contextModules
				.map(
					(module) =>
						`## Module ${module.index + 1}: ${module.title}\nOverview: ${module.overview}\nSummary: ${module.continuitySummary ?? "not available"}\nContent excerpt:\n${(module.html ?? "").replace(/<[^>]+>/g, " ").slice(0, 2500)}`,
				)
				.join("\n\n"),
		]),
		buildSection("Previous Activities: anti-repetition priority", [
			previous,
			"These previous activities are more important than the lesson content for avoiding repetition.",
			"Do not repeat the exact format, question, example, dataset, coding challenge, case, or assessed skill.",
			"If the same activity type is requested again, vary the angle, difficulty, example and concrete skill.",
		]),
	].join("\n\n");
}

export function buildLearningActivityFeedbackPrompt(input: {
	activityTitle: string;
	activityType: LearningActivityType;
	instructions: string;
	content: Record<string, unknown>;
	answers: unknown;
}): string {
	const shortAnswerPrompts =
		input.activityType === "short_answer" && Array.isArray(input.content.prompts) ?
			input.content.prompts
				.slice(0, 3)
				.map((prompt, index) => {
					const item =
						prompt && typeof prompt === "object" && !Array.isArray(prompt) ?
							prompt as Record<string, unknown>
						:	{};
					const id =
						typeof item.id === "string" || typeof item.id === "number" ?
							String(item.id)
						:	`prompt${index + 1}`;
					return `- ${id}: ${typeof item.prompt === "string" ? item.prompt : ""}`;
				})
				.join("\n")
		:	"";

	return [
		buildSection("Assessment Contract", [
			`Activity: ${input.activityTitle}`,
			`Type: ${input.activityType}`,
			`Instructions: ${input.instructions}`,
			"Return JSON with feedback, score 0-100 when possible, strengths, improvements, and questionFeedback.",
			'For short_answer, questionFeedback must include EXACTLY 3 items: one separate correction for each content.prompts item. Use the same id as the prompt. Do not reuse the same correction across questions. Each item must include simplifiedScore exactly one of "wrong", "Almost there", "Perfect"; expectedAnswer with the correction / expected answer for that specific prompt; improvementReason explaining why that specific score was given and how to improve that specific learner answer.',
			"Compare each learner answer only against its matching prompt and rubric. If an answer is blank, mark that specific item as wrong and explain what should have been answered.",
			"expectedAnswer and improvementReason may use simple sanitized HTML only: <p>, <ul>, <ol>, <li>, <strong>, <em>, <u>, <mark>, <code>, <br>. No headings, links, styles, scripts, tables, or code blocks.",
			"Be direct, useful, and specific. Do not reveal hidden answers unless needed to explain a misconception.",
		]),
		input.activityType === "short_answer" ?
			buildSection("Required questionFeedback ids", [
				shortAnswerPrompts,
				"Return questionFeedback in this exact order and with these exact ids.",
			])
		:	"",
		buildSection("Activity Content", [JSON.stringify(input.content).slice(0, 6000)]),
		buildSection("Learner Answers", [JSON.stringify(input.answers).slice(0, 4000)]),
	].join("\n\n");
}

export function buildModerationPrompt(input: {
	topic: string;
	level: DidacticUnitLevel;
	additionalContext?: string;
	folders?: Array<{
		name: string;
		description: string;
	}>;
	authoring: AuthoringConfig;
}): string {
	const shouldClassifyFolder = (input.folders?.length ?? 0) > 0;

	return [
		buildSection("Role / Contract", [
			"Validate that the topic is appropriate for educational content.",
			"Approve by default when the request can be turned into a harmless, lawful, rights-respecting learning unit.",
			"Reject only when the unsafe or unusable part is central to the request and cannot be removed while preserving a coherent educational topic.",
			"Improve vague prompts into clear, structured learning objectives.",
			shouldClassifyFolder ?
				"Also classify the unit into exactly one of the provided folders."
			:	"",
		]),
		buildSection("Moderation Policy", [
			"Approve ordinary educational topics across domains: academic subjects, professional skills, software and technology, arts, languages, health and wellbeing at a general educational level, finance literacy, hobbies, entertainment, sports, games, productivity, and personal development.",
			"Do not reject merely because the topic is informal, practical, commercial, strategic, entertainment-related, competitive, or not traditionally academic.",
			"Reject requests that meaningfully enable real-world harm, illegal conduct, rights violations, privacy invasion, cheating/fraud, account abuse, payment bypass, malware/bots, weapons misuse, self-harm, abuse or exploitation, hateful/harassing content, sexual explicitness, or instructions to evade safeguards.",
			"Reject requests to plagiarize, impersonate, steal copyrighted material, violate terms of service, or bypass access controls. Educational discussion about ethics, prevention, history, policy, or high-level awareness of these areas is allowed.",
			"When a request has both safe and unsafe interpretations, approve the safe educational version, remove or neutralize unsafe instructions, and mention the boundary in notes.",
			'Example allowed case: "Como conseguir muchisimos diamantes en Infinity Nikki" should be approved as a legitimate guide to in-game progression, events, daily tasks, rewards, and resource management, while excluding cheating, bots, account abuse, exploits, or payment bypass.',
		]),
		buildSection(
			"Authoring Profile",
			buildAuthoringContext(input.authoring),
		),
		buildSection("Learner Context", [`Course level: ${input.level}`]),
		buildSection("Requested Topic", [
			`Evaluate and improve this course topic request for a ${input.level} level course: "${input.topic}"`,
			input.additionalContext ?
				`Additional context: ${input.additionalContext}`
			:	"",
		]),
		shouldClassifyFolder ?
			buildSection("Available folders", [
				input
					.folders!.map(
						(folder, index) =>
							`${index + 1}. ${folder.name}: ${folder.description}`,
					)
					.join("\n"),
			])
		:	"",
		buildSection("Visual Style Presets", [
			'Also choose the most appropriate visual style for this unit from exactly one of: "modern", "classic", "plain".',
			'- "modern": programming, engineering, technology, and data science topics (clean, contemporary aesthetic)',
			'- "classic": humanities, history, literature, and general learning (editorial, traditional aesthetic)',
			'- "plain": neutral content with minimal styling (default if unsure)',
			"Return the chosen preset ID in the stylePreset field.",
		]),
		buildSection("Output Contract", [
			"Return whether the prompt is approved, a normalized topic title, an improved topic brief targeting the requested level, and concise reasoning notes.",
			"Use these exact JSON keys: approved, notes, normalizedTopic, improvedTopicBrief, reasoningNotes.",
			"Set approved to true for ordinary benign educational requests, including practical or hobby topics, unless the request clearly falls into a rejection category above.",
			"Preserve the authoring context in the improved brief so downstream generations inherit it.",
			shouldClassifyFolder ?
				"Return folderName exactly as written in the available folder list. If uncertain, use General."
			:	"",
			shouldClassifyFolder ?
				"Return folderReasoning with a short explanation for the folder choice."
			:	"",
			'Return stylePreset as one of: "modern", "classic", "plain". Default to "classic" if unsure.',
		]),
	].join("\n\n");
}

export function buildFolderClassificationPrompt(input: {
	topic: string;
	additionalContext?: string;
	folders: Array<{
		name: string;
		description: string;
	}>;
	authoring: AuthoringConfig;
}): string {
	return [
		buildSection("Role / Contract", [
			"Classify the requested didactic unit into exactly one existing folder.",
			"Choose the closest folder from the provided list only.",
			"Prefer General when the topic is broad, ambiguous, or does not clearly fit a more specific folder.",
		]),
		buildSection(
			"Authoring Profile",
			buildAuthoringContext(input.authoring),
		),
		buildSection("Unit Context", [
			`Topic: ${input.topic}`,
			input.additionalContext ?
				`Additional context: ${input.additionalContext}`
			:	"",
		]),
		buildSection("Available folders", [
			input.folders
				.map(
					(folder, index) =>
						`${index + 1}. ${folder.name}: ${folder.description}`,
				)
				.join("\n"),
		]),
		buildSection("Visual Style Presets", [
			'Also choose the most appropriate visual style for this unit from exactly one of: "modern", "classic", "plain".',
			'- "modern": programming, engineering, technology, and data science topics (clean, contemporary aesthetic)',
			'- "classic": humanities, history, literature, and general learning (editorial, traditional aesthetic)',
			'- "plain": neutral content with minimal styling (default if unsure)',
			"Return the chosen preset ID in the stylePreset field.",
		]),
		buildSection("Output Contract", [
			"Return the chosen folderName exactly as written in the available folder list.",
			"Include a concise reasoning string explaining the match.",
			'Return the stylePreset as one of: "modern", "classic", "plain". Default to "classic" if unsure.',
		]),
	].join("\n\n");
}

export function buildSyllabusMarkdownPrompt(input: {
	topic: string;
	level: DidacticUnitLevel;
	improvedTopicBrief?: string;
	syllabusPrompt: string;
	questionnaireAnswers?: DidacticUnitQuestionAnswer[];
	authoring: AuthoringConfig;
	depth: DidacticUnitDepth;
	length: DidacticUnitLength;
}): string {
	const targetModuleCount = resolveTargetChapterCount(input.length);

	return [
		buildSection("Role / Contract", [
			"Create a complete syllabus object for the requested topic.",
			"The syllabus must use modules that progress from conceptual understanding to practical application to independent creation.",
		]),
		buildSection("Learner / Profile Context", [
			`Declared learner level: ${input.level}`,
			"Learner questionnaire context:",
			formatQuestionnaireContext(input.questionnaireAnswers),
			`Requested depth: ${input.depth}`,
			`Requested length: ${input.length}`,
			`Target module count: ${targetModuleCount}`,
			depthInstruction(input.depth),
			contentLengthInstruction(input.length),
		]),
		buildSection(
			"Authoring Profile",
			buildAuthoringContext(input.authoring),
		),
		buildSection("Generation Brief", [
			`Topic: ${input.topic}`,
			input.improvedTopicBrief ?
				`Improved topic brief: ${input.improvedTopicBrief}`
			:	"",
			"Deterministic syllabus planning prompt:",
			input.syllabusPrompt,
		]),
		buildSection("Output Contract", [
			"Return a strict structured syllabus object.",
			"Use these exact top-level keys: topic, title, keywords, description, modules.",
			"For each module, use these exact keys: title, overview, lessons.",
			"For each lesson, use these exact keys: title, contentOutline.",
			`Create exactly ${targetModuleCount} modules.`,
			"Do not include durations or time estimates anywhere.",
			"Use a keywords string, not a keywords array.",
			"Each module must include lessons with action-oriented content outlines.",
			"Ensure modules build logically on one another and the final module emphasizes synthesis or independent creation.",
			"Make titles and section phrasing natural, specific, and human. Avoid generic educational boilerplate.",
			"Use sentence case for titles and headings, not title case. Capitalize only the first word and proper nouns.",
		]),
	].join("\n\n");
}

export function buildChapterHtmlPrompt(input: {
	topic: string;
	level: DidacticUnitLevel;
	syllabus: DidacticUnitReferenceSyllabus;
	chapterIndex: number;
	questionnaireAnswers?: DidacticUnitQuestionAnswer[];
	continuitySummaries?: string[];
	authoring: AuthoringConfig;
	depth: DidacticUnitDepth;
	length: DidacticUnitLength;
	additionalContext?: string;
	instruction?: string;
}): string {
	const module = input.syllabus.modules[input.chapterIndex];
	const previousBridge =
		input.chapterIndex > 0 ?
			`Use this previous-module continuity context naturally, without adding a fixed bridge heading: ${input.continuitySummaries?.[input.chapterIndex - 1] ?? input.syllabus.modules[input.chapterIndex - 1]?.overview ?? "the previous module"}.`
		:	"This is the first module, so begin by orienting the learner clearly.";

	return [
		buildSection("Course Overview", [
			`Main Topic: ${input.syllabus.topic}`,
			`Student Level: ${input.level}`,
			`Course Description: ${input.syllabus.description}`,
			`Requested depth: ${input.depth}`,
			`Requested length: ${input.length}`,
			depthInstruction(input.depth),
			contentLengthInstruction(input.length),
			"Learner questionnaire context:",
			formatQuestionnaireContext(input.questionnaireAnswers),
			input.additionalContext ?
				`Additional learner or context notes: ${input.additionalContext}`
			:	"",
		]),
		buildSection("Complete Course Structure", [
			formatFullCourseContext(input.syllabus, input.chapterIndex),
		]),
		buildSection("Current Module Details", [
			`Module Title: ${module.title}`,
			`Module Overview: ${module.overview}`,
			`Position in Course: Module ${input.chapterIndex + 1} of ${input.syllabus.modules.length}`,
			`Current Module Lessons to Cover:\n${module.lessons.map((lesson, index) => `${index + 1}. ${lesson.title}`).join("\n")}`,
			`Lesson content outlines:\n${module.lessons
				.map(
					(lesson, lessonIndex) =>
						`${lessonIndex + 1}. ${lesson.title}\n${lesson.contentOutline
							.map((item) => `   - ${item}`)
							.join("\n")}`,
				)
				.join("\n")}`,
		]),
		buildSection("Prerequisite Context", [
			formatContinuityContext(
				input.syllabus,
				input.continuitySummaries,
				input.chapterIndex,
			),
		]),
		buildSection("Forward Context", [
			formatForwardContext(input.syllabus, input.chapterIndex),
		]),
		buildSection("Writing Style Requirements", [
			`Tone: ${toneInstruction(input.authoring.tone)}`,
			`Technical Level: ${depthInstruction(input.depth)}`,
			`Language: ${input.authoring.language}`,
			`Persistent profile learner level: ${input.authoring.learnerLevel}`,
			learnerLevelInstruction(input.authoring.learnerLevel),
			input.authoring.extraInstructions ?
				`Extra instructions for this educational content: ${input.authoring.extraInstructions}`
			:	"",
			"Use sentence case for headings and subheadings, not title case.",
			"Capitalize only the first word and proper nouns in headings.",
			'Prefer "Common pitfalls with variables" over "Common Pitfalls with Variables".',
		]),
		buildSection("Pedagogical Requirements", [
			previousBridge,
			"Each lesson must be written as a cohesive mini-module section, not a list of tips.",
			"Use a 70/30 balance of conceptual depth and applied practice.",
			"Include all of these organically, not as a repetitive checklist:",
			"1. A detailed conceptual explanation",
			"2. A realistic example drawn from relevant domains and real-world applications",
			"3. A contrastive analysis showing ineffective vs effective approaches",
			"4. Common mistakes or pitfalls",
			"5. A short, meaningful activity or reflection task",
			"6. Exactly one closing paragraph for the whole generated module, placed only at the very end of the HTML.",
			"The closing paragraph must concisely recap only what this chapter has already taught.",
			"Do not add closing, recap, transition, or 'what comes next' headings inside individual lessons or in the middle of the module.",
			"Do not preview future modules, upcoming lessons, or what the learner will do next in the closing paragraph.",
			'Do not use generic headings like "Concept Explanation" or "Practical Example" repeatedly. Use topic-specific headings.',
			input.instruction ?
				`Regeneration instruction from the user: ${input.instruction}`
			:	"",
		]),
		buildSection("Output Contract", [
			"Return ONLY HTML. Do not include JSON, Markdown, code fences, or commentary outside the HTML.",
			"Allowed block tags: h2, h3, h4, p, ul, ol, li, blockquote, pre, code, table, thead, tbody, tr, th, td, hr, br.",
			"Allowed inline tags: strong, em, u, code, a, sub, sup, mark.",
			"Use only h2, h3, and h4 for headings. Do not output h1, h5, or h6.",
			"Do not include the module title as a heading because the UI already presents it separately.",
			"Do not include a standalone overview section at the beginning.",
			"Start directly with the instructional body.",
			"Every text run must be inside a valid block element such as p, li, blockquote, th, or td.",
			"Do not use div, section, article, span, img, style, script, iframe, form, details, summary, data attributes, or on* event handlers.",
			"Do not use inline style attributes. Do not use class attributes except language-* on code.",
			"Code blocks must use <pre><code class=\"language-X\">...</code></pre>.",
			"Links may use href and title only. Use http, https, mailto, or #anchor hrefs.",
			"Use sentence case for headings.",
			"The final top-level element must be a single <p>, not a heading or list.",
			"The final top-level <p> must be the only closing recap in the module and must summarize concepts already covered in this chapter.",
			'Do not use headings such as "What you have learned", "What comes next", "What you have learned and what comes next", "Summary", "Conclusion", "Next steps", "Lo que has aprendido", or "Que viene despues".',
			'The final top-level <p> must not mention future learning, upcoming modules, next chapters, previews, or phrases like "next", "will learn", "will explore", "in the next module", "a continuacion", or "en el siguiente modulo".',
		]),
	].join("\n\n");
}

export function buildLearnerSummaryPrompt(input: {
	topic: string;
	chapterTitle: string;
	chapterMarkdown: string;
	authoring: AuthoringConfig;
}): string {
	return [
		buildSection("Role / Contract", [
			"Write a concise learner-facing summary for teaching content.",
		]),
		buildSection(
			"Authoring Profile",
			buildAuthoringContext(input.authoring),
		),
		buildSection("Current Artifact Target", [
			`Topic: ${input.topic}`,
			`Module or unit title: ${input.chapterTitle}`,
		]),
		buildSection("Output Contract", [
			"Return markdown with exactly 2 sections:",
			"## Recap",
			"<short paragraph>",
			"## What To Practice",
			"- item",
			"- item",
		]),
		buildSection("Source Markdown", [input.chapterMarkdown]),
	].join("\n\n");
}
