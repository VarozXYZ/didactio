import { useState } from 'react'

type FaqItem = {
    question: string
    answer: string
}

const faqColumns: FaqItem[][] = [
    [
        {
            question: 'Do I need a credit card to start using Didactio?',
            answer: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        },
        {
            question: 'How is billing handled for paid plans?',
            answer: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
        },
        {
            question: 'Are prices shown with or without VAT?',
            answer: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
        },
        {
            question: 'How do upgrades and downgrades work?',
            answer: 'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
        },
        {
            question: 'Do you offer refunds?',
            answer: 'Curabitur non nulla sit amet nisl tempus convallis quis ac lectus. Vivamus magna justo, lacinia eget consectetur sed.',
        },
        {
            question: 'Can several teachers share one Pro account?',
            answer: 'Pellentesque in ipsum id orci porta dapibus. Nulla porttitor accumsan tincidunt.',
        },
        {
            question: 'What’s included in the Free plan?',
            answer: 'Mauris blandit aliquet elit, eget tincidunt nibh pulvinar a. Donec sollicitudin molestie malesuada.',
        },
    ],
    [
        {
            question: 'What does the Pro plan add beyond Free?',
            answer: 'Sed porttitor lectus nibh. Proin eget tortor risus.',
        },
        {
            question: 'Is my data processed in compliance with GDPR?',
            answer: 'Vivamus suscipit tortor eget felis porttitor volutpat. Vestibulum ac diam sit amet quam vehicula elementum sed sit amet dui.',
        },
        {
            question: 'Where is my data stored?',
            answer: 'Praesent sapien massa, convallis a pellentesque nec, egestas non nisi.',
        },
        {
            question: 'Can I request deletion or export of my data?',
            answer: 'Quisque velit nisi, pretium ut lacinia in, elementum id enim.',
        },
        {
            question: 'Can I use the generated content commercially?',
            answer: 'Donec rutrum congue leo eget malesuada. Curabitur arcu erat, accumsan id imperdiet et, porttitor at sem.',
        },
        {
            question: 'Can I use the platform in multiple languages?',
            answer: 'Nulla quis lorem ut libero malesuada feugiat. Pellentesque in ipsum id orci porta dapibus.',
        },
        {
            question: 'Does the app replace teachers?',
            answer: 'Cras ultricies ligula sed magna dictum porta. Donec sollicitudin molestie malesuada.',
        },
    ],
]

const accentFilter =
    'brightness(0) saturate(100%) invert(64%) sepia(70%) saturate(463%) hue-rotate(83deg) brightness(95%) contrast(92%)'

function PricingFaq() {
    const [openId, setOpenId] = useState<string | null>('0-0')

    return (
        <section className="w-[1120px] max-w-[95vw] py-16">
            <div className="flex flex-col items-center text-center">
                <h2 className="font-sora text-4xl font-bold text-dark">Still got questions?</h2>
                <p className="mt-4 max-w-[760px] font-inter text-base text-dark/70 leading-relaxed">
                    We have answered some of the most frequently asked questions about the product, payments,
                    and your advantages as a subscriber!
                </p>
            </div>

            <div className="mt-10 grid grid-cols-2 gap-8">
                {faqColumns.map((column, columnIndex) => (
                    <div key={columnIndex} className="flex flex-col gap-4">
                        {column.map((faq, rowIndex) => {
                            const itemId = `${columnIndex}-${rowIndex}`
                            const isOpen = itemId === openId

                            return (
                                <div
                                    key={faq.question}
                                    className="w-full rounded-md bg-dark px-6 py-4 text-left shadow-card"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setOpenId((current) => (current === itemId ? null : itemId))}
                                        aria-expanded={isOpen}
                                        className="w-full flex items-center justify-between gap-4"
                                    >
                                        <span className="font-sora text-lg font-semibold text-white leading-snug">
                                            {faq.question}
                                        </span>
                                        <img
                                            src="/assets/icons/angle-down-solid-full.png"
                                            alt=""
                                            className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                            style={{ filter: accentFilter }}
                                        />
                                    </button>
                                    {isOpen && (
                                        <p className="mt-3 font-inter text-sm text-white/70 leading-relaxed">
                                            {faq.answer}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ))}
            </div>
        </section>
    )
}

export default PricingFaq
