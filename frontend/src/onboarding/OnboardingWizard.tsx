import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {Check} from "lucide-react";
import {useAuth} from "../auth/AuthProvider";
import {authClient} from "../auth/authClient";
import {dashboardApi} from "../dashboard/api/dashboardApi";
import {ProfileStep} from "./steps/ProfileStep";
import {ModelsStep} from "./steps/ModelsStep";
import {WelcomeCoinsStep} from "./steps/WelcomeCoinsStep";

type OnboardingStep = 0 | 1 | 2;

const STEPS = [
	{
		label: "Profile",
		mobileLabel: "Profile",
		title: "Welcome to Didactio",
		subtitle: "Set up your profile and content language.",
		description: "Confirm your name and pick the language for your content.",
	},
	{
		label: "AI Models",
		mobileLabel: "Models",
		title: "Choose your AI models",
		subtitle: "Pick the models that will power your learning.",
		description: "Choose the models that will power your learning.",
	},
	{
		label: "Welcome",
		mobileLabel: "Coins",
		title: "Your starting coins",
		subtitle: "Collect your starting coins and learn how they work.",
		description: "Collect your starting coins and learn how they work.",
	},
] as const;

function resolveModelId(fullId: string): {provider: string; model: string} {
	const slash = fullId.indexOf("/");
	if (slash === -1) return {provider: "", model: fullId};
	return {provider: fullId.slice(0, slash), model: fullId.slice(slash + 1)};
}

export function OnboardingWizard() {
	const {user, refreshUser} = useAuth();
	const navigate = useNavigate();

	const [currentStep, setCurrentStep] = useState<OnboardingStep>(0);
	const [displayName, setDisplayName] = useState(user?.displayName ?? "");
	const [language, setLanguage] = useState(() => {
		const locale = user?.locale;
		if (!locale) return "English";
		const lang = locale.split("-")[0].toLowerCase();
		const map: Record<string, string> = {
			es: "Spanish",
			fr: "French",
			de: "German",
			pt: "Portuguese",
			it: "Italian",
			zh: "Chinese",
			ja: "Japanese",
			ar: "Arabic",
			ru: "Russian",
			ko: "Korean",
			hi: "Hindi",
			nl: "Dutch",
			pl: "Polish",
			tr: "Turkish",
			vi: "Vietnamese",
			th: "Thai",
			id: "Indonesian",
			sw: "Swahili",
			ca: "Catalan",
		};
		return map[lang] ?? "English";
	});
	const [silverModelId, setSilverModelId] = useState("deepseek/deepseek-v4-flash");
	const [goldModelId, setGoldModelId] = useState(
		"anthropic/claude-sonnet-4-6",
	);
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (!user) return null;

	const goNext = () => setCurrentStep((s) => Math.min(s + 1, 2) as OnboardingStep);
	const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0) as OnboardingStep);
	const currentStepMeta = STEPS[currentStep];
	const canLeaveProfile =
		displayName.trim().length > 0 && language.trim().length > 0;
	const canLeaveModels = Boolean(silverModelId && goldModelId);
	const canSelectStep = (index: number) => {
		if (index <= currentStep) return true;
		if (index === 1) return canLeaveProfile;
		if (index === 2) return canLeaveProfile && canLeaveModels;
		return false;
	};
	const handleSelectStep = (index: number) => {
		if (!canSelectStep(index)) return;
		setCurrentStep(index as OnboardingStep);
	};

	const handleProfileNext = async () => {
		if (displayName.trim() !== user.displayName) {
			await authClient.updateDisplayName(displayName.trim());
		}
		goNext();
	};

	const handleComplete = async () => {
		setIsSubmitting(true);
		try {
			const silver = resolveModelId(silverModelId);
			const gold = resolveModelId(goldModelId);

			await dashboardApi.updateAiConfig({
				silver,
				gold,
				authoring: {
					language,
					tone: "neutral",
					learnerLevel: "beginner",
				},
			});

			await authClient.completeOnboarding();
			await refreshUser();
			navigate("/dashboard", {replace: true});
		} catch (e) {
			console.error("Onboarding completion failed", e);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center overflow-x-hidden overflow-y-auto px-4 py-3 sm:py-6 md:items-center"
			style={{
				background:
					"radial-gradient(ellipse at 60% 40%, rgba(17,160,125,0.18) 0%, rgba(52,52,195,0.12) 40%, rgba(239,160,71,0.10) 70%, rgba(0,0,0,0.45) 100%)",
				backdropFilter: "blur(20px)",
			}}
		>
			<div
				className="app-glass-modal flex min-h-0 w-full max-w-[520px] flex-col overflow-hidden rounded-[22px] md:max-h-[calc(100dvh-3rem)] md:max-w-[920px] md:flex-row"
				style={{
					background: "rgba(255,255,255,0.72)",
					backdropFilter: "blur(40px) saturate(1.6)",
					boxShadow:
						"0 2px 0 rgba(255,255,255,0.8) inset, 0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.5)",
					border: "1px solid rgba(255,255,255,0.55)",
				}}
			>
				<div
					className="app-glass-sidebar hidden w-[232px] shrink-0 flex-col md:flex"
					style={{
						background: "rgba(248,248,250,0.7)",
						borderRight: "1px solid rgba(0,0,0,0.06)",
					}}
				>
					<div className="px-5 pt-5 pb-4 shrink-0">
						<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#AEAEB2]">
							Getting Started
						</p>
					</div>

					<nav className="flex flex-1 flex-col">
						{STEPS.map((step, index) => {
							const isCompleted = index < currentStep;
							const isCurrent = index === currentStep;

							return (
								<div
									key={step.label}
									className={`app-onboarding-step relative flex flex-1 flex-col px-6 py-6 transition-all ${
										index < STEPS.length - 1 ? "border-b border-black/[0.05]" : ""
									} ${isCurrent ? "app-onboarding-step-current bg-white/60" : ""}`}
								>
									<div
										className={`absolute left-0 top-0 bottom-0 w-[3px] transition-all ${
											isCurrent ? "bg-[#1D1D1F]"
											: isCompleted ? "bg-[#11A07D]/60"
											: "bg-transparent"
										}`}
									/>

									<span
										className={`app-wizard-step-badge mb-3.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold transition-all ${
											isCompleted ?
												"app-wizard-step-badge-completed bg-[#11A07D] text-white"
											: isCurrent ?
												"app-wizard-step-badge-current bg-[#1D1D1F] text-white"
											:	"app-wizard-step-badge-idle bg-black/[0.06] text-[#C7C7CC]"
										}`}
									>
										{isCompleted ? <Check size={11} strokeWidth={3} /> : index + 1}
									</span>

									<span
										className={`mb-2.5 block text-[14px] font-semibold leading-tight transition-all ${
											isCurrent ? "text-[#1D1D1F]"
											: isCompleted ? "text-[#6E6E73]"
											: "text-[#C7C7CC]"
										}`}
									>
										{step.label}
									</span>

									<p
										className={`text-[12.5px] leading-relaxed transition-all ${
											isCurrent ? "text-[#6E6E73]"
											: isCompleted ? "text-[#AEAEB2]"
											: "text-[#D1D1D6]"
										}`}
									>
										{step.description}
									</p>
								</div>
							);
						})}
					</nav>
				</div>

				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden md:overflow-hidden">
					<div className="shrink-0 border-b border-black/[0.06] px-5 pb-4 pt-5 md:hidden">
						<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#AEAEB2]">
							Getting Started
						</p>
						<h2 className="mt-4 text-[27px] font-bold leading-tight tracking-tight text-[#1D1D1F]">
							{currentStepMeta.title}
						</h2>
						<p className="mt-3 text-[15px] font-medium leading-relaxed text-[#7A7A7F]">
							{currentStepMeta.subtitle}
						</p>
					</div>

					<div className="w-full min-w-0 shrink-0 overflow-hidden px-5 pb-4 pt-2 md:hidden">
						<div className="app-onboarding-mobile-steps grid grid-cols-3 overflow-hidden rounded-[16px] border border-black/[0.08] bg-black/[0.05] p-0.5">
							{STEPS.map((step, index) => {
								const isCompleted = index < currentStep;
								const isCurrent = index === currentStep;

								return (
									<button
										type="button"
										key={step.label}
										onClick={() => handleSelectStep(index)}
										disabled={!canSelectStep(index)}
										className={`app-onboarding-mobile-step flex min-w-0 items-center justify-center gap-1.5 px-2 py-2 text-[11px] font-bold transition ${
											isCurrent ?
												"app-onboarding-mobile-step-current rounded-[13px] bg-[#1D1D1F] text-white"
											: isCompleted ?
												"text-[#0A9068]"
											:	"text-[#AEAEB2]"
										} ${!isCurrent && index > 0 ? "border-l border-black/[0.08]" : ""} disabled:cursor-not-allowed disabled:opacity-50`}
									>
										<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px]">
											{isCompleted ?
												<Check size={10} strokeWidth={3} />
											:	index + 1}
										</span>
										<span className="truncate">
											{step.mobileLabel}
										</span>
									</button>
								);
							})}
						</div>
					</div>

					<div className="min-h-0 min-w-0 flex-1 overflow-x-hidden px-5 pb-5 pt-0 md:overflow-y-auto md:px-6 md:pb-6 md:pt-6">
						{currentStep === 0 && (
							<ProfileStep
								user={user}
								displayName={displayName}
								onDisplayNameChange={setDisplayName}
								language={language}
								onLanguageChange={setLanguage}
								onNext={() => void handleProfileNext()}
							/>
						)}
						{currentStep === 1 && (
							<ModelsStep
								silverModelId={silverModelId}
								goldModelId={goldModelId}
								onSilverChange={setSilverModelId}
								onGoldChange={setGoldModelId}
								onNext={goNext}
								onBack={goBack}
							/>
						)}
						{currentStep === 2 && (
							<WelcomeCoinsStep
								user={user}
								onComplete={() => void handleComplete()}
								isSubmitting={isSubmitting}
								onBack={goBack}
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
