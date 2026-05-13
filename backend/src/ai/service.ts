import {createGateway, generateObject, streamObject, streamText} from "ai";
import {z} from "zod";
import {getAppEnv} from "../config/env.js";
import type {DidacticUnitGeneratedChapter} from "../didactic-unit/didactic-unit-chapter.js";
import {createLogger, type Logger} from "../logging/logger.js";
import type {
	DidacticUnitDepth,
	DidacticUnitLength,
	DidacticUnitLevel,
	DidacticUnitQuestionAnswer,
	DidacticUnitReferenceSyllabus,
} from "../didactic-unit/planning.js";
import type {AiConfig, AiModelConfig, AiModelTier} from "./config.js";
import {resolveGatewayModelId} from "./config.js";
import {
	buildFolderClassificationPrompt,
	buildChapterHtmlPrompt,
	buildGatewaySystemPrompt,
	buildLearningActivityFeedbackPrompt,
	buildLearningActivityPrompt,
	buildLearnerSummaryPrompt,
	buildModerationPrompt,
	resolveTargetChapterCount,
	buildSyllabusMarkdownPrompt,
} from "./prompt-builders.js";
import {
	folderClassificationSchema,
	learningActivityFeedbackSchema,
	learningActivitySchema,
	moderationSchema,
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
import type {
	LearningActivityScope,
	LearningActivityType,
} from "../activities/learning-activity.js";

export class AiGatewayConfigurationError extends Error {}

interface ModelSelection {
	provider: string;
	model: string;
	modelId: string;
}

const MODERATION_MODEL_SELECTION: ModelSelection = {
	provider: "openai",
	model: "gpt-oss-20b",
	modelId: "openai/gpt-oss-20b",
};

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
	stylePreset?: "modern" | "modern" | "classic" | "classic" | "plain";
}

export interface FolderClassificationResult extends BaseStageResult {
	folderName: string;
	reasoning: string;
	stylePreset?: "modern" | "modern" | "classic" | "classic" | "plain";
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

export interface LearningActivityResult extends BaseStageResult {
	title: string;
	instructions: string;
	dedupeSummary: string;
	content: Record<string, unknown>;
	raw: unknown;
}

export interface LearningActivityFeedbackResult extends BaseStageResult {
	score?: number;
	feedback: string;
	strengths: string[];
	improvements: string[];
}

type AiStageName =
	| "folder_classification"
	| "moderation"
	| "syllabus"
	| "summary"
	| "module"
	| "activity"
	| "activity_feedback";

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
	generateLearningActivity(input: {
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
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<LearningActivityResult>;
	generateLearningActivityFeedback(input: {
		activityTitle: string;
		activityType: LearningActivityType;
		instructions: string;
		content: Record<string, unknown>;
		answers: unknown;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<LearningActivityFeedbackResult>;
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
		| "syllabus"
		| "summary"
		| "chapter"
		| "activity"
		| "activity_feedback",
	length?: DidacticUnitLength,
): number {
	switch (stage) {
		case "folder_classification":
		case "moderation":
			return 1200;
		case "summary":
			return 1000;
		case "activity_feedback":
			return 1600;
		case "activity":
			return 4500;
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

	private selectModerationModel(): ModelSelection {
		return MODERATION_MODEL_SELECTION;
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
				stylePreset: result.object.stylePreset,
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
		const selection = this.selectModerationModel();
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
			modelPolicy: "fixed_fast_moderation",
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
				stylePreset: result.object.stylePreset,
			};

			this.logAiCallCompleted("moderation", selection, telemetry, {
				tier: input.tier,
				modelPolicy: "fixed_fast_moderation",
				approved: finalResult.approved,
				folderName: finalResult.folderName,
			});

			return finalResult;
		} catch (error) {
			this.logAiCallFailed("moderation", selection, {
				tier: input.tier,
				modelPolicy: "fixed_fast_moderation",
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
		const selection = this.selectModerationModel();
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
			modelPolicy: "fixed_fast_moderation",
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
				modelPolicy: "fixed_fast_moderation",
				approved: finalResult.approved,
				folderName: finalResult.folderName,
				streaming: true,
			});

			await callbacks.onComplete?.(finalResult);
			return finalResult;
		} catch (error) {
			this.logAiCallFailed("moderation", selection, {
				tier: input.tier,
				modelPolicy: "fixed_fast_moderation",
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

	async generateLearningActivity(input: {
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
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<LearningActivityResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildLearningActivityPrompt({
			topic: input.topic,
			moduleTitle: input.moduleTitle,
			scope: input.scope,
			type: input.type,
			contextModules: input.contextModules,
			previousActivities: input.previousActivities,
			authoring: input.config.authoring,
		});
		const startedAt = Date.now();
		const maxOutputTokens = resolveStageMaxOutputTokens("activity");

		this.logAiCallStarted("activity", selection, {
			tier: input.tier,
			topic: input.topic,
			moduleTitle: input.moduleTitle,
			type: input.type,
			scope: input.scope,
			promptLength: prompt.length,
			maxOutputTokens,
		});

		try {
			const result = await generateObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("activity"),
				prompt,
				schema: learningActivitySchema,
				maxOutputTokens,
				abortSignal: input.abortSignal,
			});
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			this.logAiCallCompleted("activity", selection, telemetry, {
				tier: input.tier,
				type: input.type,
				scope: input.scope,
			});

			return {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				title: result.object.title,
				instructions: result.object.instructions,
				dedupeSummary: result.object.dedupeSummary,
				content: result.object.content,
				raw: result.object,
			};
		} catch (error) {
			this.logAiCallFailed("activity", selection, {
				tier: input.tier,
				topic: input.topic,
				type: input.type,
				scope: input.scope,
				durationMs: Date.now() - startedAt,
				error,
			});
			throw error;
		}
	}

	async generateLearningActivityFeedback(input: {
		activityTitle: string;
		activityType: LearningActivityType;
		instructions: string;
		content: Record<string, unknown>;
		answers: unknown;
		config: AiConfig;
		tier: AiModelTier;
		abortSignal?: AbortSignal;
	}): Promise<LearningActivityFeedbackResult> {
		const selection = this.selectModel(input.tier, input.config);
		const prompt = buildLearningActivityFeedbackPrompt(input);
		const startedAt = Date.now();
		const maxOutputTokens = resolveStageMaxOutputTokens("activity_feedback");

		this.logAiCallStarted("activity_feedback", selection, {
			tier: input.tier,
			activityType: input.activityType,
			promptLength: prompt.length,
			maxOutputTokens,
		});

		try {
			const result = await generateObject({
				model: this.gateway(selection.modelId),
				system: buildGatewaySystemPrompt("activity_feedback"),
				prompt,
				schema: learningActivityFeedbackSchema,
				maxOutputTokens,
				abortSignal: input.abortSignal,
			});
			const telemetry = await this.enrichAiCallTelemetry(
				await collectAiCallTelemetry(result, Date.now() - startedAt),
			);
			this.logAiCallCompleted("activity_feedback", selection, telemetry, {
				tier: input.tier,
				activityType: input.activityType,
			});

			return {
				provider: selection.provider,
				model: selection.model,
				prompt,
				telemetry,
				score: result.object.score,
				feedback: result.object.feedback,
				strengths: result.object.strengths,
				improvements: result.object.improvements,
			};
		} catch (error) {
			this.logAiCallFailed("activity_feedback", selection, {
				tier: input.tier,
				activityType: input.activityType,
				durationMs: Date.now() - startedAt,
				error,
			});
			throw error;
		}
	}
}
