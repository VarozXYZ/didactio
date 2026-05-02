import type {PresentationTheme} from "../types/presentationTheme";

export type DashboardSection =
	| "all-units"
	| "subscription"
	| "profile"
	| "security"
	| "preferences"
	| "analytics";

export type DashboardItemKind = "didacticUnit";

export interface DashboardFolderSummary {
	id: string;
	name: string;
	slug: string;
	icon: string;
	color: string;
	kind: "default" | "custom";
}

export interface DashboardFolder {
	id: string;
	name: string;
	slug: string;
	icon: string;
	color: string;
	kind: "default" | "custom";
	units: string[];
	unitCount: number;
}

export interface DashboardListItem {
	kind: DashboardItemKind;
	id: string;
	title: string;
	subtitle: string;
	folder: DashboardFolderSummary;
	status: string;
	primaryProgressPercent: number;
	studyProgressPercent?: number;
	chapterCount: number;
	lastActivityAt: string;
	coverColor: string;
	canOpenEditor: boolean;
	didacticUnitId?: string;
	route: string;
}

export type PlanningQuestionType = "single_select" | "long_text";

export interface PlanningQuestionOption {
	value: string;
	label: string;
}

export interface PlanningQuestion {
	id: string;
	prompt: string;
	type: PlanningQuestionType;
	options?: PlanningQuestionOption[];
}

export interface PlanningSyllabusChapter {
	title: string;
	overview: string;
	keyPoints: string[];
	lessons: PlanningSyllabusLesson[];
}

export interface PlanningSyllabusLesson {
	title: string;
	contentOutline: string[];
}

export interface PlanningSyllabus {
	title: string;
	overview: string;
	learningGoals: string[];
	keywords: string[];
	chapters: PlanningSyllabusChapter[];
}

export interface PlanningDetailViewModel {
	id: string;
	topic: string;
	folder: DashboardFolderSummary;
	provider: string;
	status: string;
	nextAction: string;
	progressPercent: number;
	lastActivityAt: string;
	additionalContext?: string;
	improvedTopicBrief?: string;
	reasoningNotes?: string;
	level: "beginner" | "intermediate" | "advanced";
	depth: "basic" | "intermediate" | "technical";
	length: "intro" | "short" | "long" | "textbook";
	generationQuality?: "silver" | "gold";
	questionnaireEnabled: boolean;
	questionnaire?: {
		questions: PlanningQuestion[];
		answers: Record<string, string>;
	};
	syllabusPrompt?: string;
	syllabus?: PlanningSyllabus;
	didacticUnitId?: string;
	handoff?: {
		didacticUnitId: string;
		nextRoute: string;
	};
}

export type EditorChapterStatus = "pending" | "ready" | "failed";

export interface EditorTextStyle {
	sizeProfile: "small" | "regular" | "large";
	bodyFontFamily: string; // FontId from typography.ts
	headingFontFamily: string; // FontId from typography.ts
	paragraphAlign: "left" | "center" | "right" | "justify";
}

export interface DidacticUnitEditorChapter {
	chapterIndex: number;
	title: string;
	status: EditorChapterStatus;
	summary: string;
	readingTime: string;
	html: string | null;
	htmlHash?: string;
	htmlBlocks: HtmlContentBlock[];
	htmlBlocksVersion: number;
	readBlockIndex: number;
	readBlockOffset?: number;
	readBlocksVersion: number;
	totalBlocks: number;
	learningGoals: string[];
	keyPoints: string[];
	level: string;
	effort: string;
	isCompleted: boolean;
	completedAt?: string;
	lastVisitedPageIndex?: number;
	textStyle: EditorTextStyle;
}

export interface HtmlContentBlock {
	id: string;
	type:
		| "heading"
		| "paragraph"
		| "blockquote"
		| "list"
		| "table"
		| "code"
		| "divider";
	html: string;
	textLength: number;
	textStartOffset: number;
	textEndOffset: number;
}

export interface DidacticUnitEditorViewModel {
	id: string;
	title: string;
	folder: DashboardFolderSummary;
	progress: number;
	lastEdited: string;
	coverColor: string;
	status: string;
	overview: string;
	provider: string;
	generationQuality?: "silver" | "gold";
	presentationTheme: PresentationTheme | null;
	chapters: DidacticUnitEditorChapter[];
}

export interface DidacticUnitRevisionViewModel {
	id: string;
	chapterIndex: number;
	source: "ai_generation" | "ai_regeneration" | "manual_edit";
	createdAt: string;
	title: string;
	chapter: {
		title: string;
		html: string;
		htmlHash: string;
	};
}
