import {
	learningActivityFeedbackSchema,
	learningActivitySchema,
	moderationSchema,
} from "./schemas.js";

function extractBalancedJsonObjects(text: string): string[] {
	const candidates: string[] = [];
	for (let start = 0; start < text.length; start += 1) {
		if (text[start] !== "{") continue;
		let depth = 0;
		let inString = false;
		let escaped = false;
		for (let index = start; index < text.length; index += 1) {
			const char = text[index];
			if (inString) {
				if (escaped) escaped = false;
				else if (char === "\\") escaped = true;
				else if (char === '"') inString = false;
				continue;
			}
			if (char === '"') {
				inString = true;
				continue;
			}
			if (char === "{") depth += 1;
			else if (char === "}") {
				depth -= 1;
				if (depth === 0) {
					candidates.push(text.slice(start, index + 1));
					break;
				}
			}
		}
	}
	return candidates;
}

function completeJsonObjectPrefix(text: string): string | null {
	const start = text.indexOf("{");
	if (start === -1) return null;
	const stack: string[] = [];
	let inString = false;
	let escaped = false;
	let output = "";

	for (let index = start; index < text.length; index += 1) {
		const char = text[index];
		if (inString) {
			if (escaped) {
				output += char;
				escaped = false;
				continue;
			}
			if (char === "\\") {
				output += char;
				escaped = true;
				continue;
			}
			if (char === '"') {
				output += char;
				inString = false;
				continue;
			}
			output += char === "\n" || char === "\r" ? " " : char;
			continue;
		}
		if (char === '"') {
			output += char;
			inString = true;
			continue;
		}
		if (char === "{") {
			stack.push("}");
			output += char;
			continue;
		}
		if (char === "[") {
			stack.push("]");
			output += char;
			continue;
		}
		if (char === "}" || char === "]") {
			if (stack.at(-1) !== char) break;
			stack.pop();
			output += char;
			if (stack.length === 0) return output;
			continue;
		}
		output += char;
	}

	if (!output || stack.length === 0) return null;
	return `${output}${inString ? '"' : ""}${stack.reverse().join("")}`;
}

export function repairLearningActivityJsonText(text: string): string | null {
	const normalized = text.replace(/<ï½œendâ–ofâ–thinkingï½œ>/g, "");
	for (const candidate of extractBalancedJsonObjects(normalized)) {
		try {
			const validation = learningActivitySchema.safeParse(JSON.parse(candidate));
			if (validation.success) return JSON.stringify(validation.data);
		} catch {
			// Try the next balanced object.
		}
	}
	return null;
}

export function repairLearningActivityFeedbackJsonText(text: string): string | null {
	const normalized = text.replace(/<ï½œendâ–ofâ–thinkingï½œ>/g, "");
	for (const candidate of extractBalancedJsonObjects(normalized)) {
		try {
			const validation = learningActivityFeedbackSchema.safeParse(JSON.parse(candidate));
			if (validation.success) return JSON.stringify(validation.data);
		} catch {
			// Try the next balanced object.
		}
	}
	return null;
}

export function repairModerationJsonText(text: string): string | null {
	const normalized = text.replace(/<Ã¯Â½Å“endÃ¢â€“ÂofÃ¢â€“ÂthinkingÃ¯Â½Å“>/g, "");
	const candidates = [
		...extractBalancedJsonObjects(normalized),
		completeJsonObjectPrefix(normalized),
	].filter((candidate): candidate is string => Boolean(candidate));

	for (const candidate of candidates) {
		try {
			const parsed = JSON.parse(candidate) as Record<string, unknown>;
			for (const key of ["notes", "folderName", "folderReasoning", "normalizedTopic", "normalizedTopicTitle"]) {
				if (typeof parsed[key] === "string" && !parsed[key].trim()) delete parsed[key];
			}
			const validation = moderationSchema.safeParse(parsed);
			if (validation.success) return JSON.stringify(validation.data);
		} catch {
			// Try the next candidate.
		}
	}
	return null;
}
