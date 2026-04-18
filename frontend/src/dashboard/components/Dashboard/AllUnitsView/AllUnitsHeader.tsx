import {Plus} from "lucide-react";
import {useState} from "react";

function CreateUnitButton({onClick}: {onClick: () => void}) {
	const [hovered, setHovered] = useState(false);
	const [pressed, setPressed] = useState(false);
	const [spinKey, setSpinKey] = useState(0);

	return (
		<>
			<style>{`
                @property --arc-end {
                    syntax: '<angle>';
                    inherits: false;
                    initial-value: 0deg;
                }
                @keyframes arcExpand {
                    from { --arc-end: 0deg; }
                    to   { --arc-end: 360deg; }
                }
                .border-spinner {
                    animation: arcExpand 1.1s cubic-bezier(0.2, 0.8, 0.4, 1) forwards;
                }
            `}</style>

			<button
				type="button"
				onClick={onClick}
				onMouseEnter={() => {
					setHovered(true);
					setSpinKey((k) => k + 1);
				}}
				onMouseLeave={() => {
					setHovered(false);
					setPressed(false);
				}}
				onMouseDown={() => setPressed(true)}
				onMouseUp={() => setPressed(false)}
				style={{
					position: "relative",
					overflow: "hidden",
					padding: "2px",
					border: "none",
					borderRadius: "14px",
					background: "#0f0f12",
					cursor: "pointer",
					transform: pressed ? "scale(0.988)" : "none",
					transition: "transform 0.12s ease, box-shadow 0.22s ease",
					// Keep only subtle insets here; the outer shadow animates via a dedicated layer below.
					boxShadow:
						"inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 8px rgba(0,0,0,0.30)",
				}}
			>
				{/* Animated elevation shadow layer (animates better than box-shadow interpolation). */}
				<div
					aria-hidden="true"
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "14px",
						pointerEvents: "none",
						zIndex: 0,
						transform:
							hovered ? "translateY(-1px)" : "translateY(0px)",
						opacity: hovered ? 1 : 0,
						transition:
							"opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
						boxShadow:
							"0 20px 52px -22px rgba(0,0,0,0.78), 0 12px 26px -18px rgba(0,0,0,0.58)",
					}}
				/>

				{/* Spinning gradient — only mounted while hovering, restarts on each new hover */}
				{hovered && (
					<div
						key={spinKey}
						className="border-spinner"
						style={{
							position: "absolute",
							width: "300%",
							height: "500%",
							top: "50%",
							left: "50%",
							transform: "translate(-50%, -50%)",
							/* Arc grows from ~150° to ~355° clockwise from the top.
                               Colors spread evenly across whatever the current arc-end is.
                               from -10deg so the arc starts just before 12 o'clock. */
							/* Seamless static rainbow — starts & ends with #3434c3 so 0°=360° is invisible.
                               The mask animates the reveal; no seam possible. */
							background:
								"conic-gradient(from 0deg, #3434c3 0deg, #337ECF 45deg, #8DD598 90deg, #11A07D 135deg, #FADF52 180deg, #EFA047 225deg, #E01D50 270deg, #BB2081 315deg, #3434c3 360deg)",
							WebkitMaskImage:
								"conic-gradient(from 0deg, black 0deg, black var(--arc-end), transparent calc(var(--arc-end) + 12deg), transparent 360deg)",
							maskImage:
								"conic-gradient(from 0deg, black 0deg, black var(--arc-end), transparent calc(var(--arc-end) + 12deg), transparent 360deg)",
							zIndex: 1,
						}}
					/>
				)}

				{/* Inner face — covers the center, only the 2px gap shows the gradient as a border */}
				<div
					style={{
						position: "relative",
						zIndex: 2,
						background: "#0f0f12",
						borderRadius: "12px",
					}}
					className="flex select-none items-center gap-2.5 px-5 py-[11px] text-[14px] font-semibold text-white"
				>
					<Plus size={17} strokeWidth={2.5} />
					New unit
				</div>
			</button>
		</>
	);
}

export function AllUnitsHeader({
	filteredUnitsCount,
	onCreateUnit,
}: {
	filteredUnitsCount: number;
	onCreateUnit: () => void;
}) {
	return (
		<header className="z-10 flex h-[80px] shrink-0 items-center justify-between border-b border-[#E5E5E7] bg-white/80 px-8 backdrop-blur-md">
			<div className="mx-auto flex w-full max-w-[1560px] items-center justify-between gap-6">
				<div>
					<h1 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
						Library
					</h1>
					<p className="mt-0.5 text-[13px] text-[#86868B]">
						{filteredUnitsCount} library items
					</p>
				</div>

				<CreateUnitButton onClick={onCreateUnit} />
			</div>
		</header>
	);
}
