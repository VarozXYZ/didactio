import {useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {useAuth} from "@/auth/useAuth";
import {OnboardingWizard} from "@/components/onboarding/OnboardingWizard";

export default function OnboardingPage() {
	const {user, status} = useAuth();
	const navigate = useNavigate();

	useEffect(() => {
		if (status === "authenticated" && user?.onboardingCompletedAt) {
			navigate("/dashboard", {replace: true});
		}
	}, [status, user, navigate]);

	if (status === "loading" || (status === "authenticated" && user?.onboardingCompletedAt)) {
		return null;
	}

	return <OnboardingWizard />;
}
