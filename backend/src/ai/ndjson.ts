import type express from "express";

export type NdjsonEvent =
	| {type: "start"; stage: string; provider: string; model: string}
	| {type: "partial_markdown"; delta: string; markdown: string}
	| {type: "partial_structured"; data: unknown}
	| {type: "complete"; data: unknown}
	| {type: "error"; message: string};

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
