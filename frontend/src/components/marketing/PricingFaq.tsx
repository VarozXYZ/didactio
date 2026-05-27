import {useState} from "react";

type FaqItem = {
	question: string;
	answer: string;
};

const faqColumns: FaqItem[][] = [
	[
		{
			question: "Do I need a credit card to start using Didactio?",
			answer: "No, you can test our platform for free. After you register, you will receive a free credit pack to explore the features and see how it can work for you.",
		},
		{
			question: "How do credits work?",
			answer: "Credits are spent when AI generation runs. Different actions use different coin types, such as syllabus drafts, unit generation, module regeneration, activities, feedback, and notes.",
		},
		{
			question: "What are Standard and Pro generations?",
			answer: "Standard and Pro are quality tiers. Pro is intended for more demanding generation work, while Standard is a lower-cost option for everyday authoring.",
		},
		{
			question: "Do purchased credits expire?",
			answer: "Credit packs do not expire. For subscriptions, unused Standard and Pro credits are kept; Bronze may be subject to the plan's monthly fair-use rules.",
		},
		{
			question: "Are prices shown with or without VAT?",
			answer: "The prices shown here are listed before VAT. The final tax calculation is handled during checkout.",
		},
		{
			question: "Can I cancel a subscription?",
			answer: "Subscriptions are managed through the billing portal when Stripe is configured for the deployment.",
		},
	],
	[
		{
			question: "What does Plus add?",
			answer: "Plus includes unlimited bronze use under fair-use limits and a larger monthly allowance of Standard and Pro credits for premium generation.",
		},
		{
			question: "Can several teachers share one account?",
			answer: "The current product is designed around individual user accounts. Multi-user workspaces and institutional collaboration are future product areas.",
		},
		{
			question: "Can I export the generated material?",
			answer: "Yes. Units can be reviewed, edited, and exported to PDF from the editor.",
		},
		{
			question: "Can I use the platform in multiple languages?",
			answer: "Yes, you can generated courses in any language. The interface is currently in English, but we plan to support more languages in the future.",
		},
		{
			question: "Do I own the generated content?",
			answer: "AI-generated content may have legal and quality limitations. Review the output before use and follow the terms that apply to your account and AI providers.",
		},
		{
			question: "Does the app replace teachers?",
			answer: "No. Didactio is an authoring assistant. Teachers and learners remain responsible for checking accuracy, context, and pedagogical fit.",
		},
	],
];

const accentFilter =
	"brightness(0) saturate(100%) invert(64%) sepia(70%) saturate(463%) hue-rotate(83deg) brightness(95%) contrast(92%)";

function PricingFaq() {
	const [openId, setOpenId] = useState<string | null>(null);

	return (
		<section className="w-[1120px] max-w-[calc(100%_-_2rem)] py-10 md:py-16">
			<div className="flex flex-col items-center text-center">
				<h2 className="font-sora text-2xl font-bold text-dark md:text-4xl">
					Still got questions?
				</h2>
				<p className="mt-4 max-w-[760px] font-inter text-base text-dark/70 leading-relaxed">
					Here are the practical details about credits, billing, exports,
					and what the current product does today.
				</p>
			</div>

			<div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 lg:grid-cols-2 lg:gap-8">
				{faqColumns.map((column, columnIndex) => (
					<div key={columnIndex} className="flex flex-col gap-4">
						{column.map((faq, rowIndex) => {
							const itemId = `${columnIndex}-${rowIndex}`;
							const isOpen = itemId === openId;

							return (
								<div
									key={faq.question}
									className="w-full rounded-md bg-dark px-5 py-4 text-left shadow-card md:px-6"
								>
									<button
										type="button"
										onClick={() =>
											setOpenId((current) =>
												current === itemId ? null : (
													itemId
												),
											)
										}
										aria-expanded={isOpen}
										className="w-full flex items-center justify-between gap-4"
									>
										<span className="font-sora text-base font-semibold text-white leading-snug md:text-lg">
											{faq.question}
										</span>
										<img
											src="/assets/icons/angle-down-solid-full.png"
											alt=""
											className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
											style={{filter: accentFilter}}
										/>
									</button>
									{isOpen && (
										<p className="mt-3 font-inter text-sm text-white/70 leading-relaxed">
											{faq.answer}
										</p>
									)}
								</div>
							);
						})}
					</div>
				))}
			</div>
		</section>
	);
}

export default PricingFaq;
