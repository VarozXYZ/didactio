import mongoose, { Schema, Document } from "mongoose";
import { Syllabus, Module } from "./schemas/syllabus.schema.js";

export type CourseStatus =
  | "draft"
  | "filtering_prompt"
  | "generating_syllabus"
  | "generating_content"
  | "ready"
  | "error";

export type AIProvider = "deepseek" | "openai";

export type ContentLength = "intro" | "short" | "long" | "textbook";

export type Tone = "friendly" | "neutral" | "professional";

export type Technicality = "basic" | "intermediate" | "technical";

export const CONTENT_LENGTH_TOKENS: Record<ContentLength, number> = {
  intro: 1000,
  short: 6000,
  long: 15000,
  textbook: 32000,
};

export const CONTENT_LENGTH_LABELS: Record<ContentLength, string> = {
  intro: "Introduction",
  short: "Short course",
  long: "Long course",
  textbook: "Textbook",
};

export const TONE_INSTRUCTIONS: Record<Tone, string> = {
  friendly: "Use a warm, conversational tone. Include occasional light humor and relatable everyday examples. Make the reader feel like they're learning from a knowledgeable friend.",
  neutral: "Use standard educational language. Be clear, factual, and balanced. Focus on delivering information effectively without strong stylistic flourishes.",
  professional: "Use formal academic language. Be precise and authoritative. Maintain a scholarly tone appropriate for professional or academic contexts.",
};

export const TECHNICALITY_INSTRUCTIONS: Record<Technicality, string> = {
  basic: "Avoid technical jargon entirely. When technical terms are unavoidable, immediately provide a simple explanation. Use many analogies to everyday situations. Break down complex concepts into very simple parts. Assume no prior knowledge.",
  intermediate: "Technical terminology is acceptable but should be accompanied by brief explanations or analogies for complex concepts. Balance depth with accessibility. Assume basic familiarity with the field.",
  technical: "Use full technical vocabulary and in-depth explanations. Assume the reader has solid domain knowledge. Focus on precision and completeness over simplicity.",
};

export interface ICourse extends Document {
  status: CourseStatus;
  provider: AIProvider;
  contentLength: ContentLength;
  tone: Tone;
  technicality: Technicality;
  language: string;
  additionalContext?: string;
  originalPrompt: string;
  improvedPrompt?: string;
  level: string;
  syllabus?: Syllabus;
  modules: Array<Module & { generatedContent?: string; summary?: string }>;
  iterationSummaries: string[];
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema({
  title: { type: String, required: true },
  content_outline: [{ type: String }],
  content: { type: String },
});

const moduleSchema = new Schema({
  title: { type: String, required: true },
  overview: { type: String },
  estimated_duration_minutes: { type: Number },
  lessons: [lessonSchema],
  generatedContent: { type: String },
  summary: { type: String },
});

const syllabusSchema = new Schema({
  topic: { type: String, required: true },
  title: { type: String, required: true },
  keywords: { type: String },
  description: { type: String },
  total_duration_minutes: { type: Number },
  modules: [moduleSchema],
});

const courseSchema = new Schema<ICourse>(
  {
    status: {
      type: String,
      enum: [
        "draft",
        "filtering_prompt",
        "generating_syllabus",
        "generating_content",
        "ready",
        "error",
      ],
      default: "draft",
    },
    provider: {
      type: String,
      enum: ["deepseek", "openai"],
      default: "deepseek",
    },
    contentLength: {
      type: String,
      enum: ["intro", "short", "long", "textbook"],
      default: "short",
    },
    tone: {
      type: String,
      enum: ["friendly", "neutral", "professional"],
      default: "neutral",
    },
    technicality: {
      type: String,
      enum: ["basic", "intermediate", "technical"],
      default: "intermediate",
    },
    language: {
      type: String,
      default: "Spanish",
    },
    additionalContext: { type: String },
    originalPrompt: { type: String, required: true },
    improvedPrompt: { type: String },
    level: { type: String, required: true },
    syllabus: syllabusSchema,
    modules: [moduleSchema],
    iterationSummaries: [{ type: String }],
    errorMessage: { type: String },
  },
  { timestamps: true }
);

export const Course = mongoose.model<ICourse>("Course", courseSchema);
