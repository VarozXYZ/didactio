import {
	createContext,
	useContext,
	useEffect,
	useState,
	type PropsWithChildren,
} from "react";
import {authClient, type AuthUser, type AuthStatus} from "./authClient";

type AuthContextValue = {
	status: AuthStatus;
	user: AuthUser | null;
	error: string | null;
	beginGoogleLogin: () => void;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: PropsWithChildren) {
	const [snapshot, setSnapshot] = useState(authClient.getSnapshot());

	useEffect(() => {
		const unsubscribe = authClient.subscribe(setSnapshot);
		void authClient.bootstrap();
		return unsubscribe;
	}, []);

	return (
		<AuthContext.Provider
			value={{
				status: snapshot.status,
				user: snapshot.user,
				error: snapshot.error,
				beginGoogleLogin: () => authClient.beginGoogleLogin(),
				logout: () => authClient.logout(),
				refreshUser: async () => {
					await authClient.refreshUser();
				},
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider.");
	}

	return context;
}
