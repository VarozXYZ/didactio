import {Navigate, useLocation} from "react-router-dom";
import {useAuth} from "./AuthProvider";
import type {PropsWithChildren} from "react";

export function RequireAuth({children}: PropsWithChildren) {
	const {status} = useAuth();
	const location = useLocation();

	if (status === "loading") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
				<div>
					<h1 className="font-sora text-3xl font-bold text-dark">
						Restoring your session
					</h1>
					<p className="mt-3 font-inter text-lg text-dark/60">
						Checking your Didactio account...
					</p>
				</div>
			</div>
		);
	}

	if (status !== "authenticated") {
		return <Navigate to="/login" replace state={{from: location}} />;
	}

	return children;
}
