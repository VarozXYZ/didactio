import type {UnitLibraryItem} from "@/dashboard/types";

type UnitLength = UnitLibraryItem["length"];

const LENGTH_BADGE_CONFIG: Record<
	UnitLength,
	{
		label: string;
		background: string;
		color: string;
	}
> = {
	intro: {
		label: "Introduction",
		background: "rgba(17,160,125,0.12)",
		color: "#0A9068",
	},
	short: {
		label: "Introduction",
		background: "rgba(17,160,125,0.12)",
		color: "#0A9068",
	},
	long: {
		label: "Course",
		background: "rgba(239,160,71,0.16)",
		color: "#B85E0D",
	},
	textbook: {
		label: "Textbook",
		background: "rgba(224,29,80,0.12)",
		color: "#BC0F3C",
	},
};

export function LengthBadge({
	length,
	className = "",
}: {
	length: UnitLength;
	className?: string;
}) {
	const config = LENGTH_BADGE_CONFIG[length] ?? LENGTH_BADGE_CONFIG.short;

	return (
		<span
			className={`inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold leading-none ${className}`}
			style={{
				backgroundColor: config.background,
				color: config.color,
			}}
		>
			{config.label}
		</span>
	);
}
