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
		description: "Confirm your name and pick the language for your content.",
	},
	{
		label: "AI Models",
		description: "Choose the models that will power your learning.",
	},
	{
		label: "Welcome",
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
	const [goldModelId, setGoldModelId] = useState("openai/gpt-5.5");
	const [isSubmitting, setIsSubmitting] = useState(false);

	if (!user) return null;

	const goNext = () => setCurrentStep((s) => Math.min(s + 1, 2) as OnboardingStep);
	const goBack = () => setCurrentStep((s) => Math.max(s - 1, 0) as OnboardingStep);

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
			className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
			style={{
				background:
					"radial-gradient(ellipse at 60% 40%, rgba(17,160,125,0.18) 0%, rgba(52,52,195,0.12) 40%, rgba(239,160,71,0.10) 70%, rgba(0,0,0,0.45) 100%)",
				backdropFilter: "blur(20px)",
			}}
		>
			<div
				className="flex min-h-0 max-h-[calc(100dvh-3rem)] w-full max-w-[920px] overflow-hidden rounded-[22px]"
				style={{
					background: "rgba(255,255,255,0.72)",
					backdropFilter: "blur(40px) saturate(1.6)",
					boxShadow:
						"0 2px 0 rgba(255,255,255,0.8) inset, 0 32px 80px rgba(0,0,0,0.22), 0 0 0 1px rgba(255,255,255,0.5)",
					border: "1px solid rgba(255,255,255,0.55)",
				}}
			>
				<div
					className="flex w-[232px] shrink-0 flex-col"
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
									className={`relative flex flex-1 flex-col px-6 py-6 transition-all ${
										index < STEPS.length - 1 ? "border-b border-black/[0.05]" : ""
									} ${isCurrent ? "bg-white/60" : ""}`}
								>
									<div
										className={`absolute left-0 top-0 bottom-0 w-[3px] transition-all ${
											isCurrent ? "bg-[#1D1D1F]"
											: isCompleted ? "bg-[#11A07D]/60"
											: "bg-transparent"
										}`}
									/>

									<span
										className={`mb-3.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[11px] font-bold transition-all ${
											isCompleted ?
												"bg-[#11A07D] text-white"
											: isCurrent ?
												"bg-[#1D1D1F] text-white"
											:	"bg-black/[0.06] text-[#C7C7CC]"
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

				<div className="flex min-h-0 min-w-0 flex-1 flex-col">
					<div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-6">
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
