import {createRoot} from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import {AuthProvider} from "@/components/auth/AuthProvider";
import {Toaster} from "@/components/ui/toaster";
import {AppearanceProvider} from "@/components/shared/AppearanceProvider";
import "streamdown/styles.css";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<AppearanceProvider>
			<AuthProvider>
				<App />
				<Toaster />
			</AuthProvider>
		</AppearanceProvider>
	</BrowserRouter>,
);
