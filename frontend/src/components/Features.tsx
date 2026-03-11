import Marquee from 'react-fast-marquee'

const brands = [
    { logo: '/assets/brands/chatgpt.png', name: 'ChatGPT' },
    { logo: '/assets/brands/claude.png' },
    { logo: '/assets/brands/deepseek.png' },
    { logo: '/assets/brands/gemini.png' },
    { logo: '/assets/brands/meta.png' },
    { logo: '/assets/brands/mistral.png', name: 'Mistral' },
    { logo: '/assets/brands/qwen.png', name: 'Qwen' },
    { logo: '/assets/brands/grok.png' },
    { logo: '/assets/brands/kimi.png', name: 'Kimi' },
    { logo: '/assets/brands/aws.png', name: 'Nova' },
    { logo: '/assets/brands/nvidia.png' },
]

function shuffle<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

const row1 = shuffle(brands)
const row2 = shuffle(brands)
const row3 = shuffle(brands)
const row4 = shuffle(brands)
const row5 = shuffle(brands)

const features = [
    {
        icon: '/assets/icons/magic-wand.png',
        title: 'Fast & effortless',
        description: 'Customize it and have it generated in minutes. Edit yourself if needed, all in the same place.',
        iconMargin: 'ml-2 mb-1',
    },
    {
        icon: '/assets/icons/language-solid-full.png',
        title: 'Pedagogically backed',
        description: 'Our systems have been created by educational experts. Courses balance practice and theory.',
        iconMargin: 'ml-0.5',
    },
    {
        icon: '/assets/icons/hand-holding-dollar-solid-full.png',
        title: 'Affordable & scalable',
        description: 'Try our systems for free and scale them across your entire organization for a fraction of the cost.',
        iconMargin: 'ml-0.25 mb-0.5',
    },
    {
        icon: '/assets/icons/graduation-cap-solid.png',
        title: 'Any topic, any field',
        description: 'Generate courses for virtually any subject: STEM, humanities, languages, professional development and beyond',
        iconMargin: 'ml-0.5',
    },
]

function BrandBubble({ brand }: { brand: { logo: string; name?: string } }) {
    return (
        <div className="bg-white rounded-full px-4 py-3 mx-2 flex items-center gap-2 shadow-sm">
            <img src={brand.logo} alt="" className="h-7 w-auto object-contain" />
            {brand.name && <span className="font-sora font-semibold text-xl text-dark">{brand.name}</span>}
        </div>
    )
}

function Features() {
    return (
        <section className="w-[1040px] py-16">
            <h2 className="font-sora font-bold text-4xl text-dark mb-12">
                Why teachers and students choose us
            </h2>

            <div className="flex gap-6">
                <div className="w-[340px] bg-dark rounded-md overflow-hidden flex items-center">
                    <div className="flex flex-col gap-5">
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

                <div className="flex-1 grid grid-cols-2 gap-4">
                    {features.map((feature, index) => (
                        <div key={index} className="bg-dark rounded-md p-3 flex flex-col">
                            <div className="w-15 h-15 bg-white rounded-lg flex items-center justify-center mb-3">
                                <img src={feature.icon} alt="" className={`w-11 h-11 ${feature.iconMargin}`} />
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
    )
}

export default Features
