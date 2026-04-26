import type {BackendCoinType} from "../dashboard/api/dashboardApi";

const COIN_ASSETS: Record<BackendCoinType, string> = {
	bronze: "/assets/props/bronce-coin.png",
	silver: "/assets/props/silver-coin.png",
	gold: "/assets/props/gold-coin.png",
};

const COIN_LABELS: Record<BackendCoinType, string> = {
	bronze: "Bronze coin",
	silver: "Silver coin",
	gold: "Gold coin",
};

export function CoinIcon({
	type,
	size = 20,
	className = "",
}: {
	type: BackendCoinType;
	size?: number;
	className?: string;
}) {
	return (
		<img
			src={COIN_ASSETS[type]}
			alt={COIN_LABELS[type]}
			width={size}
			height={size}
			className={`inline-block shrink-0 object-contain ${className}`}
		/>
	);
}

export function CoinAmount({
	type,
	amount,
	size = 18,
	className = "",
}: {
	type: BackendCoinType;
	amount: number;
	size?: number;
	className?: string;
}) {
	return (
		<span className={`inline-flex items-center gap-1.5 ${className}`}>
			<CoinIcon type={type} size={size} />
			<span className="tabular-nums">{amount}</span>
		</span>
	);
}
