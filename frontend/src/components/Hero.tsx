function Hero() {
    return (
        <section className="relative w-[1300px] h-[1180px] overflow-hidden rounded-xl mb-10">
            <div
                className="absolute inset-0 opacity-50"
                style={{ backgroundImage: 'url(/assets/props/hero-background.png)', backgroundRepeat: 'repeat' }}
            />

            <div className="relative z-10 flex flex-col items-center pt-12 sh">
                <div className="bg-white rounded-full px-6 py-3 shadow-card mb-12">
                    <span className="font-inter font-semibold text-base text-dark">New category just released </span>
                    <span className="font-inter text-base text-accent font-semibold">Programming Languages</span>
                </div>

                <h1 className="font-sora font-bold text-7xl text-dark text-center leading-tight mb-8 max-w-[800px]">
                    Create professional courses in minutes
                </h1>

                <p className="font-inter text-2xl text-dark/80 text-center max-w-2xl leading-relaxed mb-10">
                    Didactio uses AI and pedagogical expertise to generate high-quality, structured learning content tailored to your needs.
                </p>

                <button className="bg-accent text-dark font-sora font-semibold text-xl px-10 py-4 rounded-full hover:bg-accent/90 transition-colors mb-16">
                    Start now, free
                </button>

                <div className="w-full max-w-[1040px] px-8">
                    <img
                        src="/assets/props/showcase-section.png"
                        alt="Didactio Platform"
                        className="w-full rounded-mm border-2 border-dark/10 shadow-elevated"
                    />
                </div>
            </div>
        </section>
    )
}

export default Hero
