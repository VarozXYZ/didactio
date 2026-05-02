import {useCallback, useRef, useState} from "react";
import {
	type BackendGenerationRun,
	type BackendHtmlContentBlock,
	dashboardApi,
} from "../api/dashboardApi";

type GenerationRunStreamState = {
	blocks: BackendHtmlContentBlock[];
	error: string | null;
	isStreaming: boolean;
	run: BackendGenerationRun | null;
};

export function useGenerationRunStream() {
	const [state, setState] = useState<GenerationRunStreamState>({
		blocks: [],
		error: null,
		isStreaming: false,
		run: null,
	});
	const blockIdsRef = useRef(new Set<string>());
	const abortRef = useRef<AbortController | null>(null);

	const stream = useCallback(async (runId: string) => {
		abortRef.current?.abort();
		const abortController = new AbortController();
		abortRef.current = abortController;
		blockIdsRef.current = new Set();
		setState({
			blocks: [],
			error: null,
			isStreaming: true,
			run: null,
		});

		try {
			const result = await dashboardApi.streamGenerationRun(runId, {
				signal: abortController.signal,
				onPartialHtmlBlock: ({block}) => {
					if (blockIdsRef.current.has(block.id)) {
						return;
					}
					blockIdsRef.current.add(block.id);
					setState((current) => ({
						...current,
						blocks: [...current.blocks, block],
					}));
				},
			});
			setState((current) => ({
				...current,
				isStreaming: false,
				run: result.run,
				blocks:
					result.run.emittedBlocks && result.run.emittedBlocks.length > 0 ?
						result.run.emittedBlocks
					:	current.blocks,
			}));
			return result.run;
		} catch (error) {
			if (abortController.signal.aborted) {
				return null;
			}
			setState((current) => ({
				...current,
				error:
					error instanceof Error ?
						error.message
					:	"Generation stream failed.",
				isStreaming: false,
			}));
			throw error;
		}
	}, []);

	const cancel = useCallback(() => {
		abortRef.current?.abort();
		setState((current) => ({...current, isStreaming: false}));
	}, []);

	return {...state, cancel, stream};
}
