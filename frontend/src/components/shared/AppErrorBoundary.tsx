import {Component, type PropsWithChildren, type ReactNode} from "react";

type AppErrorBoundaryProps = PropsWithChildren;

type AppErrorBoundaryState = {
	hasError: boolean;
};

export class AppErrorBoundary extends Component<
	AppErrorBoundaryProps,
	AppErrorBoundaryState
> {
	state: AppErrorBoundaryState = {hasError: false};

	static getDerivedStateFromError(): AppErrorBoundaryState {
		return {hasError: true};
	}

	componentDidCatch(): void {
		// Keep the fallback generic. Detailed errors belong in the server logs or
		// an error-tracking provider, never in the public UI.
	}

	private reloadPage = (): void => {
		window.location.reload();
	};

	render(): ReactNode {
		if (!this.state.hasError) {
			return this.props.children;
		}

		return (
			<div
				className="flex min-h-screen items-center justify-center bg-[#F5F5F7] px-6 text-center font-inter text-[#1D1D1F]"
				role="alert"
			>
				<div className="max-w-md rounded-3xl border border-[#E5E5E7] bg-white p-8 shadow-sm">
					<p className="text-xs font-bold uppercase tracking-[0.18em] text-[#86868B]">
						Didactio
					</p>
					<h1 className="mt-3 font-sora text-2xl font-bold">Something went wrong</h1>
					<p className="mt-3 text-sm leading-6 text-[#5F6368]">
						The page could not be displayed. Reload it to continue working.
					</p>
					<button
						type="button"
						onClick={this.reloadPage}
						className="mt-6 rounded-xl bg-[#00B84A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#009F40]"
					>
						Reload page
					</button>
				</div>
			</div>
		);
	}
}
