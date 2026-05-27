import {beforeEach, describe, expect, it, vi} from "vitest";
import {authClient} from "@/auth/authClient";
import {DashboardApiError, dashboardApi, getDashboardErrorMessage} from "@/dashboard/api/dashboardApi";

vi.mock("@/auth/authClient", () => ({
	authClient: {
		authorizedFetch: vi.fn(),
	},
}));

const authorizedFetch = vi.mocked(authClient.authorizedFetch);

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {"Content-Type": "application/json"},
	});
}

describe("dashboard API", () => {
	beforeEach(() => {
		authorizedFetch.mockReset();
		authorizedFetch.mockImplementation(async () => jsonResponse({ok: true}));
	});

	it("formats public dashboard errors", () => {
		expect(getDashboardErrorMessage(new DashboardApiError("Bad", 400), "Fallback")).toBe("Bad");
		expect(getDashboardErrorMessage(new Error("Broken"), "Fallback")).toBe("Broken");
		expect(getDashboardErrorMessage("unknown", "Fallback")).toBe("Fallback");
	});

	it("issues reads and mutations at their intended endpoints", async () => {
		const calls: Array<Promise<unknown>> = [
			dashboardApi.listFolders(),
			dashboardApi.getBillingPricing(),
			dashboardApi.getBillingSummary(),
			dashboardApi.getUsageAnalytics("30d"),
			dashboardApi.createBillingCheckoutSession("prod"),
			dashboardApi.createBillingPortalSession(),
			dashboardApi.createFolder({name: "Math", icon: "atom", color: "#123456"}),
			dashboardApi.updateFolder("folder", {name: "Science"}),
			dashboardApi.deleteFolder("folder"),
			dashboardApi.listDidacticUnits(),
			dashboardApi.createDidacticUnit({topic: "Topic", length: "short"}),
			dashboardApi.getAiConfig(),
			dashboardApi.getAiConfigCatalog(),
			dashboardApi.updateAiConfig({} as never),
			dashboardApi.getDidacticUnit("unit"),
			dashboardApi.updateDidacticUnitFolder("unit", {mode: "manual", folderId: "folder"}),
			dashboardApi.updateDidacticUnitTheme("unit", null),
			dashboardApi.moderateDidacticUnit("unit"),
			dashboardApi.answerDidacticUnitQuestionnaire("unit", [{questionId: "q", value: "a"}]),
			dashboardApi.generateDidacticUnitSyllabusPrompt("unit"),
			dashboardApi.updateDidacticUnitSyllabus("unit", {} as never),
			dashboardApi.approveDidacticUnitSyllabus("unit", "silver"),
			dashboardApi.listDidacticUnitChapters("unit"),
			dashboardApi.getDidacticUnitChapter("unit", 1),
			dashboardApi.listDidacticUnitNotes("unit"),
			dashboardApi.createDidacticUnitNote("unit", {} as never),
			dashboardApi.generateDidacticUnitNote("unit", {} as never),
			dashboardApi.updateDidacticUnitNote("unit", "note", {content: "x"}),
			dashboardApi.deleteDidacticUnitNote("unit", "note"),
			dashboardApi.listLearningActivities("unit", 0),
			dashboardApi.createLearningActivity("unit", 0, {scope: "current_module", type: "cloze", quality: "silver"}),
			dashboardApi.deleteLearningActivity("activity"),
			dashboardApi.listLearningActivityAttempts("activity"),
			dashboardApi.refillActivityAttempts("activity"),
			dashboardApi.createLearningActivityAttempt("activity", {answer: true}),
			dashboardApi.getActivityProgress("activity"),
			dashboardApi.saveActivityProgress("activity", {confirmedAnswers: {}, completed: true}),
			dashboardApi.updateDidacticUnitChapter("unit", 0, {title: "Chapter"}),
			dashboardApi.createGenerationRun("unit", 0),
			dashboardApi.getGenerationRun("run"),
			dashboardApi.cancelGenerationRun("run"),
			dashboardApi.completeDidacticUnitChapter("unit", 0),
			dashboardApi.markDidacticUnitChapterUnread("unit", 0),
			dashboardApi.updateDidacticUnitReadingProgress("unit", 0, {readBlockIndex: 1}, 2),
			dashboardApi.listDidacticUnitChapterRevisions("unit", 0),
			dashboardApi.listDidacticUnitRuns("unit"),
			dashboardApi.deleteDidacticUnit("unit"),
		];
		await Promise.all(calls);

		const requestedPaths = authorizedFetch.mock.calls.map(([path]) => path);
		expect(requestedPaths).toContain("/api/folders");
		expect(requestedPaths).toContain("/api/analytics/usage?period=30d");
		expect(requestedPaths).toContain("/api/didactic-unit/unit/modules/0/reading-progress");
		expect(requestedPaths).toContain("/api/generation-runs/run/cancel");
		expect(authorizedFetch.mock.calls.find(([path]) => path === "/api/folders/folder")?.[1]).toMatchObject({
			method: "PATCH",
		});
	});

	it("maps failed, unauthenticated, empty, and unreachable requests to domain errors", async () => {
		authorizedFetch.mockResolvedValueOnce(jsonResponse({error: "bad_input", message: "Fix input"}, 422));
		await expect(dashboardApi.listFolders()).rejects.toMatchObject({
			message: "Fix input",
			status: 422,
			code: "bad_input",
		});
		authorizedFetch.mockResolvedValueOnce(jsonResponse({message: "ignored"}, 401));
		await expect(dashboardApi.listFolders()).rejects.toThrow("session expired");
		authorizedFetch.mockResolvedValueOnce(new Response(null, {status: 204}));
		await expect(dashboardApi.deleteFolder("folder")).resolves.toBeUndefined();
		authorizedFetch.mockRejectedValueOnce(new TypeError("network"));
		await expect(dashboardApi.listFolders()).rejects.toThrow("Could not reach");
		authorizedFetch.mockRejectedValueOnce(new DOMException("abort", "AbortError"));
		await expect(dashboardApi.listFolders()).rejects.toMatchObject({status: 499});
	});

	it("handles streaming NDJSON events and errors", async () => {
		const body = [
			'{"type":"start","stage":"chapter","provider":"test","model":"m"}\n',
			'{"type":"partial_html_block","block":{"id":"b"}}\n',
			'{"type":"partial_structured","data":{"step":1}}\n',
			'{"type":"complete","data":{"run":{"id":"run"}}}\n',
		].join("");
		authorizedFetch.mockResolvedValueOnce(new Response(body, {status: 200}));
		const onStart = vi.fn();
		const onPartialHtmlBlock = vi.fn();
		const onPartialStructured = vi.fn();
		await expect(
			dashboardApi.streamGenerationRun("run", {onStart, onPartialHtmlBlock, onPartialStructured}),
		).resolves.toEqual({run: {id: "run"}});
		expect(onStart).toHaveBeenCalledOnce();
		expect(onPartialHtmlBlock).toHaveBeenCalledOnce();
		expect(onPartialStructured).toHaveBeenCalledOnce();

		authorizedFetch.mockResolvedValueOnce(new Response('{"type":"error","message":"Stream failed"}\n', {status: 200}));
		await expect(dashboardApi.streamDidacticUnitSyllabus("unit", "silver", {})).rejects.toThrow("Stream failed");
		authorizedFetch.mockResolvedValueOnce(new Response("", {status: 200}));
		await expect(dashboardApi.streamGenerationRun("run", {})).rejects.toThrow("without a complete payload");
		authorizedFetch.mockResolvedValueOnce(new Response(null, {status: 200}));
		await expect(dashboardApi.streamGenerationRun("run", {})).rejects.toThrow("body was not available");
	});
});
