import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {authClient} from "../auth/authClient";

function AuthCallbackPage() {
	const navigate = useNavigate();
	const [message, setMessage] = useState("Finishing Google sign-in...");

	useEffect(() => {
		let cancelled = false;

		void authClient
			.handleOAuthCallback(window.location.search)
			.then(() => {
				if (cancelled) {
					return;
				}

				navigate("/dashboard", {replace: true});
			})
			.catch((error: unknown) => {
				if (cancelled) {
					return;
				}

				setMessage(
					error instanceof Error ?
						error.message
					:	"Google sign-in failed.",
				);
				window.setTimeout(() => {
					navigate("/login", {
						replace: true,
						state: {authError: error instanceof Error ? error.message : undefined},
					});
				}, 900);
			});

		return () => {
			cancelled = true;
		};
	}, [navigate]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
			<div>
				<h1 className="font-sora text-3xl font-bold text-dark">
					Signing you in
				</h1>
				<p className="mt-3 font-inter text-lg text-dark/60">{message}</p>
			</div>
		</div>
	);
}

export default AuthCallbackPage;
