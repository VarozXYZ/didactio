import {createContext} from "react";
import type {AuthStatus, AuthUser} from "@/auth/authClient";

export type AuthContextValue = {
	status: AuthStatus;
	user: AuthUser | null;
	error: string | null;
	beginGoogleLogin: () => void;
	logout: () => Promise<void>;
	refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
