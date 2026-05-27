import Marquee from "react-fast-marquee";

const brands = [
	{logo: "/assets/brands/chatgpt.png", name: "ChatGPT"},
	{logo: "/assets/brands/claude.png"},
	{logo: "/assets/brands/deepseek.png"},
	{logo: "/assets/brands/gemini.png"},
	{logo: "/assets/brands/meta.png"},
	{logo: "/assets/brands/mistral.png", name: "Mistral"},
	{logo: "/assets/brands/qwen.png", name: "Qwen"},
	{logo: "/assets/brands/grok.png"},
	{logo: "/assets/brands/kimi.png", name: "Kimi"},
	{logo: "/assets/brands/aws.png", name: "Nova"},
	{logo: "/assets/brands/nvidia.png"},
];

function shuffle<T>(array: T[]): T[] {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}

const row1 = shuffle(brands);
const row2 = shuffle(brands);
const row3 = shuffle(brands);
const row4 = shuffle(brands);
const row5 = shuffle(brands);

const features = [
	{
		icon: "/assets/icons/magic-wand.png",
		title: "Fast & effortless",
		description:
			"Customize it and have it generated in minutes. Edit yourself if needed, all in the same place.",
		iconMargin: "ml-2 mb-1",
	},
	{
		icon: "/assets/icons/language-solid-full.png",
		title: "Pedagogically backed",
		description:
			"Our systems have been created by educational experts. Courses balance practice and theory.",
		iconMargin: "ml-0.5",
	},
	{
		icon: "/assets/icons/hand-holding-dollar-solid-full.png",
		title: "Affordable & scalable",
		description:
			"Try our app for free and learn for a fraction of the cost of traditional learning materials.",
		iconMargin: "ml-0.25 mb-0.5",
	},
	{
		icon: "/assets/icons/graduation-cap-solid.png",
		title: "Any topic, any field",
		description:
			"Generate courses for virtually any subject: STEM, humanities, languages, professional development and beyond",
		iconMargin: "ml-0.5",
	},
];

function BrandBubble({brand}: {brand: {logo: string; name?: string}}) {
	return (
		<div className="mx-1.5 flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm md:mx-2 md:gap-2 md:px-4 md:py-3">
			<img
				src={brand.logo}
				alt=""
				className="h-6 w-auto object-contain md:h-7"
			/>
			{brand.name && (
				<span className="font-sora text-base font-semibold text-dark md:text-xl">
					{brand.name}
				</span>
			)}
		</div>
	);
}

function Features() {
	return (
		<section className="w-[1040px] max-w-[calc(100%_-_2rem)] py-10 md:py-16">
			<h2 className="mb-8 text-center font-sora text-2xl font-bold text-dark md:mb-12 md:text-left md:text-4xl">
				Why students and educators chose us
			</h2>

			<div className="flex flex-col gap-6 lg:flex-row">
				<div className="flex h-[320px] w-full items-center overflow-hidden rounded-md bg-dark sm:h-[340px] lg:h-auto lg:w-[340px]">
					<div className="flex w-full min-w-0 flex-col gap-4 md:gap-5">
						<Marquee direction="left" speed={30} autoFill>
							{row1.map((brand, i) => (
								<BrandBubble key={i} brand={brand} />
							))}
						</Marquee>
						<Marquee direction="right" speed={30} autoFill>
							{row2.map((brand, i) => (
								<BrandBubble key={i} brand={brand} />
							))}
						</Marquee>
						<Marquee direction="left" speed={30} autoFill>
							{row3.map((brand, i) => (
								<BrandBubble key={i} brand={brand} />
							))}
						</Marquee>
						<Marquee direction="right" speed={30} autoFill>
							{row4.map((brand, i) => (
								<BrandBubble key={i} brand={brand} />
							))}
						</Marquee>
						<Marquee direction="left" speed={30} autoFill>
							{row5.map((brand, i) => (
								<BrandBubble key={i} brand={brand} />
							))}
						</Marquee>
					</div>
				</div>

				<div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
					{features.map((feature, index) => (
						<div
							key={index}
							className="bg-dark rounded-md p-3 flex flex-col"
						>
							<div className="w-15 h-15 bg-white rounded-lg flex items-center justify-center mb-3">
								<img
									src={feature.icon}
									alt=""
									className={`w-11 h-11 ${feature.iconMargin}`}
								/>
							</div>
							<h3 className="font-sora font-semibold text-xl text-accent mb-3">
								{feature.title}
							</h3>
							<p className="font-inter text-sm text-white leading-relaxed">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export default Features;
