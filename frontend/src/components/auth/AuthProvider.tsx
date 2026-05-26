import {
	useEffect,
	useState,
	type PropsWithChildren,
} from "react";
import {authClient} from "@/auth/authClient";
import {AuthContext} from "@/auth/authContext";

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

