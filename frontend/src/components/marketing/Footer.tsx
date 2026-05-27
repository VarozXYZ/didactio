import {Link} from "react-router-dom";

function Footer() {
	return (
		<footer className="my-5 h-auto w-[1040px] max-w-[calc(100%_-_2rem)] rounded-md bg-secondary/55 lg:h-[500px] lg:rounded-b-xl lg:rounded-t-ml">
			<div className="flex flex-col gap-6 rounded-md bg-dark px-6 py-7 lg:h-[125px] lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:rounded-xl lg:px-16 lg:py-0">
				<div>
					<h3 className="mb-2 font-sora text-2xl font-bold text-white md:text-3xl">
						Join our newsletter
					</h3>
					<h5 className="font-inter text-base text-white/70">
						Be the first to know about our new features
					</h5>
				</div>

				<div className="flex w-full items-center rounded-full border border-white/50 py-1 pl-4 pr-1 lg:w-auto">
					<input
						type="email"
						placeholder="Enter your email address"
						className="min-w-0 flex-1 bg-transparent font-inter text-sm text-white placeholder:text-white/50 outline-none lg:w-[280px] lg:flex-none"
					/>
					<button className="flex h-[46px] w-[54px] shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-white/90 md:h-[50px] md:w-[65px]">
						<img
							src="/assets/icons/paper-plane-solid-full.png"
							alt="Send"
							className="h-7 w-7 md:h-8 md:w-8"
						/>
					</button>
				</div>
			</div>

			<div className="flex flex-col gap-9 px-6 pt-8 lg:flex-row lg:justify-between lg:gap-0 lg:px-16 lg:pt-5">
				<div className="w-full lg:w-[280px]">
					<img
						src="/assets/logos/logo-horizontal.png"
						alt="Didactio"
						className="mb-5 h-[45px] md:mb-6 md:h-[50px]"
					/>
					<p className="font-inter text-md text-dark leading-relaxed mb-8">
						AI-powered workspace for planning, generating, editing,
						studying, and exporting complete didactic units.
					</p>
					<div className="flex items-center gap-3">
						<a
							href="https://twitter.com"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-13 w-13 items-center justify-center rounded-full bg-dark transition-colors hover:bg-dark/80 md:h-16 md:w-16"
						>
							<img
								src="/assets/icons/x-twitter.png"
								alt="X"
								className="h-8 w-8 md:h-10 md:w-10"
							/>
						</a>
						<a
							href="https://instagram.com"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-13 w-13 items-center justify-center rounded-full bg-dark transition-colors hover:bg-dark/80 md:h-16 md:w-16"
						>
							<img
								src="/assets/icons/instagram.png"
								alt="Instagram"
								className="h-8 w-8 md:h-10 md:w-10"
							/>
						</a>
						<a
							href="https://discord.com"
							target="_blank"
							rel="noopener noreferrer"
							className="flex h-13 w-13 items-center justify-center rounded-full bg-dark transition-colors hover:bg-dark/80 md:h-16 md:w-16"
						>
							<img
								src="/assets/icons/discord-brands-solid-full.png"
								alt="Discord"
								className="h-8 w-8 md:h-10 md:w-10"
							/>
						</a>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-7 sm:grid-cols-3 sm:gap-8 lg:mt-5 lg:flex lg:gap-20">
					<div>
						<h4 className="font-sora font-bold text-xl text-dark mb-4">
							Resources
						</h4>
						<ul className="space-y-3">
							<li>
								<Link
									to="/dashboard"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									Dashboard
								</Link>
							</li>
							<li>
								<Link
									to="/pricing"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									Pricing
								</Link>
							</li>
							<li>
								<Link
									to="/contact"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									Contact
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<h4 className="font-sora font-bold text-xl text-dark mb-4">
							Support
						</h4>
						<ul className="space-y-3">
							<li>
								<Link
									to="/pricing"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									Credits
								</Link>
							</li>
							<li>
								<Link
									to="/"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									FAQ
								</Link>
							</li>
							<li>
								<Link
									to="/contact"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									Support
								</Link>
							</li>
						</ul>
					</div>

					<div>
						<h4 className="font-sora font-bold text-xl text-dark mb-4">
							Didactio
						</h4>
						<ul className="space-y-3">
							<li>
								<Link
									to="/"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									Product
								</Link>
							</li>
							<li>
								<Link
									to="/contact"
									className="font-inter text-md text-dark/70 hover:text-dark transition-colors"
								>
									Contact Us
								</Link>
							</li>
						</ul>
					</div>
				</div>
			</div>

			<div className="mt-10 px-6 pb-8 text-center lg:mt-0 lg:px-16">
				<p className="font-inter text-sm text-dark/75 mb-4">
					Copyright @ 2026
				</p>
				<div className="w-full h-[1px] bg-dark/50"></div>
			</div>
		</footer>
	);
}

export default Footer;
