import {Navigate} from "react-router-dom";
import {useAuth} from "@/auth/useAuth";
import AuthScreen from "@/components/auth/AuthScreen";

function LoginPage() {
	const {status} = useAuth();
	if (status === "authenticated") {
		return <Navigate to="/dashboard" replace />;
	}

	return <AuthScreen mode="login" />;
}

export default LoginPage;
