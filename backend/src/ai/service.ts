import {createGateway, generateObject, streamObject, streamText} from "ai";
import {z} from "zod";
import {getAppEnv} from "../config/env.js";
import type {DidacticUnitGeneratedChapter} from "../didactic-unit/didactic-unit-chapter.js";
import {createLogger, type Logger} from "../logging/logger.js";
import type {
	DidacticUnitDepth,
	DidacticUnitLength,
	DidacticUnitLevel,
	DidacticUnitQuestion,
	DidacticUnitQuestionAnswer,
	DidacticUnitQuestionnaire,
	DidacticUnitQuestionOption,
	DidacticUnitReferenceSyllabus,
} from "../didactic-unit/planning.js";
import type {AiConfig, AiModelConfig, AiModelTier} from "./config.js";
import {resolveGatewayModelId} from "./config.js";
import {
	buildFolderClassificationPrompt,
	buildChapterHtmlPrompt,
	buildGatewaySystemPrompt,
	buildLearnerSummaryPrompt,
	buildModerationPrompt,
	buildQuestionnairePrompt,
	resolveTargetChapterCount,
	buildSyllabusMarkdownPrompt,
} from "./prompt-builders.js";
import {
	folderClassificationSchema,
	moderationSchema,
	questionnaireSchema,
	syllabusSchema,
} from "./schemas.js";
import {
	collectAiCallTelemetry,
	enrichAiCallTelemetryWithGatewayInfo,
	summarizeAiCallTelemetry,
	type AiCallTelemetry,
} from "./telemetry.js";
import {createCanonicalDidacticUnitChapter} from "../didactic-unit/didactic-unit-chapter.js";
import {extractContinuitySummary} from "../html/extractContinuity.js";

export class AiGatewayConfigurationError extends Error {}

interface ModelSelection {
	provider: string;
	model: string;
	modelId: string;
}

interface BaseStageResult {
	provider: string;
	model: string;
	prompt: string;
	telemetry: AiCallTelemetry;
}

export interface ModerationResult extends BaseStageResult {
	approved: boolean;
	notes: string;
	normalizedTopic: string;
	improvedTopicBrief: string;
	reasoningNotes: string;
	folderName?: string;
	folderReasoning?: string;
}

export interface FolderClassificationResult extends BaseStageResult {
	folderName: string;
	reasoning: string;
}

export interface QuestionnaireResult extends BaseStageResult {
	questionnaire: DidacticUnitQuestionnaire;
}

export interface SyllabusResult extends BaseStageResult {
	syllabus: DidacticUnitReferenceSyllabus;
}

export interface SummaryResult extends BaseStageResult {
	markdown: string;
}

export interface ChapterResult extends BaseStageResult {
	html: string;
	chapter: DidacticUnitGeneratedChapter;
	continuitySummary: string;
}

type AiStageName =
	| "folder_classification"
	| "moderation"
	| "questionnaire"
	| "syllabus"
	| "summary"
	| "module";

interface GatewayAiServiceOptions {
	logger?: Logger;
}

export interface MarkdownStreamCallbacks<T> {
	onStart?: (selection: ModelSelection) => Promise<void> | void;
	onMarkdown?: (delta: string, markdown: string) => Promise<void> | void;
	onHtml?: (delta: string, html: string) => Promise<void> | void;
	onComplete?: (result: T) => Promise<void> | void;
}

export interface StructuredStreamCallbacks<T> {
	onStart?: (selection: ModelSelection) => Promise<void> | void;
	onPartial?: (partial: Partial<T>) => Promise<void> | void;
	onComplete?: (result: T) => Promise<void> | void;
}

export interface AiService {
	classifyFolder(input: {
		topic: string;
		additionalContext?: string;
		folders: Array<{
			name: string;
			description: string;
		}>;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<FolderClassificationResult>;
	moderateTopic(input: {
		topic: string;
		level: DidacticUnitLevel;
		additionalContext?: string;
		folders?: Array<{
			name: string;
			description: string;
		}>;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<ModerationResult>;
	streamModeration(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			additionalContext?: string;
			folders?: Array<{
				name: string;
				description: string;
			}>;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: StructuredStreamCallbacks<ModerationResult>,
	): Promise<ModerationResult>;
	generateQuestionnaire(input: {
		topic: string;
		level: DidacticUnitLevel;
		improvedTopicBrief?: string;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<QuestionnaireResult>;
	streamQuestionnaire(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			improvedTopicBrief?: string;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: StructuredStreamCallbacks<QuestionnaireResult>,
	): Promise<QuestionnaireResult>;
	generateSyllabus(input: {
		topic: string;
		level: DidacticUnitLevel;
		improvedTopicBrief?: string;
		syllabusPrompt: string;
		questionnaireAnswers?: DidacticUnitQuestionAnswer[];
		depth: DidacticUnitDepth;
		length: DidacticUnitLength;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<SyllabusResult>;
	streamSyllabus(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			improvedTopicBrief?: string;
			syllabusPrompt: string;
			questionnaireAnswers?: DidacticUnitQuestionAnswer[];
			depth: DidacticUnitDepth;
			length: DidacticUnitLength;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: StructuredStreamCallbacks<SyllabusResult>,
	): Promise<SyllabusResult>;
	generateSummary(input: {
		topic: string;
		chapterTitle: string;
		chapterMarkdown: string;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
		kind?: "continuity" | "learner";
	}): Promise<SummaryResult>;
	streamSummary(
		input: {
			topic: string;
			chapterTitle: string;
			chapterMarkdown: string;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
			kind?: "continuity" | "learner";
		},
		callbacks: MarkdownStreamCallbacks<SummaryResult>,
	): Promise<SummaryResult>;
	generateChapter(input: {
		topic: string;
		level: DidacticUnitLevel;
		syllabus: DidacticUnitReferenceSyllabus;
		chapterIndex: number;
		questionnaireAnswers?: DidacticUnitQuestionAnswer[];
		continuitySummaries?: string[];
		depth: DidacticUnitDepth;
		length: DidacticUnitLength;
		additionalContext?: string;
		instruction?: string;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<ChapterResult>;
	streamChapter(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			syllabus: DidacticUnitReferenceSyllabus;
			chapterIndex: number;
			questionnaireAnswers?: DidacticUnitQuestionAnswer[];
			continuitySummaries?: string[];
			depth: DidacticUnitDepth;
			length: DidacticUnitLength;
			additionalContext?: string;
			instruction?: string;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: MarkdownStreamCallbacks<ChapterResult>,
	): Promise<ChapterResult>;
}

const CONTENT_LENGTH_TOKENS: Record<DidacticUnitLength, number> = {
	intro: 5000,
	short: 7500,
	long: 15000,
	textbook: 32000,
};

function resolveStageMaxOutputTokens(
	stage:
		| "folder_classification"
		| "moderation"
		| "questionnaire"
		| "syllabus"
		| "summary"
		| "chapter",
	length?: DidacticUnitLength,
): number {
	switch (stage) {
		case "folder_classification":
		case "moderation":
			return 1200;
		case "questionnaire":
			return 1800;
		case "summary":
			return 1000;
		case "syllabus":
		case "chapter":
			if (!length) {
				throw new Error(
					`A didactic unit length is required for the ${stage} token budget.`,
				);
			}
			return CONTENT_LENGTH_TOKENS[length];
	}
}

function normalizeQuestionType(rawType: string): DidacticUnitQuestion["type"] {
	const normalized = rawType
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");

	if (
		normalized === "single_select" ||
		normalized === "single" ||
		normalized === "select"
	) {
		return "single_select";
	}

	if (
		normalized === "long_text" ||
		normalized === "text" ||
		normalized === "free_text" ||
		normalized === "open_text"
	) {
		return "long_text";
	}

	throw new Error(`Unsupported questionnaire question type "${rawType}".`);
}

function normalizeQuestionOptions(
	options: Array<{value: string; label: string}> | null | undefined,
): DidacticUnitQuestionOption[] | undefined {
	if (!options || options.length === 0) {
		return undefined;
	}

	const normalizedOptions = options
		.map((option) => ({
			value: option.value.trim(),
			label: option.label.trim(),
		}))
		.filter((option) => option.value && option.label);

	return normalizedOptions.length > 0 ? normalizedOptions : undefined;
}

function normalizeQuestionnaire(questionnaire: {
	questions: Array<{
		id: string;
		prompt: string;
		type: string;
		options?: Array<{value: string; label: string}> | null;
	}>;
}): DidacticUnitQuestionnaire {
	const normalizedQuestions = questionnaire.questions.map((question) => {
		const normalizedType = normalizeQuestionType(question.type);
		const normalizedOptions = normalizeQuestionOptions(question.options);

		return {
			id: question.id.trim(),
			prompt: question.prompt.trim(),
			type: normalizedType,
			options:
				normalizedType === "single_select" ? normalizedOptions : (
					undefined
				),
		};
	});

	if (normalizedQuestions.length !== 3) {
		throw new Error(
			`Questionnaire generation returned ${normalizedQuestions.length} questions; expected exactly 3.`,
		);
	}

	const ids = normalizedQuestions.map((question) => question.id);
	if (new Set(ids).size !== ids.length) {
		throw new Error(
			"Questionnaire generation returned duplicate question ids.",
		);
	}

	for (const question of normalizedQuestions) {
		if (
			question.type === "single_select" &&
			(!question.options || question.options.length < 2)
		) {
			throw new Error(
				`Question "${question.id}" must include at least 2 options for single_select.`,
			);
		}
	}

	return {
		questions: normalizedQuestions,
	};
}

function validateReferenceSyllabusLength(
	syllabus: DidacticUnitReferenceSyllabus,
	length: DidacticUnitLength,
): DidacticUnitReferenceSyllabus {
	const expectedModuleCount = resolveTargetChapterCount(length);

	if (syllabus.modules.length < expectedModuleCount) {
		throw new Error(
			`Syllabus generation returned ${syllabus.modules.length} modules; expected exactly ${expectedModuleCount}.`,
		);
	}

	if (syllabus.modules.length === expectedModuleCount) {
		return syllabus;
	}

	return {
		...syllabus,
		modules: syllabus.modules.slice(0, expectedModuleCount),
	};
}

function ensureReferenceSyllabusTopic(
	syllabus: Omit<DidacticUnitReferenceSyllabus, "topic"> & {topic?: string},
	fallbackTopic: string,
): DidacticUnitReferenceSyllabus {
	return {
		...syllabus,
		topic: syllabus.topic?.trim() || fallbackTopic.trim(),
	};
}

export class GatewayAiService implements AiService {
	private readonly gateway;
	private readonly logger;

	constructor(options: GatewayAiServiceOptions = {}) {
		const env = getAppEnv();

		if (!env.aiGatewayApiKey?.trim()) {
			throw new AiGatewayConfigurationError(
				"AI_GATEWAY_API_KEY must be configured before using AI generation.",
			);
		}

		this.gateway = createGateway({
			apiKey: env.aiGatewayApiKey,
			baseURL: env.aiGatewayBaseUrl,
		});
		this.logger =
			options.logger?.child({component: "ai-service"}) ??
			createLogger({
				name: "didactio-backend",
			}).child({component: "ai-service"});
	}

	private selectModel(tier: AiModelTier, config: AiConfig): ModelSelection {
		const tierConfig = this.requireTierConfig(tier, config[tier]);
		return {
			provider: tierConfig.provider,
			model: tierConfig.model,
			modelId: resolveGatewayModelId(tierConfig),
		};
	}

	private requireTierConfig(
		tier: AiModelTier,
		config: AiModelConfig | undefined,
	): AiModelConfig {
		if (!config?.provider?.trim() || !config.model?.trim()) {
			throw new AiGatewayConfigurationError(
				`AI config for ${tier} must include non-empty provider and model values.`,
			);
		}

		return {
			provider: config.provider.trim(),
			model: config.model.trim(),
		};
	}

	private logAiCallStarted(
		stage: AiStageName,
		selection: ModelSelection,
		details: Record<string, unknown>,
	): void {
		this.logger.info("AI call started", {
			stage,
			provider: selection.provider,
			model: selection.model,
			modelId: selection.modelId,
			...details,
		});
	}

	private logAiCallCompleted(
		stage: AiStageName,
		selection: ModelSelection,
		telemetry: AiCallTelemetry,
		details: Record<string, unknown>,
	): void {
		this.logger.info("AI call completed", {
			stage,
			provider: selection.provider,
			model: selection.model,
			modelId: selection.modelId,
			...details,
			...summarizeAiCallTelemetry(telemetry),
		});
	}

	private logAiCallFailed(
		stage: AiStageName,
		selection: ModelSelection,
		details: Record<string, unknown>,
	): void {
		this.logger.error("AI call failed", {
			stage,
			provider: selection.provider,
			model: selection.model,
			modelId: selection.modelId,
			...details,
		});
	}

	private async enrichAiCallTelemetry(
		telemetry: AiCallTelemetry,
	): Promise<AiCallTelemetry> {
		if (!telemetry.gatewayGenerationId) {
			return telemetry;
		}

		try {
			const gatewayInfo = await this.gateway.getGenerationInfo({
				id: telemetry.gatewayGenerationId,
			});

			return enrichAiCallTelemetryWithGatewayInfo(telemetry, gatewayInfo);
		} catch (error) {
			this.logger.warn("AI gateway generation info lookup failed", {
				generationId: telemetry.gatewayGenerationId,
				error,
			});

			return telemetry;
		}
	}

	async classifyFolder(input: {
		topic: string;
		additionalContext?: string;
		folders: Array<{
			name: string;
			description: string;
		}>;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<FolderClassificationResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildFolderClassificationPrompt({
			topic: input.topic,
			additionalContext: input.additionalContext,
			folders: input.folders,
			authoring: input.config.authoring,
		});
		const startedAt = Date.now();

		this.logAiCallStarted("folder_classification", selection, {
			tier: input.tier,
			folderCount: input.folders.length,
			topic: input.topic,
			promptLength: prompt.length,
		});

		try {
			const result = await generateObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("folder_classification"),
				prompt,
				schema: folderClassificationSchema,
				maxOutputTokens: resolveStageMaxOutputTokens(
					"folder_classification",
				),
				abortSignal: input.abortSignal,
			});
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			const finalResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				folderName: result.object.folderName,
				reasoning: result.object.reasoning,
			};

			this.logAiCallCompleted(
				"folder_classification",
				selection,
				telemetry,
				{
					tier: input.tier,
					folderName: finalResult.folderName,
				},
			);

			return finalResult;
		} catch (error) {
			this.logAiCallFailed("folder_classification", selection, {
				tier: input.tier,
				topic: input.topic,
				durationMs: Date.now() - startedAt,
				error,
			});
			throw error;
		}
	}

	async moderateTopic(input: {
		topic: string;
		level: DidacticUnitLevel;
		additionalContext?: string;
		folders?: Array<{
			name: string;
			description: string;
		}>;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<ModerationResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildModerationPrompt({
			topic: input.topic,
			level: input.level,
			additionalContext: input.additionalContext,
			folders: input.folders,
			authoring: input.config.authoring,
		});
		const startedAt = Date.now();

		this.logAiCallStarted("moderation", selection, {
			tier: input.tier,
			topic: input.topic,
			promptLength: prompt.length,
		});

		try {
			const result = await generateObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("moderation"),
				prompt,
				schema: moderationSchema,
				maxOutputTokens: resolveStageMaxOutputTokens("moderation"),
				abortSignal: input.abortSignal,
			});
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			const finalResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				approved: result.object.approved,
				notes: result.object.notes,
				normalizedTopic: result.object.normalizedTopic,
				improvedTopicBrief: result.object.improvedTopicBrief,
				reasoningNotes: result.object.reasoningNotes,
				folderName: result.object.folderName,
				folderReasoning: result.object.folderReasoning,
			};

			this.logAiCallCompleted("moderation", selection, telemetry, {
				tier: input.tier,
				approved: finalResult.approved,
				folderName: finalResult.folderName,
			});

			return finalResult;
		} catch (error) {
			this.logAiCallFailed("moderation", selection, {
				tier: input.tier,
				topic: input.topic,
				durationMs: Date.now() - startedAt,
				error,
			});
			throw error;
		}
	}

	async streamModeration(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			additionalContext?: string;
			folders?: Array<{
				name: string;
				description: string;
			}>;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: StructuredStreamCallbacks<ModerationResult>,
	): Promise<ModerationResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildModerationPrompt({
			topic: input.topic,
			level: input.level,
			additionalContext: input.additionalContext,
			folders: input.folders,
			authoring: input.config.authoring,
		});
		const startedAt = Date.now();

		this.logAiCallStarted("moderation", selection, {
			tier: input.tier,
			topic: input.topic,
			promptLength: prompt.length,
			streaming: true,
		});
		await callbacks.onStart?.(selection);

		try {
			const result = streamObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("moderation"),
				prompt,
				schema: moderationSchema,
				maxOutputTokens: resolveStageMaxOutputTokens("moderation"),
				abortSignal: input.abortSignal,
			});

			for await (const partial of result.partialObjectStream) {
				await callbacks.onPartial?.({
					provider: selection.provider,
					model: selection.model,
					prompt,
					approved: partial.approved,
					notes: partial.notes,
					normalizedTopic: partial.normalizedTopic,
					improvedTopicBrief: partial.improvedTopicBrief,
					reasoningNotes: partial.reasoningNotes,
					folderName: partial.folderName,
					folderReasoning: partial.folderReasoning,
				});
			}

			const object = await result.object;
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			const finalResult: ModerationResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				approved: object.approved,
				notes: object.notes,
				normalizedTopic: object.normalizedTopic,
				improvedTopicBrief: object.improvedTopicBrief,
				reasoningNotes: object.reasoningNotes,
				folderName: object.folderName,
				folderReasoning: object.folderReasoning,
			};

			this.logAiCallCompleted("moderation", selection, telemetry, {
				tier: input.tier,
				approved: finalResult.approved,
				folderName: finalResult.folderName,
				streaming: true,
			});

			await callbacks.onComplete?.(finalResult);
			return finalResult;
		} catch (error) {
			this.logAiCallFailed("moderation", selection, {
				tier: input.tier,
				topic: input.topic,
				durationMs: Date.now() - startedAt,
				streaming: true,
				error,
			});
			throw error;
		}
	}

	async generateQuestionnaire(input: {
		topic: string;
		level: DidacticUnitLevel;
		improvedTopicBrief?: string;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<QuestionnaireResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildQuestionnairePrompt({
			topic: input.topic,
			level: input.level,
			improvedTopicBrief: input.improvedTopicBrief,
			authoring: input.config.authoring,
		});
		const startedAt = Date.now();

		this.logAiCallStarted("questionnaire", selection, {
			tier: input.tier,
			topic: input.topic,
			promptLength: prompt.length,
		});

		try {
			const result = await generateObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("questionnaire"),
				prompt,
				schema: questionnaireSchema,
				maxOutputTokens: resolveStageMaxOutputTokens("questionnaire"),
				abortSignal: input.abortSignal,
			});
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			const finalResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				questionnaire: normalizeQuestionnaire(result.object),
			};

			this.logAiCallCompleted("questionnaire", selection, telemetry, {
				tier: input.tier,
				questionCount: finalResult.questionnaire.questions.length,
			});

			return finalResult;
		} catch (error) {
			this.logAiCallFailed("questionnaire", selection, {
				tier: input.tier,
				topic: input.topic,
				durationMs: Date.now() - startedAt,
				error,
			});
			throw error;
		}
	}

	async streamQuestionnaire(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			improvedTopicBrief?: string;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: StructuredStreamCallbacks<QuestionnaireResult>,
	): Promise<QuestionnaireResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildQuestionnairePrompt({
			topic: input.topic,
			level: input.level,
			improvedTopicBrief: input.improvedTopicBrief,
			authoring: input.config.authoring,
		});
		const startedAt = Date.now();

		this.logAiCallStarted("questionnaire", selection, {
			tier: input.tier,
			topic: input.topic,
			promptLength: prompt.length,
			streaming: true,
		});
		await callbacks.onStart?.(selection);

		try {
			const result = streamObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("questionnaire"),
				prompt,
				schema: questionnaireSchema,
				maxOutputTokens: resolveStageMaxOutputTokens("questionnaire"),
				abortSignal: input.abortSignal,
			});

			for await (const partial of result.partialObjectStream) {
				await callbacks.onPartial?.({
					provider: selection.provider,
					model: selection.model,
					prompt,
					questionnaire: partial as DidacticUnitQuestionnaire,
				});
			}

			const object = await result.object;
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			const finalResult: QuestionnaireResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				questionnaire: normalizeQuestionnaire(object),
			};

			this.logAiCallCompleted("questionnaire", selection, telemetry, {
				tier: input.tier,
				questionCount: finalResult.questionnaire.questions.length,
				streaming: true,
			});

			await callbacks.onComplete?.(finalResult);
			return finalResult;
		} catch (error) {
			this.logAiCallFailed("questionnaire", selection, {
				tier: input.tier,
				topic: input.topic,
				durationMs: Date.now() - startedAt,
				streaming: true,
				error,
			});
			throw error;
		}
	}

	async generateSyllabus(input: {
		topic: string;
		level: DidacticUnitLevel;
		improvedTopicBrief?: string;
		syllabusPrompt: string;
		questionnaireAnswers?: DidacticUnitQuestionAnswer[];
		depth: DidacticUnitDepth;
		length: DidacticUnitLength;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<SyllabusResult> {
		return this.streamSyllabus(input, {});
	}

	async streamSyllabus(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			improvedTopicBrief?: string;
			syllabusPrompt: string;
			questionnaireAnswers?: DidacticUnitQuestionAnswer[];
			depth: DidacticUnitDepth;
			length: DidacticUnitLength;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: StructuredStreamCallbacks<SyllabusResult>,
	): Promise<SyllabusResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildSyllabusMarkdownPrompt({
			topic: input.topic,
			level: input.level,
			improvedTopicBrief: input.improvedTopicBrief,
			syllabusPrompt: input.syllabusPrompt,
			questionnaireAnswers: input.questionnaireAnswers,
			authoring: input.config.authoring,
			depth: input.depth,
			length: input.length,
		});
		const startedAt = Date.now();

		this.logAiCallStarted("syllabus", selection, {
			tier: input.tier,
			topic: input.topic,
			length: input.length,
			depth: input.depth,
			promptLength: prompt.length,
			streaming: true,
		});
		await callbacks.onStart?.(selection);

		try {
			const result = streamObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("syllabus"),
				prompt,
				schema: syllabusSchema,
				maxOutputTokens: resolveStageMaxOutputTokens(
					"syllabus",
					input.length,
				),
				abortSignal: input.abortSignal,
			});

			for await (const partial of result.partialObjectStream) {
				await callbacks.onPartial?.({
					provider: selection.provider,
					model: selection.model,
					prompt,
					syllabus: partial as DidacticUnitReferenceSyllabus,
				});
			}

			const object = await result.object;
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			const finalResult: SyllabusResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				syllabus: validateReferenceSyllabusLength(
					ensureReferenceSyllabusTopic(object, input.topic),
					input.length,
				),
			};

			this.logAiCallCompleted("syllabus", selection, telemetry, {
				tier: input.tier,
				chapterCount: finalResult.syllabus.modules.length,
				streaming: true,
			});

			await callbacks.onComplete?.(finalResult);
			return finalResult;
		} catch (error) {
			this.logAiCallFailed("syllabus", selection, {
				tier: input.tier,
				topic: input.topic,
				length: input.length,
				depth: input.depth,
				durationMs: Date.now() - startedAt,
				streaming: true,
				error,
			});
			throw error;
		}
	}

	async generateSummary(input: {
		topic: string;
		chapterTitle: string;
		chapterMarkdown: string;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
		kind?: "continuity" | "learner";
	}): Promise<SummaryResult> {
		return this.streamSummary(input, {});
	}

	async streamSummary(
		input: {
			topic: string;
			chapterTitle: string;
			chapterMarkdown: string;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
			kind?: "continuity" | "learner";
		},
		callbacks: MarkdownStreamCallbacks<SummaryResult>,
	): Promise<SummaryResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildLearnerSummaryPrompt({
			topic: input.topic,
			chapterTitle: input.chapterTitle,
			chapterMarkdown: input.chapterMarkdown,
			authoring: input.config.authoring,
		});
		let markdown = "";
		const startedAt = Date.now();
		const maxOutputTokens = resolveStageMaxOutputTokens("summary");

		this.logAiCallStarted("summary", selection, {
			tier: input.tier,
			topic: input.topic,
			moduleTitle: input.chapterTitle,
			promptLength: prompt.length,
			kind: input.kind ?? "learner",
			streaming: true,
			maxOutputTokens,
		});
		await callbacks.onStart?.(selection);

		try {
			const result = streamText({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("summary"),
				prompt,
				maxOutputTokens,
				abortSignal: input.abortSignal,
				onChunk: async ({chunk}) => {
					if (chunk.type !== "text-delta") {
						return;
					}

					markdown += chunk.text;
					await callbacks.onMarkdown?.(chunk.text, markdown);
				},
			});

			const finalMarkdown = await result.text;
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			const finalResult: SummaryResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				markdown: finalMarkdown,
			};

			this.logAiCallCompleted("summary", selection, telemetry, {
				tier: input.tier,
				moduleTitle: input.chapterTitle,
				kind: input.kind ?? "learner",
				markdownLength: finalMarkdown.length,
				streaming: true,
				maxOutputTokens,
			});

			await callbacks.onComplete?.(finalResult);
			return finalResult;
		} catch (error) {
			this.logAiCallFailed("summary", selection, {
				tier: input.tier,
				topic: input.topic,
				moduleTitle: input.chapterTitle,
				kind: input.kind ?? "learner",
				durationMs: Date.now() - startedAt,
				streaming: true,
				error,
			});
			throw error;
		}
	}

	async generateChapter(input: {
		topic: string;
		level: DidacticUnitLevel;
		syllabus: DidacticUnitReferenceSyllabus;
		chapterIndex: number;
		questionnaireAnswers?: DidacticUnitQuestionAnswer[];
		continuitySummaries?: string[];
		depth: DidacticUnitDepth;
		length: DidacticUnitLength;
		additionalContext?: string;
		instruction?: string;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<ChapterResult> {
		return this.streamChapter(input, {});
	}

	async streamChapter(
		input: {
			topic: string;
			level: DidacticUnitLevel;
			syllabus: DidacticUnitReferenceSyllabus;
			chapterIndex: number;
			questionnaireAnswers?: DidacticUnitQuestionAnswer[];
			continuitySummaries?: string[];
			depth: DidacticUnitDepth;
			length: DidacticUnitLength;
			additionalContext?: string;
			instruction?: string;
			config: AiConfig;
			tier: AiModelTier;
			abortSignal?: AbortSignal;
		},
		callbacks: MarkdownStreamCallbacks<ChapterResult>,
	): Promise<ChapterResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildChapterHtmlPrompt({
			topic: input.topic,
			level: input.level,
			syllabus: input.syllabus,
			chapterIndex: input.chapterIndex,
			questionnaireAnswers: input.questionnaireAnswers,
			continuitySummaries: input.continuitySummaries,
			additionalContext: input.additionalContext,
			instruction: input.instruction,
			authoring: input.config.authoring,
			depth: input.depth,
			length: input.length,
		});
		let html = "";
		const startedAt = Date.now();
		const maxOutputTokens = resolveStageMaxOutputTokens(
			"chapter",
			input.length,
		);

		this.logAiCallStarted("module", selection, {
			tier: input.tier,
			topic: input.topic,
			moduleIndex: input.chapterIndex,
			moduleTitle: input.syllabus.modules[input.chapterIndex]?.title,
			length: input.length,
			depth: input.depth,
			promptLength: prompt.length,
			streaming: true,
			maxOutputTokens,
		});
		await callbacks.onStart?.(selection);

		try {
			const result = streamText({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("chapter"),
				prompt,
				maxOutputTokens,
				abortSignal: input.abortSignal,
				onChunk: async ({chunk}) => {
					if (chunk.type !== "text-delta") {
						return;
					}

					html += chunk.text;
					await callbacks.onHtml?.(chunk.text, html);
					await callbacks.onMarkdown?.(chunk.text, html);
				},
			});

			const finalHtml = await result.text;
			const chapter = createCanonicalDidacticUnitChapter({
				chapterIndex: input.chapterIndex,
				chapterId: `${input.topic}:${input.chapterIndex}`,
				title:
					input.syllabus.modules[input.chapterIndex]?.title ??
					`Module ${input.chapterIndex + 1}`,
				rawHtml: finalHtml,
			});
			const continuitySummary = extractContinuitySummary(chapter.html);
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);

			const finalResult: ChapterResult = {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				html: finalHtml,
				continuitySummary,
				chapter,
			};

			this.logAiCallCompleted("module", selection, telemetry, {
				tier: input.tier,
				moduleIndex: input.chapterIndex,
				moduleTitle: finalResult.chapter.title,
				htmlLength: finalHtml.length,
				normalizedHtmlLength: chapter.html.length,
				streaming: true,
				maxOutputTokens,
			});

			await callbacks.onComplete?.(finalResult);
			return finalResult;
		} catch (error) {
			this.logAiCallFailed("module", selection, {
				tier: input.tier,
				topic: input.topic,
				moduleIndex: input.chapterIndex,
				length: input.length,
				depth: input.depth,
				durationMs: Date.now() - startedAt,
				streaming: true,
				error,
			});
			throw error;
		}
	}
}
