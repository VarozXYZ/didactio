import {useState} from "react";
import {Link, useLocation} from "react-router-dom";

function Header() {
	const location = useLocation();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const isActive = (path: string) => location.pathname === path;

	const navLinkClass = (path: string) =>
		`font-sora text-xl font-medium transition-colors ${
			isActive(path) ? "text-accent" : "text-white hover:text-accent"
		}`;

	return (
		<header className="relative z-20 my-6 flex w-[1440px] max-w-[calc(100%_-_2rem)] items-center justify-between gap-4 md:my-10 md:gap-8 xl:gap-24">
			<Link to="/" className="shrink-0">
				<img
					src="/assets/logos/logo-horizontal.png"
					alt="Didactio"
					className="block h-auto max-h-[42px] w-auto max-w-[172px] object-contain md:max-h-[60px] md:max-w-full"
				/>
			</Link>

			<nav className="hidden bg-dark rounded-md px-8 py-3 w-[650px] xl:flex items-center justify-center gap-18 shadow-card hover:shadow-elevated transition-shadow">
				<Link
					to="/"
					className={navLinkClass("/")}
				>
					Home
				</Link>
				<Link
					to="/pricing"
					className={navLinkClass("/pricing")}
				>
					Pricing
				</Link>
				<Link
					to="/contact"
					className={navLinkClass("/contact")}
				>
					Contact
				</Link>
				<Link
					to="/dashboard"
					className={`${navLinkClass("/dashboard")} flex items-center gap-2`}
				>
					Dashboard
					<span
						aria-hidden="true"
						className="h-4 w-4 bg-current transition-colors"
						style={{
							WebkitMask:
								"url('/assets/icons/dashboard-icon.png') center / contain no-repeat",
							mask: "url('/assets/icons/dashboard-icon.png') center / contain no-repeat",
						}}
					/>
				</Link>
			</nav>

			<Link
				to="/dashboard"
				className="hidden w-[150px] h-[40px] bg-accent rounded-md border border-dark font-sora font-semibold text-xl text-dark xl:flex items-center justify-center hover:bg-accent/90 transition-colors shadow-card hover:shadow-elevated"
			>
				Try it out
			</Link>

			<button
				type="button"
				aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
				aria-expanded={isMenuOpen}
				aria-controls="marketing-mobile-menu"
				onClick={() => setIsMenuOpen((current) => !current)}
				className="flex h-11 w-11 items-center justify-center text-dark xl:hidden"
			>
				<span className="sr-only">Menu</span>
				<span className="relative block h-5 w-6">
					<span
						className={`absolute left-0 top-0.5 block h-0.5 w-6 bg-current transition-transform ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`}
					/>
					<span
						className={`absolute left-0 top-2.5 block h-0.5 w-6 bg-current transition-opacity ${isMenuOpen ? "opacity-0" : ""}`}
					/>
					<span
						className={`absolute left-0 top-[18px] block h-0.5 w-6 bg-current transition-transform ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`}
					/>
				</span>
			</button>

			{isMenuOpen && (
				<nav
					id="marketing-mobile-menu"
					className="absolute left-0 right-0 top-[calc(100%_+_0.75rem)] flex flex-col gap-1 rounded-md bg-dark p-3 shadow-elevated xl:hidden"
				>
					<Link
						to="/"
						onClick={() => setIsMenuOpen(false)}
						className={`${navLinkClass("/")} rounded-md px-4 py-3`}
					>
						Home
					</Link>
					<Link
						to="/pricing"
						onClick={() => setIsMenuOpen(false)}
						className={`${navLinkClass("/pricing")} rounded-md px-4 py-3`}
					>
						Pricing
					</Link>
					<Link
						to="/contact"
						onClick={() => setIsMenuOpen(false)}
						className={`${navLinkClass("/contact")} rounded-md px-4 py-3`}
					>
						Contact
					</Link>
					<Link
						to="/dashboard"
						onClick={() => setIsMenuOpen(false)}
						className={`${navLinkClass("/dashboard")} flex items-center gap-2 rounded-md px-4 py-3`}
					>
						Dashboard
						<span
							aria-hidden="true"
							className="h-4 w-4 bg-current"
							style={{
								WebkitMask:
									"url('/assets/icons/dashboard-icon.png') center / contain no-repeat",
								mask: "url('/assets/icons/dashboard-icon.png') center / contain no-repeat",
							}}
						/>
					</Link>
					<Link
						to="/dashboard"
						onClick={() => setIsMenuOpen(false)}
						className="mt-2 flex h-12 items-center justify-center rounded-md border border-dark bg-accent font-sora text-lg font-semibold text-dark transition-colors hover:bg-accent/90"
					>
						Try it out
					</Link>
				</nav>
			)}
		</header>
	);
}

export default Header;
