import {Link} from "react-router-dom";

function Hero() {
	return (
		<section className="relative mb-4 h-auto min-h-[610px] w-[1300px] max-w-[calc(100%_-_2rem)] overflow-hidden rounded-xl md:mb-10 md:h-[1180px]">
			<div
				className="absolute inset-0 opacity-50"
				style={{
					backgroundImage: "url(/assets/props/hero-background.png)",
					backgroundRepeat: "repeat",
				}}
			/>

			<div className="relative z-10 flex flex-col items-center px-4 pb-8 pt-8 md:px-0 md:pb-0 md:pt-12">
				<div className="mb-8 rounded-full bg-white px-4 py-2 text-center shadow-card md:mb-12 md:px-6 md:py-3">
					<span className="font-inter font-semibold text-xs text-dark md:text-base">
						New model available	{" "}
					</span>
					<span className="font-inter text-xs text-accent font-semibold md:text-base">
						GPT 5.5
					</span>
				</div>

				<h1 className="mb-5 max-w-[800px] text-center font-sora text-[2rem] font-bold leading-tight text-dark md:mb-8 md:text-7xl">
					Learn about anything, powered by AI
				</h1>

				<p className="mb-8 max-w-2xl text-center font-inter text-base leading-relaxed text-dark/80 md:mb-10 md:text-2xl">
					Didactio is a learning platform where you can create tailored courses and exercises based on your needs and preferences.
				</p>

				<Link
					to="/dashboard"
					className="mb-10 rounded-full bg-accent px-9 py-3 font-sora text-base font-semibold text-dark transition-colors hover:bg-accent/90 md:mb-16 md:px-10 md:py-4 md:text-xl"
				>
					Start learning
				</Link>

				<div className="w-full max-w-[1040px] px-1 md:px-8">
					<img
						src="assets/screenshots/dashboard-light.png"
						alt="Didactio Platform"
						className="w-full rounded-md border-2 border-dark/10 shadow-elevated"
					/>
				</div>
			</div>
		</section>
	);
}

export default Hero;
