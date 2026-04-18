import {AlertCircle} from "lucide-react";
import {
	Toast,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@/components/ui/toast";
import {type ToasterToast, useToast} from "@/hooks/use-toast";

export function Toaster() {
	const {toasts} = useToast();

	return (
		<ToastProvider duration={5000} swipeDirection="right">
			{toasts.map(
				({id, title, description, action, ...props}: ToasterToast) => (
					<Toast key={id} {...props}>
						{props.variant === "destructive" && (
							<AlertCircle className="mt-0.5 size-[18px] shrink-0 text-red-500" />
						)}
						<div className="grid min-w-0 flex-1 gap-1">
							{title ?
								<ToastTitle>{title}</ToastTitle>
							:	null}
							{description ?
								<ToastDescription>
									{description}
								</ToastDescription>
							:	null}
						</div>
						{action}
						<ToastClose />
					</Toast>
				),
			)}
			<ToastViewport />
		</ToastProvider>
	);
}
