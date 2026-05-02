import {createHash} from "node:crypto";

export function computeHtmlHash(html: string): string {
	return createHash("sha256").update(html).digest("hex");
}
