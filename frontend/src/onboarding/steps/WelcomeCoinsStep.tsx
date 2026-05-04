import {useEffect, useState} from "react";
import {ChevronLeft, ChevronRight} from "lucide-react";
import {CoinIcon} from "../../components/Coin";
import type {AuthUser} from "../../auth/authClient";

type Props = {
	user: AuthUser;
	onComplete: () => void;
	isSubmitting: boolean;
	onBack: () => void;
};

function useCountUp(target: number, duration = 1200): number {
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (target === 0) return;
		const start = performance.now();

		function tick(now: number) {
			const elapsed = now - start;
			const progress = Math.min(elapsed / duration, 1);
			const eased = 1 - Math.pow(1 - progress, 3);
			setCount(Math.round(eased * target));
			if (progress < 1) requestAnimationFrame(tick);
		}

		requestAnimationFrame(tick);
	}, [target, duration]);

	return count;
}

const COIN_DURATIONS: Record<string, number> = {
	bronze: 1000,
	silver: 1150,
	gold: 1300,
};

function CoinCard({
	type,
	amount,
	label,
	description,
}: {
	type: "bronze" | "silver" | "gold";
	amount: number;
	label: string;
	description: string;
}) {
	const animated = useCountUp(amount, COIN_DURATIONS[type] ?? 1000);

	return (
		<div className="flex flex-col items-center gap-2 rounded-[14px] border border-black/[0.08] bg-white px-4 py-5 text-center shadow-sm">
			<CoinIcon type={type} size={40} />
			<div className="font-sora text-[28px] font-bold tabular-nums text-[#1D1D1F]">
				{animated}
			</div>
			<div className="text-[13px] font-semibold text-[#1D1D1F]">{label}</div>
			<p className="text-[11.5px] leading-relaxed text-[#AEAEB2]">{description}</p>
		</div>
	);
}

export function WelcomeCoinsStep({user, onComplete, isSubmitting, onBack}: Props) {
	const credits = user.credits;

	return (
		<div className="flex flex-col gap-6 py-2">
			<div>
				<h2 className="font-sora text-[22px] font-bold text-[#1D1D1F] leading-tight">
					Your starting coins
				</h2>
				<p className="mt-1.5 text-[14px] text-[#6E6E73] leading-relaxed">
					We&apos;ve added some coins to your account to get you started. Here&apos;s how they work.
				</p>
			</div>

			<div className="grid grid-cols-3 gap-3">
				<CoinCard
					type="bronze"
					amount={credits.bronze}
					label="Bronze"
					description="Used for small or short, simple tasks"
				/>
				<CoinCard
					type="silver"
					amount={credits.silver}
					label="Silver"
					description="Used for unit content generation with lower quality models"
				/>
				<CoinCard
					type="gold"
					amount={credits.gold}
					label="Gold"
					description="Used for in-depth content generation with high quality models"
				/>
			</div>

			<div className="rounded-[12px] border border-black/[0.07] bg-white/60 px-4 py-3.5">
				<p className="text-[13px] leading-relaxed text-[#6E6E73]">
					<strong className="text-[#1D1D1F]">How it works:</strong> Each time you generate
					content, a specified number of coins are spent based on the quality and length you
					choose. We try to make very clear how many coins each action will cost before you confirm it.
				</p>
			</div>

			<div className="flex justify-between pt-2">
				<button
					type="button"
					onClick={onBack}
					disabled={isSubmitting}
					className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[14px] font-medium text-[#6E6E73] transition hover:bg-black/[0.05] disabled:opacity-40"
				>
					<ChevronLeft size={15} strokeWidth={2.5} />
					Back
				</button>
				<button
					type="button"
					onClick={onComplete}
					disabled={isSubmitting}
					className="flex items-center gap-1.5 rounded-[10px] bg-[#11A07D] px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#0E8A6C] disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isSubmitting ? "Setting up…" : "Start learning"}
					{!isSubmitting && <ChevronRight size={15} strokeWidth={2.5} />}
				</button>
			</div>
		</div>
	);
}
