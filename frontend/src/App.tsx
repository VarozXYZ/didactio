import {Route, Routes, useLocation} from "react-router-dom";
import {RequireAuth} from "./auth/RequireAuth";
import Header from "./components/Header";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import PricingPage from "./pages/PricingPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import OnboardingPage from "./pages/OnboardingPage";

function App() {
	const location = useLocation();
	const isAuthRoute =
		location.pathname === "/login" ||
		location.pathname === "/register" ||
		location.pathname === "/auth/callback" ||
		location.pathname === "/oauth/callback";
	const isDashboardRoute = location.pathname.startsWith("/dashboard");
	const isOnboardingRoute = location.pathname.startsWith("/onboarding");
	const hideMainChrome = isAuthRoute || isDashboardRoute || isOnboardingRoute;

	return (
		<div
			className={`mx-auto bg-white min-h-screen flex flex-col ${hideMainChrome ? "" : "items-center"}`}
		>
			{!hideMainChrome && <Header />}
			<main
				className={
					hideMainChrome ? "flex-1 w-full" : (
						"flex-1 w-full flex flex-col items-center"
					)
				}
			>
				<Routes>
					<Route path="/" element={<HomePage />} />
					<Route path="/pricing" element={<PricingPage />} />
					<Route path="/contact" element={<ContactPage />} />
					<Route path="/login" element={<LoginPage />} />
					<Route path="/register" element={<RegisterPage />} />
					<Route path="/auth/callback" element={<AuthCallbackPage />} />
					<Route path="/oauth/callback" element={<AuthCallbackPage />} />
					<Route
						path="/onboarding"
						element={
							<RequireAuth skipOnboardingCheck>
								<OnboardingPage />
							</RequireAuth>
						}
					/>
					<Route
						path="/dashboard/*"
						element={
							<RequireAuth>
								<DashboardPage />
							</RequireAuth>
						}
					/>
					<Route path="*" element={<HomePage />} />
				</Routes>
			</main>
			{!hideMainChrome && <Footer />}
		</div>
	);
}

export default App;
