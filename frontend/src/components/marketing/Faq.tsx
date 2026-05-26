import {useState} from "react";

type FaqItem = {
	question: string;
	answer: string;
};

const faqs: FaqItem[] = [
	{
		question: "What is Didactio?",
		answer: "Didactio is a platform that combines the power of AI models with the background of educational design to generate tailored courses and learning materials based on user preferences and needs.",
	},
	{
		question: "How does Didactio differ from other tools?",
		answer: "Didactio offers both high quality content to learn about any topic and a platform where you can both study and practice with tailored exercises and feedback",
	},
	{
		question: "Who should use Didactio?",
		answer: "It is useful for teachers, tutors, trainers, students, and anyone who wants structured learning material without designing the whole unit from scratch.",
	},
	{
		question: "Is Didactio suitable for my subject area?",
		answer: "Unless treating a topic that goes against our content policy, Didactio can generate courses for virtually any subject: STEM, humanities, languages, professional development and beyond.",
	},
	{
		question: "Can I edit the generated syllabus?",
		answer: "Yes. You can review the syllabus before approving it, change its structure, and later edit or regenerate generated modules from the editor.",
	},
	{
		question: "What content types can Didactio generate?",
		answer: "Didactio can generate different lengths of units depending on the depth and level that you want to learn. After reading, you can generated various types of exercises to practice and get feedback on your learning.",
	},
	{
		question: "Can I trust AI-generated content as final material?",
		answer: "AI can be wrong at times. We have handcrafted railways that guide the generation process to be as high quality and accurate as possible, but we recommend reviewing the generated content before using it as final material.",
	},
];

function Faq() {
	const [openIndex, setOpenIndex] = useState<number | null>(1);

	return (
		<section className="w-[1040px] py-16">
			<h2 className="font-sora font-bold text-4xl text-dark mb-12">
				Frequently asked questions
			</h2>

			<div className="flex gap-6 items-stretch">
				<div className="w-[470px] rounded-md overflow-hidden shadow-card border border-dark/10">
					<img
						src="/assets/props/faq-prop.png"
						alt=""
						className="w-full h-full object-cover"
					/>
				</div>

				<div className="flex-1 flex flex-col gap-4">
					{faqs.map((faq, index) => {
						const isOpen = openIndex === index;
						const contentId = `faq-panel-${index}`;

						return (
							<div
								key={faq.question}
								className="bg-dark rounded-md px-6 py-5 shadow-card border border-white/10"
							>
								<button
									type="button"
									className="w-full flex items-center justify-between gap-6 text-left"
									onClick={() =>
										setOpenIndex((current) =>
											current === index ? null : index,
										)
									}
									aria-expanded={isOpen}
									aria-controls={contentId}
								>
									<span className="font-sora font-semibold text-xl text-white">
										{faq.question}
									</span>
									<img
										src="/assets/icons/angle-down-solid-full.png"
										alt=""
										className={`w-5 h-5 transition-transform duration-200 ${
											isOpen ? "rotate-180" : "rotate-0"
										}`}
									/>
								</button>

								{isOpen && (
									<div id={contentId} className="mt-4">
										<p className="font-inter text-sm text-white/70 leading-relaxed">
											{faq.answer}
										</p>
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}

export default Faq;
