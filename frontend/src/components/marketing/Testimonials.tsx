import {useState} from "react";

type Testimonial = {
	name: string;
	role: string;
	quote: string;
	rating: number;
	photoSrc: string;
	avatarSrc: string;
};

const testimonials: Testimonial[] = [
	{
		name: "Maria García",
		role: "High School Teacher",
		quote: "Didactio saved me 20 hours on syllabus design. The quality is professional, and I can customize it exactly as I need.",
		rating: 4,
		photoSrc: "/assets/props/testimonial-woman.png",
		avatarSrc: "/assets/props/testimonial-woman-eclipse.png",
	},
	{
		name: "Daniel Thompson",
		role: "University Lecturer",
		quote: "The structure is solid from the start, and I can adapt it to my class in minutes. It’s the best workflow upgrade I’ve made this year.",
		rating: 5,
		photoSrc: "/assets/props/testimonial_man.png",
		avatarSrc: "/assets/props/testimonial-man-eclipse.png",
	},
];

function clampRating(rating: number) {
	return Math.max(0, Math.min(5, Math.round(rating)));
}

function StarRating({rating}: {rating: number}) {
	const stars = clampRating(rating);

	return (
		<div
			className="flex items-center gap-2"
			aria-label={`${stars} out of 5 stars`}
		>
			{Array.from({length: 5}, (_, index) => (
				<img
					key={index}
					src={
						index < stars ?
							"/assets/icons/Star.png"
						:	"/assets/icons/star-empty.png"
					}
					alt=""
					className="h-6 w-6"
				/>
			))}
		</div>
	);
}

function Testimonials() {
	const [activeIndex, setActiveIndex] = useState(0);
	const active = testimonials[activeIndex] ?? testimonials[0];
	const canNavigate = testimonials.length > 1;

	const goPrev = () =>
		setActiveIndex(
			(i) => (i - 1 + testimonials.length) % testimonials.length,
		);
	const goNext = () => setActiveIndex((i) => (i + 1) % testimonials.length);

	if (!active) return null;

	return (
		<section className="w-[1040px] max-w-[calc(100%_-_2rem)] py-10 md:py-16">
			<div className="mb-8 flex flex-col gap-6 md:mb-10 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="mb-3 font-sora text-2xl font-bold text-dark md:mb-4 md:text-4xl">
						Trusted by users worldwide
					</h2>
					<p className="font-inter text-base text-dark/80">
						Discover what our users think about our platform
					</p>
				</div>

				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={goPrev}
						disabled={!canNavigate}
						aria-label="Previous testimonial"
						className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-dark flex items-center justify-center transition-colors ${
							canNavigate ? "hover:bg-dark/80" : (
								"opacity-50 cursor-not-allowed"
							)
						}`}
					>
						<img
							src="/assets/icons/arrow-left-solid-full.png"
							alt=""
							className="h-6 w-6 md:h-7 md:w-7"
						/>
					</button>
					<button
						type="button"
						onClick={goNext}
						disabled={!canNavigate}
						aria-label="Next testimonial"
						className={`w-12 h-12 md:w-14 md:h-14 rounded-full bg-dark flex items-center justify-center transition-colors ${
							canNavigate ? "hover:bg-dark/80" : (
								"opacity-50 cursor-not-allowed"
							)
						}`}
					>
						<img
							src="/assets/icons/arrow-right-solid-full.png"
							alt=""
							className="h-6 w-6 md:h-7 md:w-7"
						/>
					</button>
				</div>
			</div>

			<div className="flex w-full flex-col overflow-hidden rounded-md border border-dark/10 shadow-card md:h-[260px] md:flex-row">
				<div className="h-[200px] w-full bg-secondary md:h-auto md:w-[520px]">
					<img
						src={active.photoSrc}
						alt=""
						className="w-full h-full object-contain object-bottom"
					/>
				</div>

				<div className="flex flex-1 flex-col justify-between gap-7 bg-dark p-6 md:p-8">
					<div>
						<StarRating rating={active.rating} />
						<p className="font-inter text-base text-white/80 leading-relaxed mt-6 max-w-[440px]">
							{active.quote}
						</p>
					</div>

					<div className="inline-flex items-center gap-3 bg-secondary rounded-full pl-3 pr-5 py-2 w-fit">
						<img
							src={active.avatarSrc}
							alt=""
							className="w-12 h-12 rounded-full"
						/>
						<div className="leading-tight">
							<p className="font-sora font-semibold text-lg text-dark">
								{active.name}
							</p>
							<p className="font-inter text-xs text-dark/70">
								{active.role}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export default Testimonials;
