import type express from "express";
import type {HtmlContentBlock} from "../didactic-unit/didactic-unit-chapter.js";

export type NdjsonEvent =
	| {type: "start"; stage: string; provider: string; model: string}
	| {type: "partial_html_block"; block: HtmlContentBlock}
	| {type: "partial_structured"; data: unknown}
	| {type: "complete"; data: unknown}
	| {type: "error"; message: string; data?: unknown};

export function openNdjsonStream(response: express.Response): void {
	response.status(200);
	response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
	response.setHeader("Cache-Control", "no-store");
	response.setHeader("X-Accel-Buffering", "no");
}

export function writeNdjsonEvent(
	response: express.Response,
	event: NdjsonEvent,
): void {
	response.write(`${JSON.stringify(event)}\n`);
}
