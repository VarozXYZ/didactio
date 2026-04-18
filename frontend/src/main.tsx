import {createRoot} from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import {AuthProvider} from "./auth/AuthProvider";
import {Toaster} from "@/components/ui/toaster";
import "streamdown/styles.css";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<BrowserRouter>
		<AuthProvider>
			<App />
			<Toaster />
		</AuthProvider>
	</BrowserRouter>,
);
