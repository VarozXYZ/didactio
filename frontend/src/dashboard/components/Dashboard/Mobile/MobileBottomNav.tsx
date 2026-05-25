import {
	BarChart3,
	BookOpen,
	CreditCard,
	Palette,
	UserCircle,
	type LucideIcon,
} from "lucide-react";
import type {DashboardSection} from "../../../types";

type MobileBottomNavProps = {
	activeSection: DashboardSection;
	onSelectSection: (section: DashboardSection) => void;
};

const navItems: Array<{
	id: DashboardSection;
	label: string;
	icon: LucideIcon;
}> = [
	{id: "all-units", label: "Library", icon: BookOpen},
	{id: "subscription", label: "Credits", icon: CreditCard},
	{id: "profile-security", label: "Profile", icon: UserCircle},
	{id: "preferences", label: "Preferences", icon: Palette},
	{id: "analytics", label: "Analytics", icon: BarChart3},
];

export function MobileBottomNav({
	activeSection,
	onSelectSection,
}: MobileBottomNavProps) {
	return (
		<nav className="app-dashboard-nav fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E5E7] bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-xl md:hidden">
			<div className="mx-auto grid max-w-[520px] grid-cols-5">
				{navItems.map((item) => {
					const Icon = item.icon;
					const isActive = activeSection === item.id;

					return (
						<button
							key={item.id}
							type="button"
							onClick={() => onSelectSection(item.id)}
							className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-1.5 transition-colors ${
								isActive ?
									"text-[#00B84A]"
								:	"text-[#8E8E93] hover:text-[#1D1D1F]"
							}`}
							aria-current={isActive ? "page" : undefined}
						>
							<Icon
								size={24}
								strokeWidth={isActive ? 2.4 : 2.1}
								className="shrink-0"
							/>
							<span className="w-full truncate text-center text-[11px] font-medium leading-tight">
								{item.label}
							</span>
						</button>
					);
				})}
			</div>
		</nav>
	);
}
