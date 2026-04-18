import {useState} from "react";
import type {FormEvent} from "react";
import {Link, useLocation} from "react-router-dom";
import {useAuth} from "../auth/AuthProvider";

type AuthMode = "login" | "register";

type AuthScreenProps = {
	mode: AuthMode;
};

function SocialButton({
	label,
	iconSrc,
	disabled = false,
	onClick,
}: {
	label: string;
	iconSrc: string;
	disabled?: boolean;
	onClick?: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className={`h-13 w-full rounded-sm border px-5 font-sora text-xl font-semibold shadow-sm transition-colors ${
				disabled ?
					"cursor-not-allowed border-dark/15 bg-white px-5 text-dark/45 opacity-55 grayscale"
				:	"cursor-pointer border-dark/15 bg-white text-dark/95 hover:bg-dark/3"
			}`}
		>
			<span className="flex items-center justify-center">
				<img
					src={iconSrc}
					alt=""
					className="h-9 w-auto max-w-[170px] object-contain"
				/>
			</span>
		</button>
	);
}

function AuthScreen({mode}: AuthScreenProps) {
	const location = useLocation();
	const {beginGoogleLogin, error} = useAuth();
	const isLogin = mode === "login";
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const locationState = location.state as {authError?: string} | null;

	const title = isLogin ? "Welcome back" : "Create your account";
	const subtitle =
		isLogin ?
			"Sign in to access the dashboard."
		:	"Sign up to access the dashboard.";
	const authErrorMessage = locationState?.authError ?? error;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
	}

	return (
		<section className="grid min-h-screen w-full lg:grid-cols-[1.05fr_1fr]">
			<aside className="relative min-h-[330px] overflow-hidden bg-accent">
				<div className="absolute inset-0 bg-[radial-gradient(circle,rgba(50,48,48,0.18)_2px,transparent_2px)] [background-size:46px_46px]" />
				<div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-dark/20" />

				<div className="relative z-10 flex h-full flex-col justify-center px-8 py-14 sm:px-12 lg:px-16">
					<div className="mb-24 inline-flex">
						<img
							src="/assets/logos/logo-horizontal.png"
							alt="Didactio"
							className="h-[58px] w-auto"
						/>
					</div>

					<h1 className="max-w-[550px] font-sora text-5xl font-bold leading-[1.18] text-dark">
						Design smarter curricula in seconds
					</h1>
				</div>
			</aside>

			<div className="flex items-center justify-center bg-white px-6 py-12 sm:px-10">
				<div className="w-full max-w-[560px] py-4">
					<header>
						<h2 className="font-sora text-5xl font-bold text-dark">
							{title}
						</h2>
						<p className="mt-4 font-inter text-xl text-dark/65">
							{subtitle}
						</p>
						{authErrorMessage && (
							<p className="mt-5 rounded-sm border border-red-200 bg-red-50 px-4 py-3 font-inter text-base text-red-700">
								{authErrorMessage}
							</p>
						)}
					</header>

					<div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<SocialButton
							label="Google"
							iconSrc="/assets/brands/google.png"
							onClick={beginGoogleLogin}
						/>
						<SocialButton
							label="Microsoft"
							iconSrc="/assets/brands/microsoft.png"
							disabled
						/>
					</div>

					<div className="my-12 flex items-center gap-5">
						<div className="h-px flex-1 bg-dark/35" />
						<span className="font-inter text-lg text-dark/60">
							Or continue with
						</span>
						<div className="h-px flex-1 bg-dark/35" />
					</div>

					<form onSubmit={handleSubmit} className="space-y-8">
						{!isLogin && (
							<label className="block">
								<span className="font-sora text-xl font-semibold text-dark">
									Full name
								</span>
								<input
									type="text"
									name="name"
									autoComplete="name"
									placeholder="Jane Doe"
									value={fullName}
									onChange={(event) =>
										setFullName(event.target.value)
									}
									disabled
									className="mt-4 h-13 w-full cursor-not-allowed rounded-sm border border-dark/15 bg-white px-4 font-inter text-xl text-dark/55 outline-none transition-shadow placeholder:text-dark/40 opacity-60"
								/>
							</label>
						)}

						<label className="block">
							<span className="font-sora text-xl font-semibold text-dark">
								Email address
							</span>
							<input
								type="email"
								name="email"
								autoComplete="email"
								placeholder="name@example.com"
								value={email}
								onChange={(event) =>
									setEmail(event.target.value)
								}
								disabled
								className="mt-4 h-13 w-full cursor-not-allowed rounded-sm border border-dark/15 bg-white px-4 font-inter text-xl text-dark/55 outline-none transition-shadow placeholder:text-dark/40 opacity-60"
							/>
						</label>

						<label className="block">
							<span className="font-sora text-xl font-semibold text-dark">
								Password
							</span>
							<div className="relative mt-4">
								<input
									type={showPassword ? "text" : "password"}
									name="password"
									autoComplete={
										isLogin ? "current-password" : (
											"new-password"
										)
									}
									placeholder="Enter your password"
									value={password}
									onChange={(event) =>
										setPassword(event.target.value)
									}
									disabled
									className="h-13 w-full cursor-not-allowed rounded-sm border border-dark/15 bg-white px-4 pr-12 font-inter text-xl text-dark/55 outline-none transition-shadow placeholder:text-dark/40 opacity-60"
								/>
								<button
									type="button"
									onClick={() =>
										setShowPassword((value) => !value)
									}
									disabled
									className="absolute right-4 top-1/2 -translate-y-1/2 cursor-not-allowed font-inter text-sm text-dark/45 opacity-60"
									aria-label={
										showPassword ? "Hide password" : (
											"Show password"
										)
									}
								>
									{showPassword ? "Hide" : "Show"}
								</button>
							</div>
						</label>

						{!isLogin && (
							<label className="block">
								<span className="font-sora text-xl font-semibold text-dark">
									Confirm password
								</span>
								<div className="relative mt-4">
									<input
										type={
											showConfirmPassword ? "text" : (
												"password"
											)
										}
										name="confirmPassword"
										autoComplete="new-password"
										placeholder="Confirm your password"
										value={confirmPassword}
										onChange={(event) =>
											setConfirmPassword(
												event.target.value,
											)
										}
										disabled
										className="h-13 w-full cursor-not-allowed rounded-sm border border-dark/15 bg-white px-4 pr-12 font-inter text-xl text-dark/55 outline-none transition-shadow placeholder:text-dark/40 opacity-60"
									/>
									<button
										type="button"
										onClick={() =>
											setShowConfirmPassword(
												(value) => !value,
											)
										}
										disabled
										className="absolute right-4 top-1/2 -translate-y-1/2 cursor-not-allowed font-inter text-sm text-dark/45 opacity-60"
										aria-label={
											showConfirmPassword ?
												"Hide confirm password"
											:	"Show confirm password"
										}
									>
										{showConfirmPassword ? "Hide" : "Show"}
									</button>
								</div>
							</label>
						)}

						{isLogin ?
							<div className="flex justify-end">
								<a
									href="#"
									onClick={(event) => event.preventDefault()}
									className="pointer-events-none font-inter text-lg font-semibold text-accent"
								>
									Forgot password?
								</a>
							</div>
						:	<p className="font-inter text-base text-dark/60">
								By creating an account, you agree to our terms
								and privacy policy.
							</p>
						}

						<button
							type="submit"
							disabled
							className="mt-4 h-13 w-full cursor-not-allowed rounded-sm bg-accent font-sora text-xl font-semibold text-white shadow-card opacity-60"
						>
							{isLogin ? "Log In" : "Create account"}
						</button>
					</form>

					<p className="mt-10 text-center font-inter text-lg text-dark/65">
						{isLogin ?
							"Don't have an account?"
						:	"Already have an account?"}{" "}
						<Link
							to={isLogin ? "/register" : "/login"}
							className="font-semibold text-accent hover:text-accent/80"
						>
							{isLogin ? "Register" : "Log in"}
						</Link>
					</p>
				</div>
			</div>
		</section>
	);
}

export default AuthScreen;
