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

export interface ICourse extends Document {
  status: CourseStatus;
  provider: AIProvider;
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
