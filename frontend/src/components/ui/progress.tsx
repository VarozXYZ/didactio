import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import {cn} from "@/lib/utils";

const Progress = React.forwardRef<
	React.ElementRef<typeof ProgressPrimitive.Root>,
	React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({className, value, ...props}, ref) => (
	<ProgressPrimitive.Root
		ref={ref}
		className={cn(
			"relative h-1.5 w-full overflow-hidden rounded-full bg-[#F0F0F2]",
			className,
		)}
		{...props}
	>
		<ProgressPrimitive.Indicator
			className="h-full rounded-full bg-[#4ADE80] transition-all duration-500 ease-out"
			style={{width: `${value ?? 0}%`}}
		/>
	</ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export {Progress};
