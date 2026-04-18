import {Navigate} from "react-router-dom";
import {useAuth} from "../auth/AuthProvider";
import AuthScreen from "../components/AuthScreen";

function LoginPage() {
	const {status} = useAuth();
	if (status === "authenticated") {
		return <Navigate to="/dashboard" replace />;
	}

	return <AuthScreen mode="login" />;
}

export default LoginPage;
