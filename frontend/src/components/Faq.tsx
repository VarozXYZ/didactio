import { useState } from 'react'

type FaqItem = {
    question: string
    answer: string
}

const faqs: FaqItem[] = [
    {
        question: 'What is Didactio?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    },
    {
        question: 'How does Didactio differ from other tools?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean euismod bibendum laoreet. Proin gravida dolor sit amet lacus accumsan et viverra justo commodo. Proin sodales pulvinar tempor. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.',
    },
    {
        question: 'Who should use Didactio?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam.',
    },
    {
        question: 'Is Didactio suitable for my subject area?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum.',
    },
    {
        question: 'Can I edit the generated syllabus?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent mauris. Fusce nec tellus sed augue semper porta.',
    },
    {
        question: 'What content types can Didactio generate?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris ipsum. Nulla metus metus, ullamcorper vel, tincidunt sed, euismod in, nibh.',
    },
    {
        question: 'How long is a typical generated syllabus?',
        answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque volutpat condimentum velit. Class aptent taciti sociosqu ad litora torquent per conubia nostra.',
    },
]

function Faq() {
    const [openIndex, setOpenIndex] = useState<number | null>(1)

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
                        const isOpen = openIndex === index
                        const contentId = `faq-panel-${index}`

                        return (
                            <div
                                key={faq.question}
                                className="bg-dark rounded-md px-6 py-5 shadow-card border border-white/10"
                            >
                                <button
                                    type="button"
                                    className="w-full flex items-center justify-between gap-6 text-left"
                                    onClick={() => setOpenIndex((current) => (current === index ? null : index))}
                                    aria-expanded={isOpen}
                                    aria-controls={contentId}
                                >
                                    <span className="font-sora font-semibold text-xl text-white">
                                        {faq.question}
                                    </span>
                                    <img
                                        src="/assets/icons/angle-down-solid-full.png"
                                        alt=""
                                        className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : 'rotate-0'
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
                        )
                    })}
                </div>
            </div>
        </section>
    )
}

export default Faq

